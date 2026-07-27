------------------------------------------------------------------------------
-- 04_pkg_ai_insights_leave_change.sql
-- FULL replacement for PKG_AI_INSIGHTS.SP_GET_DPR_AI_SUMMARY.
-- Paste this PROCEDURE over the existing one inside the PKG_AI_INSIGHTS body.
--
-- Requires 02_pkg_dpr_calc.sql (FN_LEAVE_DAYS / FN_WORKING_DAYS_NET) first.
--
-- Changes vs current version (marked -- ## LEAVE / -- ## FIX):
--   * WORK_DAYS is now NET of approved leave (FN_WORKING_DAYS_NET), so
--     EXPECTED_TOTAL_HOURS, FULFIL_PCT, CONSISTENCY_PCT and both ranks are
--     automatically leave-aware.
--   * LEAVE_DAYS exposed per employee (LEAVEDAYS column) for the AI prompt.
--   * LOGS date filter made sargable / end-of-day safe.
------------------------------------------------------------------------------

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
                       PKG_DPR_CALC.FN_WORKING_DAYS_NET(                     -- ## LEAVE
                           P_DATE_FROM, P_DATE_TO,
                           e.EMPID, e.COM_LOC, e.DOJ)                        AS WORK_DAYS,
                       PKG_DPR_CALC.FN_LEAVE_DAYS(                           -- ## LEAVE
                           P_DATE_FROM, P_DATE_TO,
                           e.EMPID, e.COM_LOC, e.DOJ)                        AS LEAVE_DAYS
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
                  AND  tl.LOG_DATE >= TRUNC(P_DATE_FROM)                     -- ## FIX sargable,
                  AND  tl.LOG_DATE <  TRUNC(P_DATE_TO) + 1                   -- ## FIX whole last day
                  AND  tl.USER_ID IN (SELECT EMPID FROM EMP_SCOPE)
            ),
            AGG AS (
                SELECT es.EMPID, es.EMPLOYEENAME, es.DEPARTMENT_ID, es.DEPTNAME,
                       es.COM_LOC, es.EMPCATEGORY, es.DAILY_EXP, es.WORK_DAYS,
                       es.LEAVE_DAYS,                                        -- ## LEAVE
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
                          es.LEAVE_DAYS                                      -- ## LEAVE
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
                SELECT a.*,
                       ROUND(a.TOTAL_HOURS / GREATEST(a.EXPECTED_TOTAL_HOURS,1) * 100, 1) AS FULFIL_PCT,
                       ROUND(a.DAYS_REPORTED / GREATEST(a.WORK_DAYS,1) * 100, 1)          AS CONSISTENCY_PCT,
                       ROW_NUMBER() OVER (
                           ORDER BY a.TOTAL_HOURS / GREATEST(a.EXPECTED_TOTAL_HOURS,1) DESC,
                                    a.TOTAL_HOURS DESC, a.EMPLOYEENAME)         AS OVERALL_RANK,
                       ROW_NUMBER() OVER (
                           PARTITION BY a.DEPARTMENT_ID
                           ORDER BY a.TOTAL_HOURS / GREATEST(a.EXPECTED_TOTAL_HOURS,1) DESC,
                                    a.TOTAL_HOURS DESC, a.EMPLOYEENAME)         AS DEPT_RANK
                FROM   AGG a
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
                   r.LEAVE_DAYS          AS LEAVEDAYS,                       -- ## LEAVE
                   r.DAILY_EXP           AS EXPECTEDDAILYHOURS,
                   r.EXPECTED_TOTAL_HOURS AS EXPECTEDTOTALHOURS,
                   r.FULFIL_PCT          AS FULFILMENTPCT,
                   r.CONSISTENCY_PCT     AS CONSISTENCYPCT,
                   TO_CHAR(r.LAST_LOG_DATE,'YYYY-MM-DD') AS LASTLOGDATE,
                   r.AVG_TASKS_PER_DAY   AS AVGTASKSPERDAY,
                   r.AVG_HOURS_PER_DAY   AS AVGHOURSPERDAY,
                   r.DISTINCT_PROJECTS   AS DISTINCTPROJECTS,
                   r.DISTINCT_CATEGORIES AS DISTINCTCATEGORIES,
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
                WHERE  tl.LOG_DATE >= GREATEST(TRUNC(P_DATE_FROM), TRUNC(P_DATE_TO) - 6)  -- ## FIX
                  AND  tl.LOG_DATE <  TRUNC(P_DATE_TO) + 1                                -- ## FIX
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
