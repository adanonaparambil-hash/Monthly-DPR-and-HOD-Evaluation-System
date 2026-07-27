------------------------------------------------------------------------------
-- 06_sp_dpr_ai_summary_remark_quality.sql
-- FULL replacement for PKG_AI_INSIGHTS.SP_GET_DPR_AI_SUMMARY.
-- Paste over the existing procedure inside the PKG_AI_INSIGHTS body.
-- Supersedes 04 (includes its leave-aware WORK_DAYS changes).
--
-- NEW (marked -- ## REMARK):
--   ** v2 (27-Jul-2026): task DESCRIPTION now counts as a partial-credit
--      fallback when a day has no daily remark. Re-run this script if you
--      deployed v1. **
--
--   Per-employee work-documentation quality metrics:
--     TOTAL_REMARKS        — remark rows in the period (TS_TMST_COMMENTS)
--     DAYS_WITH_REMARKS    — distinct days that have at least one daily remark
--     DAYS_DESC_ONLY       — days with NO daily remark but a substantial task
--                            DESCRIPTION (>= 25 chars) on the task(s) logged
--                            that day → counted at PARTIAL weight
--     DISTINCT_REMARKS     — distinct remark texts (first 300 chars)
--     CROSSTASK_DUP        — remarks whose identical text appears on 2+
--                            DIFFERENT tasks (copy-paste). Repeating the same
--                            remark on the SAME continuing task is NOT counted
--                            (management rule: no repetition penalty).
--     REMARK_COVERAGE_PCT  — documented days / days-reported (capped 100), where
--                            documented = days_with_remarks
--                                       + 0.6 * days_with_description_only.
--                            A daily remark is the required form of reporting;
--                            a detailed description is accepted as a weaker
--                            substitute; neither present scores 0 for that day.
--     REMARK_SCORE         — coverage reduced by the cross-task copy-paste
--                            share (max 50% reduction)
--   COMPOSITE_SCORE (0-110) — the ranking basis:
--     0.6 × min(FulfilmentPct,110) + 0.2 × min(ConsistencyPct,100) + 0.2 × RemarkScore
--   OVERALL_RANK / DEPT_RANK now order by COMPOSITE_SCORE (was fulfilment-only).
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
                       PKG_DPR_CALC.FN_WORKING_DAYS_NET(
                           P_DATE_FROM, P_DATE_TO,
                           e.EMPID, e.COM_LOC, e.DOJ)                        AS WORK_DAYS,
                       PKG_DPR_CALC.FN_LEAVE_DAYS(
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
            -- ## DESC — days where the employee logged a task carrying a
            -- substantial DESCRIPTION (>= 25 chars). DBMS_LOB.GETLENGTH keeps
            -- this cheap and avoids any CLOB→VARCHAR2 conversion.
            DESC_DAYS AS (
                SELECT tl.USER_ID, TRUNC(tl.LOG_DATE) AS RDAY
                FROM   TS_TMST_TIME_LOG tl
                JOIN   TS_TMST_TASK t ON t.TASK_ID = tl.TASK_ID AND t.STATUS <> 'DELETED'
                WHERE  tl.LOG_DATE >= TRUNC(P_DATE_FROM)
                  AND  tl.LOG_DATE <  TRUNC(P_DATE_TO) + 1
                  AND  tl.USER_ID IN (SELECT EMPID FROM EMP_SCOPE)
                  AND  NVL(DBMS_LOB.GETLENGTH(t.DESCRIPTION), 0) >= 25
                GROUP  BY tl.USER_ID, TRUNC(tl.LOG_DATE)
            ),
            -- ## DESC — of those, the days with NO daily remark at all. These are
            -- the "description instead of a daily remark" days → partial credit.
            DESC_ONLY AS (
                SELECT dd.USER_ID, COUNT(*) AS DAYS_DESC_ONLY
                FROM   DESC_DAYS dd
                WHERE  NOT EXISTS (
                           SELECT 1 FROM REMARKS r
                            WHERE r.USER_ID = dd.USER_ID
                              AND r.RDAY    = dd.RDAY
                              AND r.TXT IS NOT NULL
                              AND LENGTH(r.TXT) >= 3
                       )
                GROUP  BY dd.USER_ID
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
            -- ## REMARK — attach documentation metrics + score to every employee.
            -- Documented days = full credit for a daily remark, 0.6 credit for a
            -- day documented only by a substantial task description. Daily remarks
            -- remain the required form; descriptions are a weaker substitute.
            SCORED AS (
                SELECT a.*,
                       NVL(rs.TOTAL_REMARKS, 0)     AS TOTAL_REMARKS,
                       NVL(rs.DAYS_WITH_REMARKS, 0) AS DAYS_WITH_REMARKS,
                       NVL(rs.DISTINCT_REMARKS, 0)  AS DISTINCT_REMARKS,
                       NVL(do.DAYS_DESC_ONLY, 0)    AS DAYS_DESC_ONLY,      -- ## DESC
                       NVL(cd.CROSSTASK_DUP, 0)     AS CROSSTASK_DUP,
                       ROUND(LEAST((NVL(rs.DAYS_WITH_REMARKS,0)
                                    + 0.6 * NVL(do.DAYS_DESC_ONLY,0))
                                   / GREATEST(a.DAYS_REPORTED,1), 1) * 100, 1)
                                                                        AS REMARK_COVERAGE_PCT,
                       ROUND(LEAST((NVL(rs.DAYS_WITH_REMARKS,0)
                                    + 0.6 * NVL(do.DAYS_DESC_ONLY,0))
                                   / GREATEST(a.DAYS_REPORTED,1), 1) * 100
                             * (1 - LEAST(NVL(cd.CROSSTASK_DUP,0)
                                          / GREATEST(NVL(rs.TOTAL_REMARKS,0),1), 0.5)), 1)
                                                                        AS REMARK_SCORE
                FROM   AGG a
                LEFT JOIN REMARK_STATS rs ON rs.USER_ID = a.EMPID
                LEFT JOIN CROSS_DUP    cd ON cd.USER_ID = a.EMPID
                LEFT JOIN DESC_ONLY    do ON do.USER_ID = a.EMPID          -- ## DESC
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
                       -- ## REMARK — the ranking basis: hours 60%, consistency 20%, remarks 20%
                       ROUND(0.6 * LEAST(s.TOTAL_HOURS / GREATEST(s.EXPECTED_TOTAL_HOURS,1) * 100, 110)
                           + 0.2 * LEAST(s.DAYS_REPORTED / GREATEST(s.WORK_DAYS,1) * 100, 100)
                           + 0.2 * s.REMARK_SCORE, 1)                                     AS COMPOSITE_SCORE,
                       ROW_NUMBER() OVER (
                           ORDER BY 0.6 * LEAST(s.TOTAL_HOURS / GREATEST(s.EXPECTED_TOTAL_HOURS,1) * 100, 110)
                                  + 0.2 * LEAST(s.DAYS_REPORTED / GREATEST(s.WORK_DAYS,1) * 100, 100)
                                  + 0.2 * s.REMARK_SCORE DESC,
                                    s.TOTAL_HOURS DESC, s.EMPLOYEENAME)         AS OVERALL_RANK,
                       ROW_NUMBER() OVER (
                           PARTITION BY s.DEPARTMENT_ID
                           ORDER BY 0.6 * LEAST(s.TOTAL_HOURS / GREATEST(s.EXPECTED_TOTAL_HOURS,1) * 100, 110)
                                  + 0.2 * LEAST(s.DAYS_REPORTED / GREATEST(s.WORK_DAYS,1) * 100, 100)
                                  + 0.2 * s.REMARK_SCORE DESC,
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
                   r.DAYS_DESC_ONLY      AS DAYSDESCONLY,        -- ## DESC
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

------------------------------------------------------------------------------
-- VERIFY before deploying (run standalone):
-- 1. Column names on the comments table (code assumes USER_ID, TASK_ID,
--    COMMENT_TEXT CLOB, CREATED_ON):
--      SELECT column_name, data_type FROM all_tab_columns
--       WHERE table_name = 'TS_TMST_COMMENTS' ORDER BY column_id;
-- 2. Spot-check one employee's metrics vs raw remarks:
--      SELECT TRUNC(CREATED_ON), TASK_ID,
--             DBMS_LOB.SUBSTR(COMMENT_TEXT,80,1)
--        FROM TS_TMST_COMMENTS WHERE USER_ID = 'ITS48'
--         AND CREATED_ON >= DATE '2026-07-01' ORDER BY CREATED_ON;
------------------------------------------------------------------------------
