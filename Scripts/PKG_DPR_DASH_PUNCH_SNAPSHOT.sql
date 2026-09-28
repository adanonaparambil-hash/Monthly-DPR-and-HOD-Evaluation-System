CREATE OR REPLACE PACKAGE BODY PKG_DPR_DASH AS

    ------------------------------------------------------------------
    -- ## MEMO state — see the note in the package spec.
    -- Session-scoped (UGA). Reset at the top of every HOD request, so a
    -- pooled connection can never serve a previous request's month.
    ------------------------------------------------------------------
    TYPE T_CALC_REC IS RECORD (
        DAILY_EXP    NUMBER,
        WORK_DAYS    NUMBER,
        EXPECTED_HRS NUMBER,
        LEAVE_TODAY  NUMBER
    );
    TYPE T_CALC_MAP IS TABLE OF T_CALC_REC INDEX BY VARCHAR2(64);

    g_calc      T_CALC_MAP;
    g_calc_from DATE;
    g_calc_to   DATE;
    g_calc_day  DATE;

    PROCEDURE CALC_RESET (P_FROM IN DATE, P_TO IN DATE, P_TODAY IN DATE) IS
    BEGIN
        g_calc.DELETE;
        g_calc_from := P_FROM;
        g_calc_to   := P_TO;
        g_calc_day  := P_TODAY;
    END CALC_RESET;

    -- The one place the expensive functions actually run. Everything else
    -- reads this map.
    FUNCTION CALC_FOR (P_EMPID    IN VARCHAR2, P_COM_LOC IN VARCHAR2,
                       P_CATEGORY IN VARCHAR2, P_DOJ     IN DATE)
        RETURN T_CALC_REC IS
        r   T_CALC_REC;
        k   VARCHAR2(64) := NVL(P_EMPID, '~');
    BEGIN
        IF g_calc.EXISTS(k) THEN
            RETURN g_calc(k);
        END IF;

        r.DAILY_EXP    := PKG_DPR_CALC.FN_DAILY_EXP(P_CATEGORY, P_COM_LOC);
        r.WORK_DAYS    := PKG_DPR_CALC.FN_WORKING_DAYS_NET(
                              g_calc_from, g_calc_to, P_EMPID, P_COM_LOC, P_DOJ, P_CATEGORY);
        r.EXPECTED_HRS := ROUND(r.DAILY_EXP * r.WORK_DAYS, 1);
        r.LEAVE_TODAY  := PKG_DPR_CALC.FN_LEAVE_DAYS(
                              g_calc_day, g_calc_day, P_EMPID, P_COM_LOC, P_DOJ, P_CATEGORY);

        g_calc(k) := r;
        RETURN r;
    END CALC_FOR;

    FUNCTION FN_C_EXP_HRS (P_EMPID    IN VARCHAR2, P_COM_LOC IN VARCHAR2,
                           P_CATEGORY IN VARCHAR2, P_DOJ     IN DATE) RETURN NUMBER IS
        r T_CALC_REC;
    BEGIN
        r := CALC_FOR(P_EMPID, P_COM_LOC, P_CATEGORY, P_DOJ);
        RETURN r.EXPECTED_HRS;
    END FN_C_EXP_HRS;

    FUNCTION FN_C_WORK_DAYS (P_EMPID    IN VARCHAR2, P_COM_LOC IN VARCHAR2,
                             P_CATEGORY IN VARCHAR2, P_DOJ     IN DATE) RETURN NUMBER IS
        r T_CALC_REC;
    BEGIN
        r := CALC_FOR(P_EMPID, P_COM_LOC, P_CATEGORY, P_DOJ);
        RETURN r.WORK_DAYS;
    END FN_C_WORK_DAYS;

    FUNCTION FN_C_DAILY_EXP (P_EMPID    IN VARCHAR2, P_COM_LOC IN VARCHAR2,
                             P_CATEGORY IN VARCHAR2, P_DOJ     IN DATE) RETURN NUMBER IS
        r T_CALC_REC;
    BEGIN
        r := CALC_FOR(P_EMPID, P_COM_LOC, P_CATEGORY, P_DOJ);
        RETURN r.DAILY_EXP;
    END FN_C_DAILY_EXP;

    FUNCTION FN_C_LEAVE_TODAY (P_EMPID    IN VARCHAR2, P_COM_LOC IN VARCHAR2,
                               P_CATEGORY IN VARCHAR2, P_DOJ     IN DATE) RETURN NUMBER IS
        r T_CALC_REC;
    BEGIN
        r := CALC_FOR(P_EMPID, P_COM_LOC, P_CATEGORY, P_DOJ);
        RETURN r.LEAVE_TODAY;
    END FN_C_LEAVE_TODAY;

    ------------------------------------------------------------------
    -- Private copy of PKG_TMST_TASK's FN_GET_USER_TIME (that one is
    -- body-private and cannot be called from here).
    ------------------------------------------------------------------
    FUNCTION FN_USER_TIME (P_EMPID IN VARCHAR2) RETURN TIMESTAMP IS
        V_OFFSET_MIN NUMBER;
    BEGIN
        SELECT TZ.OFFSET_MIN
          INTO V_OFFSET_MIN
          FROM TM_DPR_EMPLOYEE_DETAILS EMP
          JOIN TM_TIMEZONE_MASTER TZ ON EMP.COM_LOC = TZ.TZ_CODE
         WHERE EMP.EMPID = P_EMPID
           AND TZ.IS_ACTIVE = 'Y';
        RETURN SYSTIMESTAMP + NUMTODSINTERVAL(V_OFFSET_MIN, 'MINUTE');
    EXCEPTION
        WHEN NO_DATA_FOUND THEN RETURN SYSTIMESTAMP;
        WHEN TOO_MANY_ROWS THEN RETURN SYSTIMESTAMP;
    END FN_USER_TIME;

    -- ==================================================================
    -- EMPLOYEE DASHBOARD
    -- ==================================================================
    PROCEDURE SP_GET_EMP_DASHBOARD (
        P_EMPID        IN  VARCHAR2,
        P_MONTH        IN  NUMBER   DEFAULT NULL,
        P_YEAR         IN  NUMBER   DEFAULT NULL,
        P_CUR_HERO     OUT SYS_REFCURSOR,
        P_CUR_TILES    OUT SYS_REFCURSOR,
        P_CUR_TIMELINE OUT SYS_REFCURSOR,
        P_CUR_WEEK     OUT SYS_REFCURSOR,
        P_CUR_MONTH_CAL OUT SYS_REFCURSOR,
        P_CUR_MY_TASKS OUT SYS_REFCURSOR,
        P_CUR_EST_ACT  OUT SYS_REFCURSOR,
        P_CUR_MY_FORMS OUT SYS_REFCURSOR,
        P_SUCCESS      OUT VARCHAR2,
        P_MESSAGE      OUT VARCHAR2
    ) IS
        v_now        TIMESTAMP;
        v_today      DATE;
        v_mstart     DATE;
        v_mend       DATE;   -- full month end
        v_mend_td    DATE;   -- month end capped at today ("to date")
        v_loc        TM_DPR_EMPLOYEE_DETAILS.COM_LOC%TYPE;
        v_cat        TM_DPR_EMPLOYEE_DETAILS.EMPCATEGORY%TYPE;
        v_doj        DATE;
        v_daily_exp  NUMBER := 0;
        v_wd_net     NUMBER := 0;   -- net working days to date
        v_leave      NUMBER := 0;   -- leave days to date
        v_wd_net_full NUMBER := 0;  -- net working days full month
        v_exp_td     NUMBER := 0;   -- expected hours to date
        v_exp_full   NUMBER := 0;   -- expected hours full month
        v_leave_today NUMBER := 0;
        v_gross_today NUMBER := 0;  -- >0 = today is a working day (gross)
    BEGIN
        v_now   := FN_USER_TIME(P_EMPID);
        v_today := TRUNC(v_now);

        IF P_MONTH IS NULL OR P_YEAR IS NULL THEN
            v_mstart := TRUNC(v_now, 'MM');
        ELSE
            v_mstart := TO_DATE(P_YEAR || '-' || P_MONTH || '-01', 'YYYY-MM-DD');
        END IF;
        v_mend    := LAST_DAY(v_mstart);
        v_mend_td := LEAST(v_mend, v_today);
        IF v_mstart > v_today THEN
            v_mend_td := v_mstart - 1;   -- future month => zero expectation
        END IF;

        SELECT e.COM_LOC, e.EMPCATEGORY, e.DOJ
          INTO v_loc, v_cat, v_doj
          FROM TM_DPR_EMPLOYEE_DETAILS e
         WHERE e.EMPID = P_EMPID;

        v_daily_exp   := PKG_DPR_CALC.FN_DAILY_EXP(v_cat, v_loc);
        v_wd_net      := PKG_DPR_CALC.FN_WORKING_DAYS_NET(v_mstart, v_mend_td, P_EMPID, v_loc, v_doj, v_cat);
        v_leave       := PKG_DPR_CALC.FN_LEAVE_DAYS     (v_mstart, v_mend_td, P_EMPID, v_loc, v_doj, v_cat);
        v_wd_net_full := PKG_DPR_CALC.FN_WORKING_DAYS_NET(v_mstart, v_mend,    P_EMPID, v_loc, v_doj, v_cat);
        v_exp_td      := ROUND(v_daily_exp * v_wd_net, 1);
        v_exp_full    := ROUND(v_daily_exp * v_wd_net_full, 1);
        v_leave_today := PKG_DPR_CALC.FN_LEAVE_DAYS(v_today, v_today, P_EMPID, v_loc, v_doj, v_cat);
        v_gross_today := PKG_DPR_CALC.FN_WORKING_DAYS_NET(v_today, v_today, P_EMPID, v_loc, v_doj, v_cat)
                         + v_leave_today;

        ------------------------------------------------------------------
        -- 1. HERO — single row
        ------------------------------------------------------------------
        OPEN P_CUR_HERO FOR
            SELECT e.EMPID                                        AS EmpId,
                   e.EMPLOYEENAME                                 AS EmployeeName,
                   e.DEPARTMENT                                   AS Department,
                   e.DESIGNATION                                  AS Designation,
                   e.COM_LOC                                      AS Location,
                   v_daily_exp                                    AS ExpectedDailyHours,
                   CASE WHEN v_gross_today > 0 THEN 'Y' ELSE 'N' END AS IsWorkingDayToday,
                   CASE WHEN v_leave_today > 0 THEN 'Y' ELSE 'N' END AS OnLeaveToday,
                   -- minutes logged today (running timers counted live)
                   NVL((SELECT SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                        THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                        ELSE NVL(tl.TIME_SPENT_MIN, 0) END)
                          FROM TS_TMST_TIME_LOG tl
                          JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                         WHERE tl.USER_ID  = P_EMPID
                           AND tl.LOG_DATE >= v_today
                           AND tl.LOG_DATE <  v_today + 1), 0)    AS TodayLoggedMin,
                   NVL((SELECT COUNT(DISTINCT tl.TASK_ID)
                          FROM TS_TMST_TIME_LOG tl
                          JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                         WHERE tl.USER_ID  = P_EMPID
                           AND tl.LOG_DATE >= v_today
                           AND tl.LOG_DATE <  v_today + 1), 0)    AS TasksToday,
                   run.TASK_ID                                    AS RunningTaskId,
                   run.TASK_TITLE                                 AS RunningTaskTitle,
                   TO_CHAR(run.START_TIME, 'HH24:MI')             AS RunningSince,
                   brk.BREAK_REASOR                               AS OpenBreakReason,
                   TO_CHAR(brk.BREAK_START, 'HH24:MI')            AS OpenBreakSince,
                   p.FIRST_PUNCH                                  AS FirstPunch,
                   p.LAST_PUNCH                                   AS LastPunch,
                   NVL(p.PUNCH_COUNT, 0)                          AS PunchCount,
                   p.PUNCH_TIMES                                  AS PunchTimes,
                   NVL(bm.BREAK_MIN, 0)                           AS BreakMinToday,
                   NVL(bm.TRAVEL_MIN, 0)                          AS TravelMinToday,
                   q.QUOTETEXT                                    AS QuoteText,
                   q.AUTHOR                                       AS QuoteAuthor
              FROM TM_DPR_EMPLOYEE_DETAILS e
              -- ## TODAY — a timer left OPEN on a previous day must NOT be reported as
              -- "running now": its HH24:MI would belong to another date.
              LEFT JOIN (SELECT tl.TASK_ID, tk.TASK_TITLE, tl.START_TIME
                           FROM TS_TMST_TIME_LOG tl
                           JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                          WHERE tl.USER_ID = P_EMPID AND tl.LOG_STATUS = 'OPEN'
                            AND tl.START_TIME >= v_today
                            AND tl.START_TIME <  v_today + 1
                          ORDER BY tl.START_TIME DESC
                          FETCH FIRST 1 ROW ONLY) run ON 1 = 1
              LEFT JOIN (SELECT b.BREAK_REASOR, b.BREAK_START
                           FROM TS_TMST_BREAK_LOG b
                          WHERE b.USER_ID = P_EMPID AND b.STATUS IN ('OPEN', 'PAUSED')
                            AND b.BREAK_START >= v_today
                            AND b.BREAK_START <  v_today + 1
                          ORDER BY b.BREAK_START DESC
                          FETCH FIRST 1 ROW ONLY) brk ON 1 = 1
              LEFT JOIN (SELECT MIN(SUBSTR(pp.PUNCHTIME, 1, 5)) AS FIRST_PUNCH,
                                MAX(SUBSTR(pp.PUNCHTIME, 1, 5)) AS LAST_PUNCH,
                                COUNT(*)                        AS PUNCH_COUNT,
                                LISTAGG(SUBSTR(pp.PUNCHTIME, 1, 5), ', '
                                        ON OVERFLOW TRUNCATE '...')
                                    WITHIN GROUP (ORDER BY pp.PUNCHTIME) AS PUNCH_TIMES
                           FROM TM_DPR_PUNCH_SNAPSHOT pp
                          WHERE pp.EMPID = P_EMPID
                            AND pp.PUNCHDATE >= v_today
                            AND pp.PUNCHDATE <  v_today + 1) p ON 1 = 1
              LEFT JOIN (SELECT SUM(CASE WHEN UPPER(b.BREAK_REASOR) IN ('LUNCH', 'QUICK')
                                         THEN ROUND((CAST(NVL(b.BREAK_END, v_now) AS DATE)
                                                   - CAST(b.BREAK_START AS DATE)) * 1440) END) AS BREAK_MIN,
                                SUM(CASE WHEN UPPER(b.BREAK_REASOR) = 'TRAVEL'
                                         THEN ROUND((CAST(NVL(b.BREAK_END, v_now) AS DATE)
                                                   - CAST(b.BREAK_START AS DATE)) * 1440) END) AS TRAVEL_MIN
                           FROM TS_TMST_BREAK_LOG b
                          WHERE b.USER_ID = P_EMPID
                            AND b.BREAK_DATE >= v_today
                            AND b.BREAK_DATE <  v_today + 1) bm ON 1 = 1
              LEFT JOIN (SELECT QUOTETEXT, AUTHOR
                           FROM (SELECT QUOTETEXT, AUTHOR
                                   FROM TM_MOTIVATIONQUOTES
                                  ORDER BY DBMS_RANDOM.VALUE)
                          WHERE ROWNUM = 1) q ON 1 = 1
             WHERE e.EMPID = P_EMPID;

        ------------------------------------------------------------------
        -- 2. TILES — single row of month KPIs
        ------------------------------------------------------------------
        OPEN P_CUR_TILES FOR
            WITH ML AS (
                SELECT NVL(SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                    THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                    ELSE NVL(tl.TIME_SPENT_MIN, 0) END), 0) AS MINS,
                       COUNT(DISTINCT TRUNC(tl.LOG_DATE))                   AS DAYS_REPORTED
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK t ON t.TASK_ID = tl.TASK_ID AND t.STATUS <> 'DELETED'
                 WHERE tl.USER_ID  = P_EMPID
                   AND tl.LOG_DATE >= v_mstart
                   AND tl.LOG_DATE <  v_mend + 1
            )
            SELECT TO_CHAR(v_mstart, 'YYYY-MM')                       AS MonthKey,
                   ROUND(ML.MINS / 60, 1)                             AS MonthHours,
                   ML.DAYS_REPORTED                                   AS DaysReported,
                   v_wd_net                                           AS WorkingDaysToDate,
                   v_wd_net_full                                      AS WorkingDaysFullMonth,
                   v_leave                                            AS LeaveDays,
                   v_exp_td                                           AS ExpectedHoursToDate,
                   v_exp_full                                         AS ExpectedHoursFullMonth,
                   ROUND(ML.MINS / 60 / GREATEST(v_exp_td, 1) * 100, 1) AS FulfilPct,
                   ROUND(ML.DAYS_REPORTED / GREATEST(v_wd_net, 1) * 100, 1) AS ConsistencyPct,
                   (SELECT COUNT(*)
                      FROM TS_TMST_TASK_ASSIGNEE ta
                      JOIN TS_TMST_TASK t ON t.TASK_ID = ta.TASK_ID AND t.STATUS <> 'DELETED'
                     WHERE ta.USER_ID = P_EMPID
                       AND UPPER(NVL(ta.STATUS, 'OPEN')) IN ('OPEN', 'RUNNING', 'PAUSED')) AS OpenTasks,
                   (SELECT COUNT(*)
                      FROM TS_TMST_TASK_APPROVAL a
                     WHERE a.USER_ID = P_EMPID
                       AND a.APPROVAL_STATUS = 'PENDING'
                       AND EXISTS (SELECT 1 FROM TS_TMST_TASK tk
                                    WHERE tk.TASK_ID = a.TASK_ID
                                      AND tk.STATUS <> 'DELETED'))    AS MyLogsAwaitingApproval,
                   (SELECT COUNT(*)
                      FROM TS_EMP_EXIT_APPROVAL ap
                      JOIN TS_EMPLOYEE_EXIT ex ON ex.EXIT_ID = ap.EXIT_ID
                     WHERE ap.APPROVER_ID = P_EMPID
                       AND ap.APPROVAL_STATUS = 'P'
                       AND ex.APPROVAL_STATUS <> 'R'
                       AND ap.APPROVAL_LEVEL = (SELECT MIN(a2.APPROVAL_LEVEL)
                                                  FROM TS_EMP_EXIT_APPROVAL a2
                                                 WHERE a2.EXIT_ID = ap.EXIT_ID
                                                   AND a2.APPROVAL_STATUS = 'P')) AS FormApprovalsWaitingMe
              FROM ML;

        ------------------------------------------------------------------
        -- 3. TIMELINE — today's work + break segments, chronological
        ------------------------------------------------------------------
        OPEN P_CUR_TIMELINE FOR
            SELECT SegType, Label, StartTime, EndTime, Minutes, IsRunning
              FROM (
                SELECT 'WORK'                                       AS SegType,
                       tk.TASK_TITLE                                 AS Label,
                       TO_CHAR(tl.START_TIME, 'HH24:MI')             AS StartTime,
                       CASE WHEN tl.END_TIME IS NULL THEN NULL
                            ELSE TO_CHAR(tl.END_TIME, 'HH24:MI') END AS EndTime,
                       CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                            THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                            ELSE NVL(tl.TIME_SPENT_MIN, 0) END       AS Minutes,
                       CASE WHEN tl.LOG_STATUS = 'OPEN' THEN 'Y' ELSE 'N' END AS IsRunning,
                       CAST(tl.START_TIME AS DATE)                   AS SORT_TS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.USER_ID = P_EMPID
                   AND tl.START_TIME >= v_today
                   AND tl.START_TIME <  v_today + 1
                UNION ALL
                SELECT 'BREAK',
                       INITCAP(NVL(b.BREAK_REASOR, 'Break')),
                       TO_CHAR(b.BREAK_START, 'HH24:MI'),
                       CASE WHEN b.BREAK_END IS NULL THEN NULL
                            ELSE TO_CHAR(b.BREAK_END, 'HH24:MI') END,
                       GREATEST(ROUND((CAST(NVL(b.BREAK_END, v_now) AS DATE)
                                     - CAST(b.BREAK_START AS DATE)) * 1440), 0),
                       CASE WHEN b.BREAK_END IS NULL AND b.STATUS IN ('OPEN', 'PAUSED')
                            THEN 'Y' ELSE 'N' END,
                       CAST(b.BREAK_START AS DATE)
                  FROM TS_TMST_BREAK_LOG b
                 WHERE b.USER_ID = P_EMPID
                   AND b.BREAK_DATE >= v_today
                   AND b.BREAK_DATE <  v_today + 1
              )
             ORDER BY SORT_TS;

        ------------------------------------------------------------------
        -- 4. WEEK — last 7 days incl. today
        ------------------------------------------------------------------
        OPEN P_CUR_WEEK FOR
            WITH DAYS AS (
                SELECT v_today - 7 + LEVEL AS DT
                  FROM DUAL CONNECT BY LEVEL <= 7
            ),
            LOGD AS (
                SELECT TRUNC(tl.LOG_DATE) AS D,
                       SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                ELSE NVL(tl.TIME_SPENT_MIN, 0) END) AS MINS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.USER_ID  = P_EMPID
                   AND tl.LOG_DATE >= v_today - 6
                   AND tl.LOG_DATE <  v_today + 1
                 GROUP BY TRUNC(tl.LOG_DATE)
            )
            SELECT TO_CHAR(d.DT, 'YYYY-MM-DD')                              AS TheDate,
                   TO_CHAR(d.DT, 'DY', 'NLS_DATE_LANGUAGE=ENGLISH')         AS DayName,
                   ROUND(NVL(l.MINS, 0) / 60, 2)                            AS Hours,
                   CASE WHEN PKG_DPR_CALC.FN_WORKING_DAYS_NET(d.DT, d.DT, P_EMPID, v_loc, v_doj, v_cat)
                           + PKG_DPR_CALC.FN_LEAVE_DAYS(d.DT, d.DT, P_EMPID, v_loc, v_doj, v_cat) > 0
                        THEN 'Y' ELSE 'N' END                               AS IsWorkingDay,
                   CASE WHEN PKG_DPR_CALC.FN_LEAVE_DAYS(d.DT, d.DT, P_EMPID, v_loc, v_doj, v_cat) > 0
                        THEN 'Y' ELSE 'N' END                               AS OnLeave,
                   CASE WHEN d.DT = v_today THEN 'Y' ELSE 'N' END           AS IsToday,
                   v_daily_exp                                              AS TargetHours
              FROM DAYS d
              LEFT JOIN LOGD l ON l.D = d.DT
             ORDER BY d.DT;

        ------------------------------------------------------------------
        -- 5. MONTH CALENDAR — one row per day of the month
        ------------------------------------------------------------------
        OPEN P_CUR_MONTH_CAL FOR
            WITH DAYS AS (
                SELECT v_mstart + LEVEL - 1 AS DT
                  FROM DUAL CONNECT BY v_mstart + LEVEL - 1 <= v_mend
            ),
            LOGD AS (
                SELECT TRUNC(tl.LOG_DATE) AS D,
                       SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                ELSE NVL(tl.TIME_SPENT_MIN, 0) END) AS MINS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.USER_ID  = P_EMPID
                   AND tl.LOG_DATE >= v_mstart
                   AND tl.LOG_DATE <  v_mend + 1
                 GROUP BY TRUNC(tl.LOG_DATE)
            )
            SELECT TO_CHAR(d.DT, 'YYYY-MM-DD')                              AS TheDate,
                   EXTRACT(DAY FROM d.DT)                                   AS DayNum,
                   TO_CHAR(d.DT, 'DY', 'NLS_DATE_LANGUAGE=ENGLISH')         AS DayName,
                   ROUND(NVL(l.MINS, 0) / 60, 2)                            AS Hours,
                   CASE WHEN d.DT > v_today THEN 'Y' ELSE 'N' END           AS IsFuture,
                   CASE WHEN d.DT = v_today THEN 'Y' ELSE 'N' END           AS IsToday,
                   CASE WHEN PKG_DPR_CALC.FN_WORKING_DAYS_NET(d.DT, d.DT, P_EMPID, v_loc, v_doj, v_cat)
                           + PKG_DPR_CALC.FN_LEAVE_DAYS(d.DT, d.DT, P_EMPID, v_loc, v_doj, v_cat) > 0
                        THEN 'Y' ELSE 'N' END                               AS IsWorkingDay,
                   CASE WHEN PKG_DPR_CALC.FN_LEAVE_DAYS(d.DT, d.DT, P_EMPID, v_loc, v_doj, v_cat) > 0
                        THEN 'Y' ELSE 'N' END                               AS OnLeave,
                   v_daily_exp                                              AS TargetHours
              FROM DAYS d
              LEFT JOIN LOGD l ON l.D = d.DT
             ORDER BY d.DT;

        ------------------------------------------------------------------
        -- 6. MY TASKS — open tasks assigned to me
        ------------------------------------------------------------------
        OPEN P_CUR_MY_TASKS FOR
            SELECT t.TASK_ID                                  AS TaskId,
                   t.TASK_TITLE                               AS TaskTitle,
                   c.CATEGORY_NAME                            AS CategoryName,
                   TO_CHAR(t.START_DATE,  'YYYY-MM-DD')       AS StartDate,
                   TO_CHAR(t.TARGET_DATE, 'YYYY-MM-DD')       AS TargetDate,
                   t.PROGRESS                                 AS Progress,
                   t.STATUS                                   AS TaskStatus,
                   ta.STATUS                                  AS AssigneeStatus,
                   NVL(t.ESTIMATED_HOURS, 0)                  AS EstimatedHours,
                   ROUND(NVL(ml.MINS, 0) / 60, 1)             AS MyLoggedHours,
                   CASE WHEN UPPER(NVL(ta.STATUS, ' ')) = 'RUNNING'
                        THEN 'Y' ELSE 'N' END                 AS IsRunning,
                   CASE WHEN t.TARGET_DATE IS NOT NULL AND t.TARGET_DATE < v_today
                        THEN 'Y' ELSE 'N' END                 AS IsOverdue
              FROM TS_TMST_TASK_ASSIGNEE ta
              JOIN TS_TMST_TASK t ON t.TASK_ID = ta.TASK_ID AND t.STATUS <> 'DELETED'
              LEFT JOIN TM_TMST_TASK_CATEGORY c ON c.CATEGORY_ID = t.CATEGORY_ID
              LEFT JOIN (SELECT tl.TASK_ID, SUM(NVL(tl.TIME_SPENT_MIN, 0)) AS MINS
                           FROM TS_TMST_TIME_LOG tl
                           JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                          WHERE tl.USER_ID = P_EMPID
                          GROUP BY tl.TASK_ID) ml ON ml.TASK_ID = t.TASK_ID
             WHERE ta.USER_ID = P_EMPID
               AND UPPER(NVL(ta.STATUS, 'OPEN')) IN ('OPEN', 'RUNNING', 'PAUSED')
             ORDER BY CASE WHEN UPPER(NVL(ta.STATUS, ' ')) = 'RUNNING' THEN 0 ELSE 1 END,
                      NVL(t.TARGET_DATE, DATE '9999-12-31'),
                      t.TASK_ID DESC
             FETCH FIRST 30 ROWS ONLY;

        ------------------------------------------------------------------
        -- 7. ESTIMATED vs ACTUAL — top tasks I worked on this month
        ------------------------------------------------------------------
        OPEN P_CUR_EST_ACT FOR
            SELECT t.TASK_ID                                        AS TaskId,
                   t.TASK_TITLE                                     AS TaskTitle,
                   NVL(t.ESTIMATED_HOURS, 0)                        AS EstimatedHours,
                   ROUND(SUM(NVL(tl.TIME_SPENT_MIN, 0)) / 60, 1)    AS MonthHours,
                   ROUND(NVL((SELECT SUM(NVL(x.TIME_SPENT_MIN, 0))
                                FROM TS_TMST_TIME_LOG x
                                JOIN TS_TMST_TASK tk ON tk.TASK_ID = x.TASK_ID AND tk.STATUS <> 'DELETED'
                               WHERE x.USER_ID = P_EMPID
                                 AND x.TASK_ID = t.TASK_ID), 0) / 60, 1) AS TotalActualHours
              FROM TS_TMST_TIME_LOG tl
              JOIN TS_TMST_TASK t ON t.TASK_ID = tl.TASK_ID AND t.STATUS <> 'DELETED'
             WHERE tl.USER_ID  = P_EMPID
               AND tl.LOG_DATE >= v_mstart
               AND tl.LOG_DATE <  v_mend + 1
             GROUP BY t.TASK_ID, t.TASK_TITLE, t.ESTIMATED_HOURS
             ORDER BY SUM(NVL(tl.TIME_SPENT_MIN, 0)) DESC
             FETCH FIRST 10 ROWS ONLY;

        ------------------------------------------------------------------
        -- 8. MY FORMS — my exit-form requests + where they are stuck
        ------------------------------------------------------------------
        OPEN P_CUR_MY_FORMS FOR
            SELECT ex.EXIT_ID                                       AS ExitId,
                   CASE TRIM(ex.FORM_TYPE)
                        WHEN 'E' THEN 'Emergency Leave'
                        WHEN 'P' THEN 'Planned Leave'
                        WHEN 'R' THEN 'Resignation'
                        ELSE TRIM(ex.FORM_TYPE) END                 AS FormType,
                   TRIM(ex.APPROVAL_STATUS)                         AS Status,
                   TO_CHAR(ex.CREATED_ON, 'YYYY-MM-DD')             AS SubmittedDate,
                   TO_CHAR(ex.DATE_OF_DEPARTURE, 'YYYY-MM-DD')      AS DepartureDate,
                   ex.NO_OF_DAYS_APPROVED                           AS Duration,
                   NVL((SELECT CASE ap.APPROVER_ROLE
                                    WHEN 'HANDOVER'  THEN 'Handing Over Approval'
                                    WHEN 'HOD'       THEN 'HOD Approval'
                                    WHEN 'IT'        THEN 'IT Approval'
                                    WHEN 'AUDIT'     THEN 'Audit Approval'
                                    WHEN 'FINANCE'   THEN 'Finance Approval'
                                    WHEN 'FACILITY'  THEN 'Facility Approval'
                                    WHEN 'TRANSPORT' THEN 'Transport Approval'
                                    WHEN 'HR'        THEN 'HR Approval'
                                    WHEN 'ADMIN'     THEN 'Admin Approval'
                                    ELSE ap.APPROVER_ROLE END
                          FROM TS_EMP_EXIT_APPROVAL ap
                         WHERE ap.EXIT_ID = ex.EXIT_ID
                           AND ap.APPROVAL_STATUS = 'P'
                         ORDER BY ap.APPROVAL_LEVEL
                         FETCH FIRST 1 ROW ONLY),
                       CASE WHEN TRIM(ex.APPROVAL_STATUS) = 'R' THEN 'Rejected'
                            ELSE 'Completed' END)                   AS CurrentStep
              FROM TS_EMPLOYEE_EXIT ex
             WHERE ex.EMPLOYEE_ID = P_EMPID
             ORDER BY ex.CREATED_ON DESC
             FETCH FIRST 10 ROWS ONLY;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Employee dashboard fetched successfully';

    EXCEPTION
        WHEN OTHERS THEN
            -- ## FAILSAFE — the caller reads the cursors POSITIONALLY before it can read
            -- P_SUCCESS/P_MESSAGE. If a cursor was never OPENed the fetch itself throws
            -- (ORA-24338 invalid cursor), so the real SQLERRM never reaches the UI.
            -- Re-opening an already-open ref cursor is legal, so open all eight blind.
            OPEN P_CUR_HERO      FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_TILES     FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_TIMELINE  FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_WEEK      FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_MONTH_CAL FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_MY_TASKS  FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_EST_ACT   FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_MY_FORMS  FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching employee dashboard: ' || SQLERRM;
    END SP_GET_EMP_DASHBOARD;

    -- ==================================================================
    -- HOD DASHBOARD
    -- ==================================================================
    PROCEDURE SP_GET_HOD_DASHBOARD (
        P_HODID          IN  VARCHAR2,
        P_DEPARTMENT     IN  VARCHAR2 DEFAULT NULL,
        P_MONTH          IN  NUMBER   DEFAULT NULL,
        P_YEAR           IN  NUMBER   DEFAULT NULL,
        P_CUR_DEPTS      OUT SYS_REFCURSOR,
        P_CUR_SUMMARY    OUT SYS_REFCURSOR,
        P_CUR_TREND      OUT SYS_REFCURSOR,
        P_CUR_FORM_QUEUE OUT SYS_REFCURSOR,
        P_CUR_LOG_QUEUE  OUT SYS_REFCURSOR,
        P_CUR_TEAM       OUT SYS_REFCURSOR,
        P_CUR_ATTENDANCE OUT SYS_REFCURSOR,
        P_CUR_NOT_DONE   OUT SYS_REFCURSOR,
        P_CUR_HEATMAP    OUT SYS_REFCURSOR,
        P_CUR_LEADERBOARD OUT SYS_REFCURSOR,
        P_CUR_EXCEPTIONS OUT SYS_REFCURSOR,
        P_SUCCESS        OUT VARCHAR2,
        P_MESSAGE        OUT VARCHAR2
    ) IS
        v_now     TIMESTAMP;
        v_today   DATE;
        v_mstart  DATE;
        v_mend    DATE;
        v_mend_td DATE;
        -- ## PERF — lookback cap for "last log date" / STALE. Without it those
        -- queries scan the whole TS_TMST_TIME_LOG history. A last log older than
        -- this reads as NULL, which the UI already renders as "never logged".
        v_stale_from DATE;
    BEGIN
        v_now   := FN_USER_TIME(P_HODID);
        v_today := TRUNC(v_now);
        v_stale_from := v_today - 365;

        IF P_MONTH IS NULL OR P_YEAR IS NULL THEN
            v_mstart := TRUNC(v_now, 'MM');
        ELSE
            v_mstart := TO_DATE(P_YEAR || '-' || P_MONTH || '-01', 'YYYY-MM-DD');
        END IF;
        v_mend    := LAST_DAY(v_mstart);
        v_mend_td := LEAST(v_mend, v_today);
        IF v_mstart > v_today THEN
            v_mend_td := v_mstart - 1;
        END IF;

        -- ## MEMO — arm the per-request expected-hours cache BEFORE any cursor is
        -- opened. Mandatory, not an optimisation detail: the cache is keyed by
        -- EMPID alone, so this call is what pins it to THIS request's month and
        -- today. Without it a pooled connection would answer with the previous
        -- request's date range. Ref cursors execute on FETCH, i.e. after this
        -- procedure has returned, so these three values must still be correct
        -- then — they are, because the client holds the connection until it has
        -- finished reading every cursor.
        CALC_RESET(v_mstart, v_mend_td, v_today);

        ------------------------------------------------------------------
        -- 1. DEPT PILLS — always ALL departments this HOD manages
        ------------------------------------------------------------------
        OPEN P_CUR_DEPTS FOR
            WITH HD AS (
                SELECT DISTINCT TRIM(h.DEPARTMENT) AS DEPARTMENT
                  FROM TM_DPR_HOD_MASTER h
                 WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
            ),
            EMPS AS (
                -- carry HD's department value so the outer join matches exactly
                SELECT e.EMPID, HD.DEPARTMENT
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                  JOIN HD ON TRIM(UPPER(HD.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT))
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
            )
            SELECT HD.DEPARTMENT                                          AS Department,
                   NVL(COUNT(em.EMPID), 0)                                AS TeamCount,
                   NVL(COUNT(CASE WHEN lg.USER_ID IS NOT NULL THEN 1 END), 0) AS LoggedToday,
                   NVL(COUNT(CASE WHEN rn.USER_ID IS NOT NULL THEN 1 END), 0) AS RunningNow
              FROM HD
              LEFT JOIN EMPS em ON em.DEPARTMENT = HD.DEPARTMENT
              LEFT JOIN (SELECT DISTINCT tl.USER_ID
                           FROM TS_TMST_TIME_LOG tl
                           JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                          WHERE tl.LOG_DATE >= v_today AND tl.LOG_DATE < v_today + 1) lg
                     ON lg.USER_ID = em.EMPID
              LEFT JOIN (SELECT DISTINCT tl.USER_ID
                           FROM TS_TMST_TIME_LOG tl
                           JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                          WHERE tl.LOG_STATUS = 'OPEN') rn
                     ON rn.USER_ID = em.EMPID
             GROUP BY HD.DEPARTMENT
             ORDER BY HD.DEPARTMENT;

        ------------------------------------------------------------------
        -- 2. SUMMARY — hero KPIs (scoped to P_DEPARTMENT when given)
        ------------------------------------------------------------------
        OPEN P_CUR_SUMMARY FOR
            WITH TEAM AS (
                SELECT /*+ MATERIALIZE */ e.EMPID, e.COM_LOC, e.EMPCATEGORY, e.DOJ
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            ),
            MONTH_LOG AS (
                SELECT tl.USER_ID,
                       SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                ELSE NVL(tl.TIME_SPENT_MIN, 0) END) AS MINS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_mstart AND tl.LOG_DATE < v_mend + 1
                   AND tl.USER_ID IN (SELECT EMPID FROM TEAM)
                 GROUP BY tl.USER_ID
            )
            SELECT TO_CHAR(v_today, 'YYYY-MM-DD')                            AS TheDate,
                   TO_CHAR(v_mstart, 'YYYY-MM')                              AS MonthKey,
                   (SELECT COUNT(*) FROM TEAM)                               AS TeamCount,
                   (SELECT COUNT(DISTINCT tl.USER_ID)
                      FROM TS_TMST_TIME_LOG tl
                      JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                     WHERE tl.LOG_DATE >= v_today AND tl.LOG_DATE < v_today + 1
                       AND tl.USER_ID IN (SELECT EMPID FROM TEAM))           AS LoggedToday,
                   (SELECT COUNT(DISTINCT tl.USER_ID)
                      FROM TS_TMST_TIME_LOG tl
                      JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                     WHERE tl.LOG_STATUS = 'OPEN'
                       AND tl.USER_ID IN (SELECT EMPID FROM TEAM))           AS RunningNow,
                   (SELECT COUNT(*)
                      FROM TEAM t
                     WHERE PKG_DPR_DASH.FN_C_LEAVE_TODAY(t.EMPID, t.COM_LOC,
                               t.EMPCATEGORY, t.DOJ) > 0)                    AS OnLeaveToday,
                   (SELECT ROUND(NVL(SUM(m.MINS), 0) / 60, 1) FROM MONTH_LOG m) AS MonthHours,
                   -- days x rate summed UNROUNDED then rounded once, exactly as
                   -- before the cache went in (FN_C_EXP_HRS rounds per member, which
                   -- would drift the team total by up to 0.05h a head). Both calls
                   -- hit the same cache entry, so it is still one computation.
                   (SELECT ROUND(NVL(SUM(
                               PKG_DPR_DASH.FN_C_WORK_DAYS(t.EMPID, t.COM_LOC,
                                   t.EMPCATEGORY, t.DOJ)
                             * PKG_DPR_DASH.FN_C_DAILY_EXP(t.EMPID, t.COM_LOC,
                                   t.EMPCATEGORY, t.DOJ)), 0), 1)
                      FROM TEAM t)                                           AS ExpectedHoursToDate,
                   (SELECT COUNT(*)
                      FROM TS_TMST_TASK_APPROVAL a
                     WHERE a.APPROVAL_STATUS = 'PENDING'
                       AND a.USER_ID IN (SELECT EMPID FROM TEAM)
                       AND EXISTS (SELECT 1 FROM TS_TMST_TASK tk
                                    WHERE tk.TASK_ID = a.TASK_ID
                                      AND tk.STATUS <> 'DELETED'))           AS PendingLogApprovals,
                   (SELECT COUNT(*)
                      FROM TS_EMP_EXIT_APPROVAL ap
                      JOIN TS_EMPLOYEE_EXIT ex ON ex.EXIT_ID = ap.EXIT_ID
                     WHERE ap.APPROVER_ID = P_HODID
                       AND ap.APPROVAL_STATUS = 'P'
                       AND ex.APPROVAL_STATUS <> 'R'
                       AND ap.APPROVAL_LEVEL = (SELECT MIN(a2.APPROVAL_LEVEL)
                                                  FROM TS_EMP_EXIT_APPROVAL a2
                                                 WHERE a2.EXIT_ID = ap.EXIT_ID
                                                   AND a2.APPROVAL_STATUS = 'P')) AS PendingFormApprovals
              FROM DUAL;

        ------------------------------------------------------------------
        -- 3. TREND — last 14 days: hours + members logged vs punched
        ------------------------------------------------------------------
        OPEN P_CUR_TREND FOR
            WITH TEAM AS (
                SELECT /*+ MATERIALIZE */ e.EMPID
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            ),
            DAYS AS (
                SELECT v_today - 14 + LEVEL AS DT
                  FROM DUAL CONNECT BY LEVEL <= 14
            ),
            LOGD AS (
                SELECT TRUNC(tl.LOG_DATE) AS D,
                       tl.USER_ID,
                       SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                ELSE NVL(tl.TIME_SPENT_MIN, 0) END) AS MINS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_today - 13 AND tl.LOG_DATE < v_today + 1
                   AND tl.USER_ID IN (SELECT EMPID FROM TEAM)
                 GROUP BY TRUNC(tl.LOG_DATE), tl.USER_ID
            ),
            -- ## ONEPASS — collapse to one row per day HERE, so the aggregate below
            -- is a join and not a per-row lookup. See the note on the final SELECT.
            LOG_DAY AS (
                SELECT /*+ MATERIALIZE */
                       D,
                       SUM(MINS)              AS MINS,
                       COUNT(DISTINCT USER_ID) AS MEMBERS
                  FROM LOGD
                 GROUP BY D
            ),
            PUNCH AS (
                SELECT /*+ MATERIALIZE */
                       TRUNC(p.PUNCHDATE) AS D, COUNT(DISTINCT p.EMPID) AS CNT
                  FROM TM_DPR_PUNCH_SNAPSHOT p
                 WHERE p.PUNCHDATE >= v_today - 13 AND p.PUNCHDATE < v_today + 1
                   AND p.EMPID IN (SELECT EMPID FROM TEAM)
                 GROUP BY TRUNC(p.PUNCHDATE)
            )
            -- ## ONEPASS — these used to be correlated scalar subqueries in the
            -- SELECT list (SELECT ... FROM LOGD WHERE D = d.DT). Driving from DAYS,
            -- that re-ran LOGD once per day for EACH of its two references and PUNCH
            -- once per day — 28 time-log aggregates and 14 full scans of
            -- ALLPUNCHDATA_NEW_01 for a 14-row result. Scalar-subquery caching cannot
            -- collapse them because d.DT differs on every row. As LEFT JOINs each CTE
            -- runs exactly once. This was the stall the client saw on the TREND fetch.
            SELECT TO_CHAR(d.DT, 'YYYY-MM-DD')                            AS TheDate,
                   TO_CHAR(d.DT, 'DY', 'NLS_DATE_LANGUAGE=ENGLISH')       AS DayName,
                   ROUND(NVL(ld.MINS, 0) / 60, 1)                         AS TotalHours,
                   NVL(ld.MEMBERS, 0)                                     AS MembersLogged,
                   NVL(pu.CNT, 0)                                         AS MembersPunched,
                   CASE WHEN d.DT = v_today THEN 'Y' ELSE 'N' END         AS IsToday
              FROM DAYS d
              LEFT JOIN LOG_DAY ld ON ld.D = d.DT
              LEFT JOIN PUNCH   pu ON pu.D = d.DT
             ORDER BY d.DT;

        ------------------------------------------------------------------
        -- 4. FORM QUEUE — exit-form approvals waiting on this HOD
        ------------------------------------------------------------------
        OPEN P_CUR_FORM_QUEUE FOR
            SELECT ex.EXIT_ID                                       AS ExitId,
                   appr.APPROVAL_ID                                 AS ApprovalId,
                   ex.EMPLOYEE_ID                                   AS EmployeeId,
                   emp.EMPLOYEENAME                                 AS EmployeeName,
                   emp.DEPARTMENT                                   AS Department,
                   CASE TRIM(ex.FORM_TYPE)
                        WHEN 'E' THEN 'Emergency Leave'
                        WHEN 'P' THEN 'Planned Leave'
                        WHEN 'R' THEN 'Resignation'
                        ELSE TRIM(ex.FORM_TYPE) END                 AS FormType,
                   TO_CHAR(ex.CREATED_ON, 'YYYY-MM-DD')             AS RequestDate,
                   TO_CHAR(ex.DATE_OF_DEPARTURE, 'YYYY-MM-DD')      AS DepartureDate,
                   ex.NO_OF_DAYS_APPROVED                           AS Duration,
                   ex.REASON_FOR_PLANNED_LEAVE                      AS Reason,
                   appr.APPROVER_ROLE                               AS ApproverRole,
                   appr.APPROVAL_LEVEL                              AS ApprovalLevel
              FROM TS_EMP_EXIT_APPROVAL appr
              JOIN TS_EMPLOYEE_EXIT ex ON ex.EXIT_ID = appr.EXIT_ID
              JOIN TM_DPR_EMPLOYEE_DETAILS emp ON emp.EMPID = ex.EMPLOYEE_ID
             WHERE appr.APPROVER_ID = P_HODID
               AND appr.APPROVAL_STATUS = 'P'
               AND ex.APPROVAL_STATUS <> 'R'
               AND appr.APPROVAL_LEVEL = (SELECT MIN(a2.APPROVAL_LEVEL)
                                            FROM TS_EMP_EXIT_APPROVAL a2
                                           WHERE a2.EXIT_ID = appr.EXIT_ID
                                             AND a2.APPROVAL_STATUS = 'P')
             ORDER BY ex.CREATED_ON DESC
             FETCH FIRST 15 ROWS ONLY;

        ------------------------------------------------------------------
        -- 5. LOG QUEUE — pending DPR log approvals per team member
        --    (same dept-based scoping as SP_GET_PENDING_APPROVAL_USERS)
        ------------------------------------------------------------------
        OPEN P_CUR_LOG_QUEUE FOR
            SELECT a.USER_ID                                        AS EmployeeId,
                   e.EMPLOYEENAME                                   AS EmployeeName,
                   e.DESIGNATION                                    AS Designation,
                   COUNT(*)                                         AS PendingLogCount,
                   ROUND(NVL(SUM(a.TIME_LOGED), 0), 0)              AS PendingMinutes,
                   TO_CHAR(MAX(a.APPROVAL_DATE), 'YYYY-MM-DD')      AS LastActivityDate
              FROM TS_TMST_TASK_APPROVAL a
              JOIN TM_DPR_EMPLOYEE_DETAILS e ON e.EMPID = a.USER_ID
             WHERE a.APPROVAL_STATUS = 'PENDING'
               -- ## DELETED — a soft-deleted task's pending log is not approvable time:
               -- every hours figure on this page already excludes it, so PendingMinutes
               -- must too. EXISTS (not JOIN) so a duplicate task row can't inflate SUM.
               AND EXISTS (SELECT 1 FROM TS_TMST_TASK tk
                            WHERE tk.TASK_ID = a.TASK_ID
                              AND tk.STATUS <> 'DELETED')
               -- EXISTS (not JOIN) so duplicate HOD-master rows can't inflate counts
               AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                            WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                              AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
               -- ## SCOPE — same team definition as every other HOD cursor, so this
               -- queue can never list people the team pulse does not show.
               AND TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
               AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
               AND e.EMPLOYEENAME IS NOT NULL
               AND e.EMPID <> P_HODID
               AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
               AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
             GROUP BY a.USER_ID, e.EMPLOYEENAME, e.DESIGNATION
             ORDER BY MAX(a.APPROVAL_DATE) DESC;

        ------------------------------------------------------------------
        -- 6. TEAM PULSE — one card per member
        ------------------------------------------------------------------
        OPEN P_CUR_TEAM FOR
            WITH TEAM AS (
                SELECT /*+ MATERIALIZE */ e.EMPID, e.EMPLOYEENAME, e.DESIGNATION, TRIM(e.DEPARTMENT) AS DEPARTMENT,
                       e.COM_LOC, e.EMPCATEGORY, e.DOJ, e.CURRENTSTATUS
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            )
            SELECT t.EMPID                                          AS EmpId,
                   t.EMPLOYEENAME                                   AS EmployeeName,
                   t.DESIGNATION                                    AS Designation,
                   t.DEPARTMENT                                     AS Department,
                   t.CURRENTSTATUS                                  AS CurrentStatus,
                   -- ## NOPIC — no profile BLOB here on purpose. The approved design
                   -- draws coloured INITIALS for team members, never a photograph, so
                   -- selecting FILE_DATA cost a scan of TS_DPR_EMPLOYEE_DOCUMENTS, one
                   -- extra ODP.NET round trip PER MEMBER to fetch each LOB, and a
                   -- base64 payload (+33%) that nothing rendered. That was the bulk of
                   -- the "slow deserialization" on this cursor.
                   NVL(td.MINS, 0)                                  AS TodayMin,
                   CASE WHEN rn.USER_ID IS NOT NULL THEN 'Y' ELSE 'N' END AS RunningNow,
                   rn.TASK_TITLE                                    AS RunningTaskTitle,
                   p.LAST_PUNCH                                     AS LastPunch,
                   NVL(p.PUNCH_COUNT, 0)                            AS PunchCount,
                   ROUND(NVL(m.MINS, 0) / 60, 1)                    AS MonthHours,
                   NVL(m.DAYS_REPORTED, 0)                          AS DaysReported,
                   PKG_DPR_DASH.FN_C_EXP_HRS(t.EMPID, t.COM_LOC,
                             t.EMPCATEGORY, t.DOJ)                  AS ExpectedHoursToDate,
                   CASE WHEN PKG_DPR_DASH.FN_C_LEAVE_TODAY(t.EMPID, t.COM_LOC,
                             t.EMPCATEGORY, t.DOJ) > 0
                        THEN 'Y' ELSE 'N' END                       AS OnLeaveToday
              FROM TEAM t
              -- (no TS_DPR_EMPLOYEE_DOCUMENTS join — see ## NOPIC above. Dropping it
              --  also removes the duplicate-row hazard it created, so TEAM is now one
              --  row per employee by construction.)
              LEFT JOIN (SELECT tl.USER_ID,
                                SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                         THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                         ELSE NVL(tl.TIME_SPENT_MIN, 0) END) AS MINS
                           FROM TS_TMST_TIME_LOG tl
                           JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                          WHERE tl.LOG_DATE >= v_today AND tl.LOG_DATE < v_today + 1
                          GROUP BY tl.USER_ID) td ON td.USER_ID = t.EMPID
              LEFT JOIN (SELECT tl.USER_ID, MAX(tk.TASK_TITLE) AS TASK_TITLE
                           FROM TS_TMST_TIME_LOG tl
                           JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                          WHERE tl.LOG_STATUS = 'OPEN'
                          GROUP BY tl.USER_ID) rn ON rn.USER_ID = t.EMPID
              LEFT JOIN (SELECT pp.EMPID,
                                MAX(SUBSTR(pp.PUNCHTIME, 1, 5)) AS LAST_PUNCH,
                                COUNT(*)                        AS PUNCH_COUNT
                           FROM TM_DPR_PUNCH_SNAPSHOT pp
                          WHERE pp.PUNCHDATE >= v_today AND pp.PUNCHDATE < v_today + 1
                          GROUP BY pp.EMPID) p ON p.EMPID = t.EMPID
              LEFT JOIN (SELECT tl.USER_ID,
                                SUM(NVL(tl.TIME_SPENT_MIN, 0))      AS MINS,
                                COUNT(DISTINCT TRUNC(tl.LOG_DATE))  AS DAYS_REPORTED
                           FROM TS_TMST_TIME_LOG tl
                           JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                          WHERE tl.LOG_DATE >= v_mstart AND tl.LOG_DATE < v_mend + 1
                          GROUP BY tl.USER_ID) m ON m.USER_ID = t.EMPID
             ORDER BY t.EMPLOYEENAME;

        ------------------------------------------------------------------
        -- 7. ATTENDANCE — today: punches vs logged, gap detection
        ------------------------------------------------------------------
        OPEN P_CUR_ATTENDANCE FOR
            WITH TEAM AS (
                SELECT /*+ MATERIALIZE */ e.EMPID, e.EMPLOYEENAME, e.DESIGNATION
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            ),
            PUNCH AS (
                SELECT pp.EMPID,
                       MIN(SUBSTR(pp.PUNCHTIME, 1, 5)) AS FIRST_PUNCH,
                       MAX(SUBSTR(pp.PUNCHTIME, 1, 5)) AS LAST_PUNCH,
                       COUNT(*)                        AS PUNCH_COUNT,
                       LISTAGG(SUBSTR(pp.PUNCHTIME, 1, 5), ', ' ON OVERFLOW TRUNCATE '...')
                           WITHIN GROUP (ORDER BY pp.PUNCHTIME) AS PUNCH_TIMES,
                       ROUND((TO_DATE(MAX(pp.PUNCHTIME), 'HH24:MI:SS')
                            - TO_DATE(MIN(pp.PUNCHTIME), 'HH24:MI:SS')) * 1440) AS ELAPSED_MIN
                  FROM TM_DPR_PUNCH_SNAPSHOT pp
                 WHERE pp.PUNCHDATE >= v_today AND pp.PUNCHDATE < v_today + 1
                 GROUP BY pp.EMPID
            ),
            LOGT AS (
                SELECT tl.USER_ID,
                       SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                ELSE NVL(tl.TIME_SPENT_MIN, 0) END) AS MINS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_today AND tl.LOG_DATE < v_today + 1
                 GROUP BY tl.USER_ID
            ),
            BRK AS (
                SELECT b.USER_ID,
                       SUM(GREATEST(ROUND((CAST(NVL(b.BREAK_END, v_now) AS DATE)
                                         - CAST(b.BREAK_START AS DATE)) * 1440), 0)) AS MINS
                  FROM TS_TMST_BREAK_LOG b
                 WHERE b.BREAK_DATE >= v_today AND b.BREAK_DATE < v_today + 1
                 GROUP BY b.USER_ID
            )
            SELECT t.EMPID                                          AS EmpId,
                   t.EMPLOYEENAME                                   AS EmployeeName,
                   t.DESIGNATION                                    AS Designation,
                   p.FIRST_PUNCH                                    AS FirstPunch,
                   p.LAST_PUNCH                                     AS LastPunch,
                   NVL(p.PUNCH_COUNT, 0)                            AS PunchCount,
                   p.PUNCH_TIMES                                    AS PunchTimes,
                   NVL(l.MINS, 0)                                   AS LoggedMin,
                   NVL(b.MINS, 0)                                   AS BreakMin,
                   -- ## ELAPSED — send the real punch span too. GapMin is floored at 0,
                   -- so the UI cannot recover "in office" hours by inverting it.
                   CASE WHEN p.EMPID IS NULL THEN NULL
                        ELSE NVL(p.ELAPSED_MIN, 0) END               AS ElapsedMin,
                   CASE WHEN p.EMPID IS NULL THEN NULL
                        ELSE GREATEST(NVL(p.ELAPSED_MIN, 0) - NVL(l.MINS, 0) - NVL(b.MINS, 0), 0)
                   END                                              AS GapMin
              FROM TEAM t
              LEFT JOIN PUNCH p ON p.EMPID   = t.EMPID
              LEFT JOIN LOGT  l ON l.USER_ID = t.EMPID
              LEFT JOIN BRK   b ON b.USER_ID = t.EMPID
             ORDER BY t.EMPLOYEENAME;

        ------------------------------------------------------------------
        -- 8. NOT DONE — punched in today but no DPR log today
        ------------------------------------------------------------------
        OPEN P_CUR_NOT_DONE FOR
            -- ## PERF — this used to run TWO correlated MAX() scans of the ENTIRE
            -- TS_TMST_TIME_LOG history PER EMPLOYEE (2N unbounded scans, and the two
            -- were the same value computed twice). Now: one bounded pre-aggregate for
            -- the whole team, joined once. v_stale_from caps the lookback — a last log
            -- older than that reads as "never" (already the display meaning of NULL).
            WITH LAST_LOG AS (
                SELECT tl.USER_ID, MAX(TRUNC(tl.LOG_DATE)) AS LAST_D
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_stale_from
                   AND tl.LOG_DATE <  v_today + 1
                 GROUP BY tl.USER_ID
            ),
            PUNCH_TODAY AS (
                SELECT pp.EMPID, MIN(SUBSTR(pp.PUNCHTIME, 1, 5)) AS FIRST_PUNCH
                  FROM TM_DPR_PUNCH_SNAPSHOT pp
                 WHERE pp.PUNCHDATE >= v_today AND pp.PUNCHDATE < v_today + 1
                 GROUP BY pp.EMPID
            )
            SELECT e.EMPID                                          AS EmpId,
                   e.EMPLOYEENAME                                   AS EmployeeName,
                   e.DESIGNATION                                    AS Designation,
                   pt.FIRST_PUNCH                                   AS FirstPunch,
                   TO_CHAR(ll.LAST_D, 'YYYY-MM-DD')                 AS LastLogDate,
                   CASE WHEN ll.LAST_D IS NULL THEN NULL
                        ELSE v_today - ll.LAST_D END                 AS DaysSinceLastLog
              FROM TM_DPR_EMPLOYEE_DETAILS e
              JOIN PUNCH_TODAY pt ON pt.EMPID = e.EMPID
              LEFT JOIN LAST_LOG ll ON ll.USER_ID = e.EMPID
             WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
               AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
               AND e.EMPLOYEENAME IS NOT NULL
               AND e.EMPID <> P_HODID
               AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                            WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                              AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
               AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
               AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
               -- "punched today" is now the PUNCH_TODAY inner join above, so the old
               -- correlated EXISTS on ALLPUNCHDATA is gone (it scanned once per employee)
               AND NOT EXISTS (SELECT 1 FROM TS_TMST_TIME_LOG tl
                                 JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                                WHERE tl.USER_ID = e.EMPID
                                  AND tl.LOG_DATE >= v_today AND tl.LOG_DATE < v_today + 1)
             ORDER BY e.EMPLOYEENAME;

        ------------------------------------------------------------------
        -- 9. HEATMAP — member x last 10 days
        ------------------------------------------------------------------
        OPEN P_CUR_HEATMAP FOR
            WITH TEAM AS (
                SELECT /*+ MATERIALIZE */ e.EMPID, e.EMPLOYEENAME
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            ),
            DAYS AS (
                SELECT v_today - 10 + LEVEL AS DT
                  FROM DUAL CONNECT BY LEVEL <= 10
            ),
            LOGD AS (
                SELECT tl.USER_ID, TRUNC(tl.LOG_DATE) AS D,
                       SUM(CASE WHEN tl.LOG_STATUS = 'OPEN' AND tl.END_TIME IS NULL
                                THEN GREATEST(ROUND((CAST(v_now AS DATE) - CAST(tl.START_TIME AS DATE)) * 1440), 0)
                                ELSE NVL(tl.TIME_SPENT_MIN, 0) END) AS MINS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_today - 9 AND tl.LOG_DATE < v_today + 1
                   AND tl.USER_ID IN (SELECT EMPID FROM TEAM)
                 GROUP BY tl.USER_ID, TRUNC(tl.LOG_DATE)
            )
            SELECT t.EMPID                                          AS EmpId,
                   t.EMPLOYEENAME                                   AS EmployeeName,
                   TO_CHAR(d.DT, 'YYYY-MM-DD')                      AS TheDate,
                   TO_CHAR(d.DT, 'DY', 'NLS_DATE_LANGUAGE=ENGLISH') AS DayName,
                   ROUND(NVL(l.MINS, 0) / 60, 1)                    AS Hours
              FROM TEAM t
             CROSS JOIN DAYS d
              LEFT JOIN LOGD l ON l.USER_ID = t.EMPID AND l.D = d.DT
             ORDER BY t.EMPLOYEENAME, d.DT;

        ------------------------------------------------------------------
        -- 10. LEADERBOARD — month composite score (80% hours fulfilment,
        --     10% consistency, 10% remark quality) — same basis as the
        --     in-app AI ranking (PKG_AI_INSIGHTS).
        ------------------------------------------------------------------
        OPEN P_CUR_LEADERBOARD FOR
            WITH TEAM AS (
                SELECT /*+ MATERIALIZE */ e.EMPID, e.EMPLOYEENAME, e.COM_LOC, e.EMPCATEGORY, e.DOJ
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            ),
            MONTH_LOG AS (
                SELECT tl.USER_ID,
                       SUM(NVL(tl.TIME_SPENT_MIN, 0))     AS MINS,
                       COUNT(DISTINCT TRUNC(tl.LOG_DATE)) AS DAYS_REPORTED
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK t ON t.TASK_ID = tl.TASK_ID AND t.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_mstart AND tl.LOG_DATE < v_mend + 1
                   AND tl.USER_ID IN (SELECT EMPID FROM TEAM)
                 GROUP BY tl.USER_ID
            ),
            REMARKS AS (
                SELECT c.USER_ID, c.TASK_ID, TRUNC(c.CREATED_ON) AS RDAY,
                       TRIM(UPPER(CAST(DBMS_LOB.SUBSTR(c.COMMENT_TEXT, 300, 1)
                                       AS VARCHAR2(300)))) AS TXT
                  FROM TS_TMST_COMMENTS c
                 WHERE c.CREATED_ON >= v_mstart AND c.CREATED_ON < v_mend + 1
                   AND c.USER_ID IN (SELECT EMPID FROM TEAM)
            ),
            RSTAT AS (
                SELECT USER_ID,
                       COUNT(*)             AS TOTAL_REMARKS,
                       COUNT(DISTINCT RDAY) AS DAYS_WITH_REMARKS
                  FROM REMARKS
                 WHERE TXT IS NOT NULL AND LENGTH(TXT) >= 3
                 GROUP BY USER_ID
            ),
            CDUP AS (
                SELECT USER_ID, SUM(CNT) AS CROSSTASK_DUP
                  FROM (SELECT USER_ID, TXT, COUNT(*) AS CNT
                          FROM REMARKS
                         WHERE TXT IS NOT NULL AND LENGTH(TXT) >= 3
                         GROUP BY USER_ID, TXT
                        HAVING COUNT(DISTINCT TASK_ID) > 1)
                 GROUP BY USER_ID
            ),
            BASE AS (
                SELECT t.EMPID, t.EMPLOYEENAME,
                       ROUND(NVL(m.MINS, 0) / 60, 1)  AS HRS,
                       NVL(m.DAYS_REPORTED, 0)        AS DAYS_REPORTED,
                       PKG_DPR_DASH.FN_C_WORK_DAYS(t.EMPID, t.COM_LOC,
                           t.EMPCATEGORY, t.DOJ) AS WD,
                       PKG_DPR_DASH.FN_C_DAILY_EXP(t.EMPID, t.COM_LOC,
                           t.EMPCATEGORY, t.DOJ) AS DEXP,
                       NVL(rs.TOTAL_REMARKS, 0)       AS TOTAL_REMARKS,
                       NVL(rs.DAYS_WITH_REMARKS, 0)   AS DAYS_WITH_REMARKS,
                       NVL(cd.CROSSTASK_DUP, 0)       AS CROSSTASK_DUP
                  FROM TEAM t
                  LEFT JOIN MONTH_LOG m ON m.USER_ID = t.EMPID
                  LEFT JOIN RSTAT rs    ON rs.USER_ID = t.EMPID
                  LEFT JOIN CDUP  cd    ON cd.USER_ID = t.EMPID
            ),
            SCORED AS (
                SELECT b.*,
                       ROUND(b.DEXP * b.WD, 1) AS EXPECTED_HRS,
                       ROUND(LEAST(b.DAYS_WITH_REMARKS / GREATEST(b.DAYS_REPORTED, 1), 1) * 100
                             * (1 - LEAST(b.CROSSTASK_DUP / GREATEST(b.TOTAL_REMARKS, 1), 0.5)), 1)
                           AS REMARK_SCORE
                  FROM BASE b
            )
            SELECT s.EMPID                                          AS EmpId,
                   s.EMPLOYEENAME                                   AS EmployeeName,
                   s.HRS                                            AS MonthHours,
                   s.EXPECTED_HRS                                   AS ExpectedHours,
                   s.DAYS_REPORTED                                  AS DaysReported,
                   ROUND(s.HRS / GREATEST(s.EXPECTED_HRS, 1) * 100, 1) AS FulfilPct,
                   ROUND(s.DAYS_REPORTED / GREATEST(s.WD, 1) * 100, 1) AS ConsistencyPct,
                   s.REMARK_SCORE                                   AS RemarkScore,
                   ROUND(0.8 * (s.HRS / GREATEST(s.EXPECTED_HRS, 1) * 100)
                       + 0.1 * LEAST(s.DAYS_REPORTED / GREATEST(s.WD, 1) * 100, 100)
                       + 0.1 * s.REMARK_SCORE, 1)                   AS CompositeScore,
                   ROW_NUMBER() OVER (
                       ORDER BY 0.8 * (s.HRS / GREATEST(s.EXPECTED_HRS, 1) * 100)
                              + 0.1 * LEAST(s.DAYS_REPORTED / GREATEST(s.WD, 1) * 100, 100)
                              + 0.1 * s.REMARK_SCORE DESC,
                                s.HRS DESC, s.EMPLOYEENAME)         AS TeamRank
              FROM SCORED s
             -- ## LEAVE — a member with no expected hours for the period (on approved
             -- leave the whole month, or hired after it ended) cannot be scored against
             -- a target of zero. Without this they land at 0% fulfilment and rank LAST,
             -- which reads as poor performance for being on sanctioned leave.
             WHERE s.EXPECTED_HRS > 0
             ORDER BY TeamRank;

        ------------------------------------------------------------------
        -- 11. EXCEPTIONS — LOW_FULFIL / STALE / REMARK_DUP (all computed,
        --     no AI cost)
        ------------------------------------------------------------------
        OPEN P_CUR_EXCEPTIONS FOR
            WITH TEAM AS (
                SELECT /*+ MATERIALIZE */ e.EMPID, e.EMPLOYEENAME, e.COM_LOC, e.EMPCATEGORY, e.DOJ
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            ),
            -- ## PERF — was an UNBOUNDED scan of all TS_TMST_TIME_LOG history for the
            -- whole team just to get one MAX(date); its MINS column was never used
            -- (MONTH_ONLY below supplies the month minutes). Bounded + trimmed.
            MONTH_LOG AS (
                SELECT tl.USER_ID,
                       MAX(TRUNC(tl.LOG_DATE))        AS LAST_LOG
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_stale_from
                   AND tl.LOG_DATE <  v_today + 1
                   AND tl.USER_ID IN (SELECT EMPID FROM TEAM)
                 GROUP BY tl.USER_ID
            ),
            MONTH_ONLY AS (
                SELECT tl.USER_ID, SUM(NVL(tl.TIME_SPENT_MIN, 0)) AS MINS
                  FROM TS_TMST_TIME_LOG tl
                  JOIN TS_TMST_TASK tk ON tk.TASK_ID = tl.TASK_ID AND tk.STATUS <> 'DELETED'
                 WHERE tl.LOG_DATE >= v_mstart AND tl.LOG_DATE < v_mend + 1
                   AND tl.USER_ID IN (SELECT EMPID FROM TEAM)
                 GROUP BY tl.USER_ID
            ),
            EXPECT AS (
                SELECT t.EMPID, t.EMPLOYEENAME,
                       PKG_DPR_DASH.FN_C_EXP_HRS(t.EMPID, t.COM_LOC,
                                 t.EMPCATEGORY, t.DOJ)                       AS EXP_HRS
                  FROM TEAM t
            ),
            -- ## LEAVE — "stale" has to mean WORKING days missed, not calendar days.
            -- Someone on two weeks' approved leave has failed to submit nothing, but a
            -- calendar test reported them as "14 days ago"; a new joiner was reported
            -- as "Never logged" on their first afternoon. FN_WORKING_DAYS_NET already
            -- nets out leave, weekends and public holidays, and clamps to DOJ, so it
            -- answers the real question: how many days SHOULD they have logged?
            --
            -- MATERIALIZE is deliberate: it forces the cheap calendar pre-filter to run
            -- first, so the expensive function is evaluated only for actual candidates
            -- (usually a handful) instead of the whole team.
            STALE_CAND AS (
                SELECT /*+ MATERIALIZE */
                       t.EMPID, t.EMPLOYEENAME, t.COM_LOC, t.EMPCATEGORY, t.DOJ,
                       ml.LAST_LOG,
                       NVL(ml.LAST_LOG + 1, v_stale_from) AS FROM_D
                  FROM TEAM t
                  LEFT JOIN MONTH_LOG ml ON ml.USER_ID = t.EMPID
                 WHERE ml.LAST_LOG IS NULL OR ml.LAST_LOG <= v_today - 3
            ),
            STALE_ROWS AS (
                SELECT sc.EMPID, sc.EMPLOYEENAME, sc.LAST_LOG,
                       PKG_DPR_CALC.FN_WORKING_DAYS_NET(sc.FROM_D, v_today, sc.EMPID,
                           sc.COM_LOC, sc.DOJ, sc.EMPCATEGORY) AS MISSED_WD
                  FROM STALE_CAND sc
            ),
            DUPS AS (
                SELECT c.USER_ID, SUM(CNT) AS DUP_CNT
                  FROM (SELECT c.USER_ID,
                               TRIM(UPPER(CAST(DBMS_LOB.SUBSTR(c.COMMENT_TEXT, 300, 1)
                                               AS VARCHAR2(300)))) AS TXT,
                               COUNT(*) AS CNT
                          FROM TS_TMST_COMMENTS c
                         WHERE c.CREATED_ON >= v_mstart AND c.CREATED_ON < v_mend + 1
                           AND c.USER_ID IN (SELECT EMPID FROM TEAM)
                         GROUP BY c.USER_ID,
                               TRIM(UPPER(CAST(DBMS_LOB.SUBSTR(c.COMMENT_TEXT, 300, 1)
                                               AS VARCHAR2(300))))
                        HAVING COUNT(DISTINCT c.TASK_ID) > 1
                           AND LENGTH(TRIM(UPPER(CAST(DBMS_LOB.SUBSTR(c.COMMENT_TEXT, 300, 1)
                                               AS VARCHAR2(300))))) >= 3) c
                 GROUP BY c.USER_ID
            )
            SELECT 'LOW_FULFIL'                                     AS ExcType,
                   x.EMPID                                          AS EmpId,
                   x.EMPLOYEENAME                                   AS EmployeeName,
                   ROUND(NVL(mo.MINS, 0) / 60 / GREATEST(x.EXP_HRS, 1) * 100, 1) AS MetricValue,
                   ROUND(NVL(mo.MINS, 0) / 60, 1) || 'h of ' || x.EXP_HRS || 'h expected' AS Detail
              FROM EXPECT x
              LEFT JOIN MONTH_ONLY mo ON mo.USER_ID = x.EMPID
             WHERE x.EXP_HRS > 0
               AND ROUND(NVL(mo.MINS, 0) / 60 / GREATEST(x.EXP_HRS, 1) * 100, 1) < 70
            UNION ALL
            SELECT 'STALE',
                   sr.EMPID, sr.EMPLOYEENAME,
                   sr.MISSED_WD,
                   CASE WHEN sr.LAST_LOG IS NULL
                        THEN 'Never logged - ' || sr.MISSED_WD || ' working days due'
                        ELSE 'Last log ' || TO_CHAR(sr.LAST_LOG, 'DD-Mon') || ' - '
                             || sr.MISSED_WD || ' working days missed' END
              FROM STALE_ROWS sr
             -- leave / weekends / holidays already netted out, so anyone genuinely
             -- absent from the system for 3 WORKING days is what surfaces here
             WHERE sr.MISSED_WD >= 3
            UNION ALL
            SELECT 'REMARK_DUP',
                   t.EMPID, t.EMPLOYEENAME,
                   d.DUP_CNT,
                   d.DUP_CNT || ' copy-pasted remarks across different tasks'
              FROM TEAM t
              JOIN DUPS d ON d.USER_ID = t.EMPID
             ORDER BY 1, 4 DESC;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'HOD dashboard fetched successfully';

    EXCEPTION
        WHEN OTHERS THEN
            -- ## FAILSAFE — see the note in SP_GET_EMP_DASHBOARD: every cursor must be
            -- open or the client's positional fetch throws before it can read P_MESSAGE.
            OPEN P_CUR_DEPTS       FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_SUMMARY     FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_TREND       FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_FORM_QUEUE  FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_LOG_QUEUE   FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_TEAM        FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_ATTENDANCE  FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_NOT_DONE    FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_HEATMAP     FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_LEADERBOARD FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            OPEN P_CUR_EXCEPTIONS  FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching HOD dashboard: ' || SQLERRM;
    END SP_GET_HOD_DASHBOARD;

    -- ================================================================
    -- HOD LEAVE STATUS — who is on leave, due back, overdue, or just back.
    -- Return date = latest approved E/P exit form's DATE_ARRIVAL, replaced by
    -- the rejoining form's EXTENSION_DATE when one exists.
    -- ================================================================
    PROCEDURE SP_GET_HOD_LEAVE_STATUS (
        P_HODID       IN  VARCHAR2,
        P_DEPARTMENT  IN  VARCHAR2 DEFAULT NULL,
        P_CURSOR      OUT SYS_REFCURSOR,
        P_SUCCESS     OUT VARCHAR2,
        P_MESSAGE     OUT VARCHAR2
    ) AS
        v_today DATE := TRUNC(SYSDATE);
    BEGIN
        OPEN P_CURSOR FOR
            WITH TEAM AS (
                -- same membership rule as PKG_DPR_DASH.SP_GET_HOD_DASHBOARD
                SELECT e.EMPID, e.EMPLOYEENAME, e.DESIGNATION, TRIM(UPPER(e.CURRENTSTATUS)) AS CURRENTSTATUS
                  FROM TM_DPR_EMPLOYEE_DETAILS e
                 WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
                   AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
                   AND e.EMPLOYEENAME IS NOT NULL
                   AND e.EMPID <> P_HODID
                   AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                                  AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
                   AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                    WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
                   AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
            ),
            FORM AS (
                -- latest APPROVED leave form (E / P — resignations are not leave) that has started
                SELECT x.EMPLOYEE_ID, x.EXIT_ID, TRIM(x.FORM_TYPE) AS FORM_TYPE,
                       x.DATE_OF_DEPARTURE, x.DATE_ARRIVAL, x.NO_OF_DAYS_APPROVED, x.REASON_FOR_PLANNED_LEAVE,
                       ROW_NUMBER() OVER (PARTITION BY x.EMPLOYEE_ID
                                              ORDER BY x.DATE_OF_DEPARTURE DESC, x.EXIT_ID DESC) AS RN
                  FROM TS_EMPLOYEE_EXIT x
                 WHERE TRIM(x.APPROVAL_STATUS) = 'A'
                   AND TRIM(x.FORM_TYPE) IN ('E', 'P')
                   AND x.DATE_OF_DEPARTURE <= v_today
                   AND x.DATE_OF_DEPARTURE >= v_today - 365
                   AND x.EMPLOYEE_ID IN (SELECT EMPID FROM TEAM)
            ),
            J AS (
                SELECT t.EMPID, t.EMPLOYEENAME, t.DESIGNATION, t.CURRENTSTATUS,
                       f.EXIT_ID, f.FORM_TYPE, f.DATE_OF_DEPARTURE, f.DATE_ARRIVAL,
                       f.NO_OF_DAYS_APPROVED, f.REASON_FOR_PLANNED_LEAVE,
                       r.LEAVETYPE, r.APPROVED_LEAVE_ARRIVAL_DATE, r.EXTENSION_DATE, r.RJ_STATUS,
                       r.JOINING_DATE, r.ARRIVED_ON
                  FROM TEAM t
                  LEFT JOIN FORM f ON f.EMPLOYEE_ID = t.EMPID AND f.RN = 1
                  -- the rejoining form for THIS leave: filed for a departure on or after the form's
                  OUTER APPLY (SELECT rr.LEAVETYPE, rr.APPROVED_LEAVE_ARRIVAL_DATE, rr.EXTENSION_DATE,
                                      TRIM(rr.STATUS) AS RJ_STATUS, rr.JOINING_DATE, CAST(rr.ARRIVED_ON AS DATE) AS ARRIVED_ON
                                 FROM TS_EMPLOYEE_REJOINING rr
                                WHERE rr.EMPLOYEE_ID = t.EMPID
                                  AND (f.DATE_OF_DEPARTURE IS NULL
                                       OR rr.DATEOF_DEPARTURE >= f.DATE_OF_DEPARTURE - 3)
                                ORDER BY rr.CREATED_ON DESC, rr.REJOIN_ID DESC
                                FETCH FIRST 1 ROW ONLY) r
            ),
            C AS (
                SELECT j.*,
                       NVL(j.EXTENSION_DATE, NVL(j.APPROVED_LEAVE_ARRIVAL_DATE, j.DATE_ARRIVAL))  AS DUE_BACK,
                       CASE WHEN j.RJ_STATUS = 'A' THEN NVL(j.JOINING_DATE, j.ARRIVED_ON) END        AS REJOINED_ON
                  FROM J j
            )
            SELECT c.EMPID                                                   AS EmpId,
                   c.EMPLOYEENAME                                            AS EmployeeName,
                   c.DESIGNATION                                             AS Designation,
                   c.CURRENTSTATUS                                           AS CurrentStatus,
                   NVL(c.LEAVETYPE,
                       CASE c.FORM_TYPE WHEN 'E' THEN 'Emergency Leave'
                                        WHEN 'P' THEN 'Planned Leave' END)   AS LeaveType,
                   c.REASON_FOR_PLANNED_LEAVE                                AS Reason,
                   TO_CHAR(c.DATE_OF_DEPARTURE, 'YYYY-MM-DD')                AS DepartedOn,
                   TO_CHAR(c.DATE_ARRIVAL, 'YYYY-MM-DD')                     AS PlannedReturn,
                   TO_CHAR(c.EXTENSION_DATE, 'YYYY-MM-DD')                   AS ExtendedTo,
                   TO_CHAR(c.DUE_BACK, 'YYYY-MM-DD')                         AS DueBack,
                   TO_CHAR(c.REJOINED_ON, 'YYYY-MM-DD')                      AS RejoinedOn,
                   c.NO_OF_DAYS_APPROVED                                     AS DaysApproved,
                   CASE WHEN c.REJOINED_ON IS NULL AND c.DUE_BACK < v_today
                        THEN v_today - c.DUE_BACK ELSE 0 END                 AS OverdueDays,
                   CASE WHEN c.REJOINED_ON IS NULL AND c.DUE_BACK >= v_today
                        THEN c.DUE_BACK - v_today END                        AS DaysUntilBack,
                   CASE WHEN c.REJOINED_ON IS NOT NULL AND c.REJOINED_ON <= v_today THEN 'REJOINED'
                        WHEN c.DUE_BACK IS NULL                                 THEN 'ON_LEAVE'
                        WHEN c.DUE_BACK <  v_today                              THEN 'OVERDUE'
                        WHEN c.DUE_BACK =  v_today                              THEN 'DUE_TODAY'
                        ELSE 'ON_LEAVE' END                                  AS LeaveStatus
              FROM C c
             WHERE c.CURRENTSTATUS = 'LEAVE'
                OR (c.DATE_OF_DEPARTURE IS NOT NULL
                    AND (c.REJOINED_ON IS NULL OR c.REJOINED_ON > v_today)
                    AND NVL(c.DUE_BACK, v_today) >= v_today - 60)          -- overdue kept for 60 days
                OR (c.REJOINED_ON IS NOT NULL AND c.REJOINED_ON >= v_today - 7)
             ORDER BY CASE WHEN c.REJOINED_ON IS NOT NULL AND c.REJOINED_ON <= v_today THEN 3
                           WHEN c.DUE_BACK < v_today THEN 0
                           WHEN c.DUE_BACK = v_today THEN 1 ELSE 2 END,
                      c.DUE_BACK, c.EMPLOYEENAME;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'OK';
    EXCEPTION
        WHEN OTHERS THEN
            P_SUCCESS := 'N';
            P_MESSAGE := 'Error fetching leave status: ' || SQLERRM;
            OPEN P_CURSOR FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
    END SP_GET_HOD_LEAVE_STATUS;

END PKG_DPR_DASH;
/
