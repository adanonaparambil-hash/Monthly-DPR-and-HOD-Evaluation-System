------------------------------------------------------------------------------
-- 22_ai_insights_drop_stale_fns.sql
-- Removes two STALE duplicate functions that were left inside
-- PKG_AI_INSIGHTS (declared in the spec, defined at the end of the body):
--
--     FN_DAILY_EXP    -> still returns 8.5 for India (correct value is 8)
--     FN_WORKING_DAYS -> old location-based weekend rule, no P_CATEGORY:
--                        India 22 days instead of 24 (wrongly treats the
--                        2nd/4th-Saturday rows as public holidays) and
--                        expat staff 20 days instead of 24 (gives them the
--                        Omani 5-day week).
--
-- Measured on live data for 1-28 Jul 2026:
--     PKG_AI_INSIGHTS.FN_DAILY_EXP('STAFF','IND')    = 8.5   (should be 8)
--     PKG_AI_INSIGHTS.FN_WORKING_DAYS(...,'IND')     = 22    (should be 24)
--     PKG_AI_INSIGHTS.FN_WORKING_DAYS(...,'OM')      = 20    (should be 24)
--
-- They are NOT used anywhere: SP_GET_DPR_AI_SUMMARY calls PKG_DPR_CALC.*,
-- and nothing in the database or the C# API references PKG_AI_INSIGHTS.FN_*
-- (both verified). But they are PUBLIC, so anyone writing a new report or
-- query could pick them up and silently get the pre-fix numbers. Deleting
-- them leaves PKG_DPR_CALC as the single source of truth.
--
-- Everything else in this package is byte-for-byte the deployed version
-- (fetched from USER_SOURCE on 29-Jul-2026).
--
-- Compile the SPEC first, then the BODY.
------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_AI_INSIGHTS AS

    PROCEDURE SP_GET_USER_CONTEXT (
        P_EMPID   IN  VARCHAR2,
        P_CURSOR  OUT SYS_REFCURSOR,
        P_SUCCESS OUT VARCHAR2,
        P_MESSAGE OUT VARCHAR2
    );

    PROCEDURE SP_GET_DEPARTMENTS (
        P_CURSOR  OUT SYS_REFCURSOR,
        P_SUCCESS OUT VARCHAR2,
        P_MESSAGE OUT VARCHAR2
    );

    PROCEDURE SP_GET_DPR_AI_SUMMARY (
        P_DEPT_ID       IN  NUMBER,        -- NULL = all departments (CED only)
        P_EMPID         IN  VARCHAR2,      -- NULL = all employees in scope
        P_DATE_FROM     IN  DATE,
        P_DATE_TO       IN  DATE,
        P_EMP_CURSOR    OUT SYS_REFCURSOR, -- per-employee aggregates
        P_DAILY_CURSOR  OUT SYS_REFCURSOR, -- last-7-day per-day detail
        P_SUCCESS       OUT VARCHAR2,
        P_MESSAGE       OUT VARCHAR2
    );

    PROCEDURE SP_SAVE_MONTHLY_REPORT (
        P_DEPT_ID      IN  NUMBER,
        P_REPORT_MONTH IN  VARCHAR2,       -- 'YYYY-MM'
        P_REPORT_TEXT  IN  CLOB,
        P_SUCCESS      OUT VARCHAR2,
        P_MESSAGE      OUT VARCHAR2
    );

    PROCEDURE SP_GET_MONTHLY_REPORT (
        P_DEPT_ID      IN  NUMBER,         -- NULL = all departments
        P_REPORT_MONTH IN  VARCHAR2,       -- NULL = latest month per dept
        P_CURSOR       OUT SYS_REFCURSOR,
        P_SUCCESS      OUT VARCHAR2,
        P_MESSAGE      OUT VARCHAR2
    );

    PROCEDURE SP_SAVE_CHAT (
        P_SESSION_ID  IN  VARCHAR2,
        P_EMPID       IN  VARCHAR2,
        P_USER_MSG    IN  CLOB,
        P_AI_RESPONSE IN  CLOB,
        P_SUCCESS     OUT VARCHAR2,
        P_MESSAGE     OUT VARCHAR2
    );

    PROCEDURE SP_GET_CHAT (
        P_SESSION_ID IN  VARCHAR2,
        P_LAST_N     IN  NUMBER DEFAULT 10,
        P_CURSOR     OUT SYS_REFCURSOR,
        P_SUCCESS    OUT VARCHAR2,
        P_MESSAGE    OUT VARCHAR2
    );

END PKG_AI_INSIGHTS;
/

CREATE OR REPLACE PACKAGE BODY PKG_AI_INSIGHTS AS

   
    PROCEDURE SP_GET_USER_CONTEXT (
        P_EMPID   IN  VARCHAR2,
        P_CURSOR  OUT SYS_REFCURSOR,
        P_SUCCESS OUT VARCHAR2,
        P_MESSAGE OUT VARCHAR2
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT e.EMPID            AS EMPID,
                   e.EMPLOYEENAME     AS EMPLOYEENAME,
                   d.DEPARTMENT_ID    AS DEPTID,
                   CASE
                       -- TODO(CED): add the 'C' rule from SP_LOGIN_USER here, e.g.:
                       -- WHEN e.EMPID IN (SELECT ... CED rule ...) THEN 'C'
                       WHEN EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                     WHERE h.EMP_ID = e.EMPID AND h.IS_ACTIVE = 'Y') THEN 'H'
                       ELSE 'E'
                   END                AS USERROLE
            FROM   TM_DPR_EMPLOYEE_DETAILS e
            LEFT JOIN TM_DEPTMASTER d ON d.DEPTNAME = e.DEPARTMENT
            WHERE  e.EMPID = P_EMPID;
        P_SUCCESS := 'Y';
        P_MESSAGE := 'Success';
    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching user context: ' || SQLERRM;
    END SP_GET_USER_CONTEXT;

    -- ────────────────────────────────────────────────────────────────────────
    PROCEDURE SP_GET_DEPARTMENTS (
        P_CURSOR  OUT SYS_REFCURSOR,
        P_SUCCESS OUT VARCHAR2,
        P_MESSAGE OUT VARCHAR2
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT d.DEPARTMENT_ID AS DEPARTMENTID,
                   d.DEPTNAME      AS DEPTNAME
            FROM   TM_DEPTMASTER d
            WHERE  d.IS_ACTIVE = 'Y'
            ORDER  BY d.DEPTNAME;
        P_SUCCESS := 'Y';
        P_MESSAGE := 'Success';
    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching departments: ' || SQLERRM;
    END SP_GET_DEPARTMENTS;

   
           
    -- ────────────────────────────────────────────────────────────────────────
    
    
     PROCEDURE SP_GET_DPR_AI_SUMMARY (
        P_DEPT_ID       IN  NUMBER,
        P_EMPID         IN  VARCHAR2,
        P_DATE_FROM     IN  DATE,
        P_DATE_TO       IN  DATE,
        P_EMP_CURSOR    OUT SYS_REFCURSOR,
        P_DAILY_CURSOR  OUT SYS_REFCURSOR,
        P_SUCCESS       OUT VARCHAR2,
        P_MESSAGE       OUT VARCHAR2
    ) IS
    BEGIN
        OPEN P_EMP_CURSOR FOR
            WITH EMP_SCOPE AS (
                SELECT e.EMPID, e.EMPLOYEENAME, d.DEPARTMENT_ID, d.DEPTNAME,
                       e.COM_LOC, e.EMPCATEGORY,
                       PKG_DPR_CALC.FN_DAILY_EXP(e.EMPCATEGORY, e.COM_LOC)   AS DAILY_EXP,
                       PKG_DPR_CALC.FN_WORKING_DAYS_NET(
                           P_DATE_FROM, P_DATE_TO,
                           e.EMPID, e.COM_LOC, e.DOJ,
                           e.EMPCATEGORY)                                    AS WORK_DAYS, -- ## 6DAY
                       PKG_DPR_CALC.FN_LEAVE_DAYS(
                           P_DATE_FROM, P_DATE_TO,
                           e.EMPID, e.COM_LOC, e.DOJ,
                           e.EMPCATEGORY)                                    AS LEAVE_DAYS  -- ## 6DAY
                FROM   TM_DPR_EMPLOYEE_DETAILS e
                JOIN   TM_DEPTMASTER d ON d.DEPTNAME = e.DEPARTMENT AND TRIM(d.IS_ACTIVE) = 'Y'
                WHERE  TRIM(UPPER(e.CURRENTSTATUS)) = 'ACTIVE'
                  AND  TRIM(UPPER(NVL(e.IS_DPR,'N'))) = 'Y'
                  AND  e.EMPLOYEENAME IS NOT NULL
                  AND  (P_DEPT_ID IS NULL OR d.DEPARTMENT_ID = P_DEPT_ID)
                  AND  (P_EMPID   IS NULL OR e.EMPID = P_EMPID)
                  AND  NOT EXISTS (                                          -- exclude HODs
                          SELECT 1 FROM TM_DPR_HOD_MASTER h
                          WHERE  h.EMP_ID = e.EMPID AND TRIM(h.IS_ACTIVE) = 'Y'
                       )
            ),
            LOGS AS (
                SELECT tl.USER_ID, tl.TASK_ID, tl.LOG_DATE, tl.TIME_SPENT_MIN,
                       t.TASK_TITLE, t.CATEGORY_ID, t.PROJECT_ID
                FROM   TS_TMST_TIME_LOG tl
                JOIN   TS_TMST_TASK t ON t.TASK_ID = tl.TASK_ID
                WHERE  t.STATUS <> 'DELETED'
                  AND  tl.LOG_DATE >= TRUNC(P_DATE_FROM)
                  AND  tl.LOG_DATE <  TRUNC(P_DATE_TO) + 1
                  AND  tl.USER_ID IN (SELECT EMPID FROM EMP_SCOPE)
            ),
            -- ## REMARK — one row per daily remark in the period, normalised text
            REMARKS AS (
                SELECT c.USER_ID,
                       c.TASK_ID,
                       TRUNC(c.CREATED_ON) AS RDAY,
                       TRIM(UPPER(CAST(DBMS_LOB.SUBSTR(c.COMMENT_TEXT, 300, 1)
                                       AS VARCHAR2(300)))) AS TXT
                FROM   TS_TMST_COMMENTS c
                WHERE  c.CREATED_ON >= TRUNC(P_DATE_FROM)
                  AND  c.CREATED_ON <  TRUNC(P_DATE_TO) + 1
                  AND  c.USER_ID IN (SELECT EMPID FROM EMP_SCOPE)
            ),
            REMARK_STATS AS (                                             -- ## REMARK
                SELECT USER_ID,
                       COUNT(*)             AS TOTAL_REMARKS,
                       COUNT(DISTINCT RDAY) AS DAYS_WITH_REMARKS,
                       COUNT(DISTINCT TXT)  AS DISTINCT_REMARKS
                FROM   REMARKS
                WHERE  TXT IS NOT NULL AND LENGTH(TXT) >= 3
                GROUP  BY USER_ID
            ),
            CROSS_DUP AS (                                                -- ## REMARK
                -- identical remark text used on MORE THAN ONE task = copy-paste.
                -- (Same text repeated on the SAME task across days is fine.)
                SELECT USER_ID, SUM(CNT) AS CROSSTASK_DUP
                FROM (
                    SELECT USER_ID, TXT, COUNT(*) AS CNT
                    FROM   REMARKS
                    WHERE  TXT IS NOT NULL AND LENGTH(TXT) >= 3
                    GROUP  BY USER_ID, TXT
                    HAVING COUNT(DISTINCT TASK_ID) > 1
                )
                GROUP BY USER_ID
            ),
            AGG AS (
                SELECT es.EMPID, es.EMPLOYEENAME, es.DEPARTMENT_ID, es.DEPTNAME,
                       es.COM_LOC, es.EMPCATEGORY, es.DAILY_EXP, es.WORK_DAYS,
                       es.LEAVE_DAYS,
                       COUNT(DISTINCT l.TASK_ID)                       AS TOTAL_TASKS,
                       ROUND(NVL(SUM(l.TIME_SPENT_MIN),0)/60, 1)       AS TOTAL_HOURS,
                       COUNT(DISTINCT l.LOG_DATE)                      AS DAYS_REPORTED,
                       ROUND(COUNT(DISTINCT l.TASK_ID)
                             / NULLIF(COUNT(DISTINCT l.LOG_DATE),0),1) AS AVG_TASKS_PER_DAY,
                       ROUND(NVL(SUM(l.TIME_SPENT_MIN),0)/60
                             / NULLIF(COUNT(DISTINCT l.LOG_DATE),0),1) AS AVG_HOURS_PER_DAY,
                       COUNT(DISTINCT l.PROJECT_ID)                    AS DISTINCT_PROJECTS,
                       COUNT(DISTINCT l.CATEGORY_ID)                   AS DISTINCT_CATEGORIES,
                       ROUND(es.DAILY_EXP * es.WORK_DAYS, 1)           AS EXPECTED_TOTAL_HOURS,
                       MAX(TRUNC(l.LOG_DATE))                          AS LAST_LOG_DATE
                FROM   EMP_SCOPE es
                LEFT JOIN LOGS l ON l.USER_ID = es.EMPID                     -- LEFT = include non-submitters
                GROUP  BY es.EMPID, es.EMPLOYEENAME, es.DEPARTMENT_ID, es.DEPTNAME,
                          es.COM_LOC, es.EMPCATEGORY, es.DAILY_EXP, es.WORK_DAYS,
                          es.LEAVE_DAYS
            ),
            -- ## REMARK — attach remark metrics + remark score to every employee
            SCORED AS (
                SELECT a.*,
                       NVL(rs.TOTAL_REMARKS, 0)     AS TOTAL_REMARKS,
                       NVL(rs.DAYS_WITH_REMARKS, 0) AS DAYS_WITH_REMARKS,
                       NVL(rs.DISTINCT_REMARKS, 0)  AS DISTINCT_REMARKS,
                       NVL(cd.CROSSTASK_DUP, 0)     AS CROSSTASK_DUP,
                       ROUND(LEAST(NVL(rs.DAYS_WITH_REMARKS,0)
                                   / GREATEST(a.DAYS_REPORTED,1), 1) * 100, 1) AS REMARK_COVERAGE_PCT,
                       ROUND(LEAST(NVL(rs.DAYS_WITH_REMARKS,0)
                                   / GREATEST(a.DAYS_REPORTED,1), 1) * 100
                             * (1 - LEAST(NVL(cd.CROSSTASK_DUP,0)
                                          / GREATEST(NVL(rs.TOTAL_REMARKS,0),1), 0.5)), 1)
                                                                        AS REMARK_SCORE
                FROM   AGG a
                LEFT JOIN REMARK_STATS rs ON rs.USER_ID = a.EMPID
                LEFT JOIN CROSS_DUP    cd ON cd.USER_ID = a.EMPID
            ),
            TASK_DAYS AS (
                SELECT USER_ID, TASK_TITLE, COUNT(DISTINCT LOG_DATE) AS DAYS_ON_TASK
                FROM   LOGS GROUP BY USER_ID, TASK_TITLE
            ),
            TOP_TASK AS (
                SELECT USER_ID,
                       MAX(TASK_TITLE) KEEP (DENSE_RANK FIRST ORDER BY DAYS_ON_TASK DESC) AS TOP_TASK_TITLE,
                       MAX(DAYS_ON_TASK) AS TOP_DAYS
                FROM   TASK_DAYS GROUP BY USER_ID
            ),
            COMMENTS_RANKED AS (
                SELECT c.USER_ID, c.CREATED_ON,
                       TO_CHAR(TRUNC(c.CREATED_ON),'MM-DD') || ': ' ||
                           CAST(DBMS_LOB.SUBSTR(c.COMMENT_TEXT, 200, 1) AS VARCHAR2(250)) AS CMT,
                       ROW_NUMBER() OVER (PARTITION BY c.USER_ID ORDER BY c.CREATED_ON DESC) AS RN
                FROM   TS_TMST_COMMENTS c
                WHERE  TRUNC(c.CREATED_ON) BETWEEN P_DATE_FROM AND P_DATE_TO
            ),
            COMMENTS_AGG AS (
                SELECT USER_ID,
                       LISTAGG(CMT, ' | ' ON OVERFLOW TRUNCATE '...')
                           WITHIN GROUP (ORDER BY CREATED_ON DESC) AS RECENT_COMMENTS
                FROM   COMMENTS_RANKED WHERE RN <= 15 GROUP BY USER_ID
            ),
            RANKED AS (
                SELECT s.*,
                       ROUND(s.TOTAL_HOURS / GREATEST(s.EXPECTED_TOTAL_HOURS,1) * 100, 1) AS FULFIL_PCT,
                       ROUND(s.DAYS_REPORTED / GREATEST(s.WORK_DAYS,1) * 100, 1)          AS CONSISTENCY_PCT,
                       -- ## REMARK — ranking basis: hours 80% (UNCAPPED — extra hours above target raise the score), consistency 10% (cap 100), remarks 10%
                       ROUND(0.8 * (s.TOTAL_HOURS / GREATEST(s.EXPECTED_TOTAL_HOURS,1) * 100)
                           + 0.1 * LEAST(s.DAYS_REPORTED / GREATEST(s.WORK_DAYS,1) * 100, 100)
                           + 0.1 * s.REMARK_SCORE, 1)                                     AS COMPOSITE_SCORE,
                       ROW_NUMBER() OVER (
                           ORDER BY 0.8 * (s.TOTAL_HOURS / GREATEST(s.EXPECTED_TOTAL_HOURS,1) * 100)
                                  + 0.1 * LEAST(s.DAYS_REPORTED / GREATEST(s.WORK_DAYS,1) * 100, 100)
                                  + 0.1 * s.REMARK_SCORE DESC,
                                    s.TOTAL_HOURS DESC, s.EMPLOYEENAME)         AS OVERALL_RANK,
                       ROW_NUMBER() OVER (
                           PARTITION BY s.DEPARTMENT_ID
                           ORDER BY 0.8 * (s.TOTAL_HOURS / GREATEST(s.EXPECTED_TOTAL_HOURS,1) * 100)
                                  + 0.1 * LEAST(s.DAYS_REPORTED / GREATEST(s.WORK_DAYS,1) * 100, 100)
                                  + 0.1 * s.REMARK_SCORE DESC,
                                    s.TOTAL_HOURS DESC, s.EMPLOYEENAME)         AS DEPT_RANK
                FROM   SCORED s
            )
            SELECT r.EMPID               AS EMPID,
                   r.EMPLOYEENAME        AS EMPLOYEENAME,
                   r.DEPARTMENT_ID       AS DEPTID,
                   r.DEPTNAME            AS DEPTNAME,
                   r.EMPCATEGORY         AS EMPCATEGORY,
                   r.COM_LOC             AS LOCATION,
                   r.TOTAL_TASKS         AS TOTALTASKS,
                   r.TOTAL_HOURS         AS TOTALHOURS,
                   r.DAYS_REPORTED       AS DAYSREPORTED,
                   r.WORK_DAYS           AS WORKINGDAYS,
                   r.LEAVE_DAYS          AS LEAVEDAYS,
                   r.DAILY_EXP           AS EXPECTEDDAILYHOURS,
                   r.EXPECTED_TOTAL_HOURS AS EXPECTEDTOTALHOURS,
                   r.FULFIL_PCT          AS FULFILMENTPCT,
                   r.CONSISTENCY_PCT     AS CONSISTENCYPCT,
                   TO_CHAR(r.LAST_LOG_DATE,'YYYY-MM-DD') AS LASTLOGDATE,
                   r.AVG_TASKS_PER_DAY   AS AVGTASKSPERDAY,
                   r.AVG_HOURS_PER_DAY   AS AVGHOURSPERDAY,
                   r.DISTINCT_PROJECTS   AS DISTINCTPROJECTS,
                   r.DISTINCT_CATEGORIES AS DISTINCTCATEGORIES,
                   r.TOTAL_REMARKS       AS TOTALREMARKS,        -- ## REMARK
                   r.DAYS_WITH_REMARKS   AS DAYSWITHREMARKS,     -- ## REMARK
                   r.DISTINCT_REMARKS    AS DISTINCTREMARKS,     -- ## REMARK
                   r.CROSSTASK_DUP       AS CROSSTASKDUPREMARKS, -- ## REMARK
                   r.REMARK_COVERAGE_PCT AS REMARKCOVERAGEPCT,   -- ## REMARK
                   r.REMARK_SCORE        AS REMARKSCORE,         -- ## REMARK
                   r.COMPOSITE_SCORE     AS COMPOSITESCORE,      -- ## REMARK
                   r.OVERALL_RANK        AS OVERALLRANK,
                   r.DEPT_RANK           AS DEPTRANK,
                   tt.TOP_TASK_TITLE     AS TOPREPEATEDTASK,
                   tt.TOP_DAYS           AS TOPREPEATCOUNT,
                   ca.RECENT_COMMENTS    AS RECENTCOMMENTS
            FROM   RANKED r
            LEFT JOIN TOP_TASK     tt ON tt.USER_ID = r.EMPID
            LEFT JOIN COMMENTS_AGG ca ON ca.USER_ID = r.EMPID
            ORDER  BY r.OVERALL_RANK;

        OPEN P_DAILY_CURSOR FOR
            WITH D AS (
                SELECT tl.USER_ID, tl.LOG_DATE, tl.TASK_ID, t.TASK_TITLE,
                       SUM(tl.TIME_SPENT_MIN) AS MINS
                FROM   TS_TMST_TIME_LOG tl
                JOIN   TS_TMST_TASK t ON t.TASK_ID = tl.TASK_ID AND t.STATUS <> 'DELETED'
                JOIN   TM_DPR_EMPLOYEE_DETAILS e ON e.EMPID = tl.USER_ID
                JOIN   TM_DEPTMASTER dm ON dm.DEPTNAME = e.DEPARTMENT
                WHERE  tl.LOG_DATE >= GREATEST(TRUNC(P_DATE_FROM), TRUNC(P_DATE_TO) - 6)
                  AND  tl.LOG_DATE <  TRUNC(P_DATE_TO) + 1
                  AND  (P_DEPT_ID IS NULL OR dm.DEPARTMENT_ID = P_DEPT_ID)
                  AND  (P_EMPID   IS NULL OR tl.USER_ID = P_EMPID)
                  AND  NOT EXISTS (
                          SELECT 1 FROM TM_DPR_HOD_MASTER h
                          WHERE  h.EMP_ID = tl.USER_ID AND TRIM(h.IS_ACTIVE) = 'Y'
                       )
                GROUP  BY tl.USER_ID, tl.LOG_DATE, tl.TASK_ID, t.TASK_TITLE
            )
            SELECT d.USER_ID                         AS EMPID,
                   e.EMPLOYEENAME                    AS EMPLOYEENAME,
                   TO_CHAR(d.LOG_DATE,'YYYY-MM-DD')  AS LOGDATE,
                   COUNT(DISTINCT d.TASK_ID)         AS TASKSWORKED,
                   ROUND(SUM(d.MINS)/60, 1)          AS HOURS,
                   LISTAGG(d.TASK_TITLE, '; ' ON OVERFLOW TRUNCATE '...')
                       WITHIN GROUP (ORDER BY d.TASK_TITLE) AS TASKTITLES
            FROM   D d
            JOIN   TM_DPR_EMPLOYEE_DETAILS e ON e.EMPID = d.USER_ID
            GROUP  BY d.USER_ID, e.EMPLOYEENAME, d.LOG_DATE
            ORDER  BY d.LOG_DATE DESC, e.EMPLOYEENAME;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'AI summary fetched successfully';
    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching AI summary: ' || SQLERRM;
    END SP_GET_DPR_AI_SUMMARY;
    
    
           
    -- ────────────────────────────────────────────────────────────────────────
    PROCEDURE SP_SAVE_MONTHLY_REPORT (
        P_DEPT_ID      IN  NUMBER,
        P_REPORT_MONTH IN  VARCHAR2,
        P_REPORT_TEXT  IN  CLOB,
        P_SUCCESS      OUT VARCHAR2,
        P_MESSAGE      OUT VARCHAR2
    ) IS
    BEGIN
        MERGE INTO TM_AI_MONTHLY_REPORT r
        USING (SELECT P_DEPT_ID AS DEPT_ID, P_REPORT_MONTH AS REPORT_MONTH FROM DUAL) s
           ON (r.DEPT_ID = s.DEPT_ID AND r.REPORT_MONTH = s.REPORT_MONTH)
        WHEN MATCHED THEN UPDATE
             SET r.REPORT_TEXT = P_REPORT_TEXT, r.CREATED_DATE = SYSDATE
        WHEN NOT MATCHED THEN
             INSERT (DEPT_ID, REPORT_MONTH, REPORT_TEXT)
             VALUES (P_DEPT_ID, P_REPORT_MONTH, P_REPORT_TEXT);
        COMMIT;
        P_SUCCESS := 'Y';
        P_MESSAGE := 'Report saved';
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error saving report: ' || SQLERRM;
    END SP_SAVE_MONTHLY_REPORT;

    -- ────────────────────────────────────────────────────────────────────────
    PROCEDURE SP_GET_MONTHLY_REPORT (
        P_DEPT_ID      IN  NUMBER,
        P_REPORT_MONTH IN  VARCHAR2,
        P_CURSOR       OUT SYS_REFCURSOR,
        P_SUCCESS      OUT VARCHAR2,
        P_MESSAGE      OUT VARCHAR2
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT r.REPORT_ID     AS REPORTID,
                   r.DEPT_ID       AS DEPTID,
                   d.DEPTNAME      AS DEPTNAME,
                   r.REPORT_MONTH  AS REPORTMONTH,
                   r.REPORT_TEXT   AS REPORTTEXT,
                   TO_CHAR(r.CREATED_DATE,'YYYY-MM-DD HH24:MI') AS CREATEDDATE
            FROM   TM_AI_MONTHLY_REPORT r
            JOIN   TM_DEPTMASTER d ON d.DEPARTMENT_ID = r.DEPT_ID
            WHERE  (P_DEPT_ID IS NULL OR r.DEPT_ID = P_DEPT_ID)
              AND  (   (P_REPORT_MONTH IS NOT NULL AND r.REPORT_MONTH = P_REPORT_MONTH)
                    OR (P_REPORT_MONTH IS NULL AND r.REPORT_MONTH =
                          (SELECT MAX(r2.REPORT_MONTH) FROM TM_AI_MONTHLY_REPORT r2
                            WHERE r2.DEPT_ID = r.DEPT_ID)) )
            ORDER BY d.DEPTNAME;
        P_SUCCESS := 'Y';
        P_MESSAGE := 'Success';
    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching report: ' || SQLERRM;
    END SP_GET_MONTHLY_REPORT;

    -- ────────────────────────────────────────────────────────────────────────
    PROCEDURE SP_SAVE_CHAT (
        P_SESSION_ID  IN  VARCHAR2,
        P_EMPID       IN  VARCHAR2,
        P_USER_MSG    IN  CLOB,
        P_AI_RESPONSE IN  CLOB,
        P_SUCCESS     OUT VARCHAR2,
        P_MESSAGE     OUT VARCHAR2
    ) IS
    BEGIN
        INSERT INTO TM_AI_CHAT_HISTORY (SESSION_ID, EMPID, USER_MSG, AI_RESPONSE)
        VALUES (P_SESSION_ID, P_EMPID, P_USER_MSG, P_AI_RESPONSE);
        COMMIT;
        P_SUCCESS := 'Y';
        P_MESSAGE := 'Chat saved';
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error saving chat: ' || SQLERRM;
    END SP_SAVE_CHAT;

    -- ────────────────────────────────────────────────────────────────────────
    PROCEDURE SP_GET_CHAT (
        P_SESSION_ID IN  VARCHAR2,
        P_LAST_N     IN  NUMBER DEFAULT 10,
        P_CURSOR     OUT SYS_REFCURSOR,
        P_SUCCESS    OUT VARCHAR2,
        P_MESSAGE    OUT VARCHAR2
    ) IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT USERMSG, AIRESPONSE, CREATEDDATE
            FROM (
                SELECT h.USER_MSG     AS USERMSG,
                       h.AI_RESPONSE  AS AIRESPONSE,
                       TO_CHAR(h.CREATED_DATE,'YYYY-MM-DD HH24:MI') AS CREATEDDATE,
                       h.CHAT_ID      AS CHATID
                FROM   TM_AI_CHAT_HISTORY h
                WHERE  h.SESSION_ID = P_SESSION_ID
                ORDER  BY h.CHAT_ID DESC
                FETCH FIRST NVL(P_LAST_N,10) ROWS ONLY
            )
            ORDER BY CHATID;
        P_SUCCESS := 'Y';
        P_MESSAGE := 'Success';
    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching chat: ' || SQLERRM;
    END SP_GET_CHAT;

END PKG_AI_INSIGHTS;
/

------------------------------------------------------------------------------
-- VERIFY — both of these must now fail with PLS-00302 (component must be
-- declared), proving the stale copies are gone and only PKG_DPR_CALC remains:
--
--   SELECT PKG_AI_INSIGHTS.FN_DAILY_EXP('STAFF','IND') FROM DUAL;
--   SELECT PKG_AI_INSIGHTS.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'IND') FROM DUAL;
--
-- And the report itself must still work (it uses PKG_DPR_CALC):
--
--   VAR e REFCURSOR
--   VAR d REFCURSOR
--   DECLARE s VARCHAR2(1); m VARCHAR2(500);
--   BEGIN
--     PKG_AI_INSIGHTS.SP_GET_DPR_AI_SUMMARY(NULL, NULL,
--        DATE '2026-07-01', DATE '2026-07-28', :e, :d, s, m);
--     DBMS_OUTPUT.PUT_LINE(s || ' ' || m);
--   END;
--   /
------------------------------------------------------------------------------
