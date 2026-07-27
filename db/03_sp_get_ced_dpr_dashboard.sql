------------------------------------------------------------------------------
-- 03_sp_get_ced_dpr_dashboard.sql — leave-aware SP_GET_CED_DPR_DASHBOARD.
-- Paste this PROCEDURE over the existing one inside its package body.
-- Requires 01_leave_ddl.sql first (GT_DPR_LEAVE + GT_DPR_EMP.LEAVE_DAYS).
--
-- What changed vs the current version (marked with -- ## LEAVE):
--   A2. GT_DPR_LEAVE populated once per call with each eligible employee's
--       approved-leave spans (lbasic+rejoinbasic, cancel='F',
--       end = NVL(rejoin-1, tdate)), clipped to [window ∪ trailing-30d] & DOJ.
--   A3. GT_DPR_EMP.LEAVE_DAYS = working days on leave inside the window
--       (counted against TM_WORK_CALENDAR: IS_WORK_IND for IND, else IS_WORK_OM);
--       WORK_DAYS and EXP_HOURS then reduced by it.
--       → Summary.ExpectedHours, Dept.ExpectedHrs/CompliancePct,
--         Employee.ExpectedHrs/CompliancePct all become leave-aware for free.
--   3.  Daily trend ExpectedHours = company total minus employees on leave
--       that specific day.
--   4.  Heatmap ExpectedHrs = dept total minus that dept's on-leave employees
--       for that day (compliance % follows).
--   5.  Employee cursor: new LeaveDays column; 30-day consistency denominator
--       is now net of that employee's leave in the trailing 30 days.
------------------------------------------------------------------------------

PROCEDURE SP_GET_CED_DPR_DASHBOARD (
    P_FROM_DATE       IN  DATE,
    P_TO_DATE         IN  DATE     DEFAULT NULL,
    P_SUMMARY_CURSOR  OUT SYS_REFCURSOR,
    P_DEPT_CURSOR     OUT SYS_REFCURSOR,
    P_DAILY_CURSOR    OUT SYS_REFCURSOR,
    P_HEATMAP_CURSOR  OUT SYS_REFCURSOR,
    P_EMPLOYEE_CURSOR OUT SYS_REFCURSOR,
    P_SUCCESS         OUT VARCHAR2,
    P_MESSAGE         OUT VARCHAR2
)
IS
    V_FROM      DATE;
    V_TO        DATE;
    V_TMP       DATE;
    V_WORK_DAYS NUMBER := 0;
    V_FROM30    DATE;
    V_WORK30    NUMBER := 0;
    V_ELIG_CNT  NUMBER := 0;
    V_DAY_EXP   NUMBER := 0;
BEGIN
    V_FROM := TRUNC(P_FROM_DATE);
    V_TO   := TRUNC(NVL(P_TO_DATE, P_FROM_DATE));
    IF V_FROM > V_TO THEN
        V_TMP := V_FROM; V_FROM := V_TO; V_TO := V_TMP;
    END IF;
    V_FROM30 := V_TO - 29;

    DELETE FROM GT_DPR_EMP;
    DELETE FROM GT_DPR_LOG;
    DELETE FROM GT_DPR_LEAVE;                                     -- ## LEAVE

    ------------------------------------------------------------------
    -- STAGE A1: eligible employees, GROSS working days (unchanged)
    ------------------------------------------------------------------
    INSERT INTO GT_DPR_EMP
      (EMPID, EMPLOYEENAME, DESIGNATION, EMPCATEGORY, COM_LOC,
       DEPARTMENT_ID, DEPTNAME, DAILY_EXP, WORK_DAYS, EXP_HOURS)
    SELECT x.EMPID, x.EMPLOYEENAME, x.DESIGNATION, x.EMPCATEGORY, x.COM_LOC,
           x.DEPARTMENT_ID, x.DEPTNAME,
           x.DAILY_EXP,
           x.WORK_DAYS,
           ROUND(x.DAILY_EXP * x.WORK_DAYS, 1)
    FROM (
        SELECT e.EMPID, e.EMPLOYEENAME, e.DESIGNATION, e.EMPCATEGORY, e.COM_LOC,
               d.DEPARTMENT_ID, d.DEPTNAME,
               CASE WHEN UPPER(TRIM(e.EMPCATEGORY)) IN ('OMANI','NATIONALS') THEN 8
                    WHEN UPPER(TRIM(e.COM_LOC)) = 'IND'                      THEN 8.5
                    ELSE 9 END AS DAILY_EXP,
               GREATEST(
                   CASE WHEN UPPER(TRIM(e.COM_LOC)) = 'IND'
                        THEN NVL(ce.CUM_IND,0) ELSE NVL(ce.CUM_OM,0) END
                 - CASE WHEN UPPER(TRIM(e.COM_LOC)) = 'IND'
                        THEN NVL(cs.CUM_IND,0) ELSE NVL(cs.CUM_OM,0) END
               , 0) AS WORK_DAYS
        FROM   TM_DPR_EMPLOYEE_DETAILS e
        JOIN   TM_DEPTMASTER d
               ON d.DEPTNAME = e.DEPARTMENT AND d.IS_ACTIVE = 'Y'
        LEFT   JOIN TM_WORK_CALENDAR ce ON ce.DT = V_TO
        LEFT   JOIN TM_WORK_CALENDAR cs
               ON cs.DT = GREATEST(V_FROM, TRUNC(NVL(e.DOJ, V_FROM))) - 1
        WHERE  TRIM(UPPER(e.CURRENTSTATUS)) = 'ACTIVE'
          AND  TRIM(UPPER(NVL(e.IS_DPR,'N'))) = 'Y'
          AND  e.EMPLOYEENAME IS NOT NULL
          -- ## HOD — Heads of Department don't submit DPRs, so they must not
          -- appear anywhere in this dashboard. Filtering here is enough: every
          -- cursor below (summary, departments, daily, heatmap, employees) and
          -- GT_DPR_LOG all derive from GT_DPR_EMP. Same rule as
          -- PKG_AI_INSIGHTS.SP_GET_DPR_AI_SUMMARY.
          AND  NOT EXISTS (
                   SELECT 1
                     FROM TM_DPR_HOD_MASTER h
                    WHERE h.EMP_ID = e.EMPID
                      AND TRIM(h.IS_ACTIVE) = 'Y'
               )
    ) x;

    ------------------------------------------------------------------
    -- ## LEAVE — STAGE A2: approved leave spans for eligible employees.
    -- One row per (employee, leave application), clipped to
    -- [LEAST(V_FROM,V_FROM30) .. V_TO] and to the employee's DOJ.
    -- lbasic.EMPID holds EMPMASTID → bridge via EMPMAST (+ EMPIDOLD
    -- for rehires). Effective end = day BEFORE actual rejoin.
    ------------------------------------------------------------------
    INSERT INTO GT_DPR_LEAVE (EMPID, LV_FROM, LV_TO)
    SELECT g.EMPID,
           GREATEST(TRUNC(l.FDATE),
                    LEAST(V_FROM, V_FROM30),
                    TRUNC(NVL(e.DOJ, l.FDATE)))                    AS LV_FROM,
           LEAST(TRUNC(NVL(r.AREJOINDATE - 1, l.TDATE)), V_TO)     AS LV_TO
    FROM   GT_DPR_EMP g
    JOIN   TM_DPR_EMPLOYEE_DETAILS e  ON e.EMPID = g.EMPID
    JOIN   ADK2026.EMPMAST m          ON m.EMPID = g.EMPID
    LEFT   JOIN ADK2026.EMPMAST mo    ON mo.EMPID = m.EMPIDOLD
    JOIN   ADK2026.LBASIC l
           ON l.EMPID IN (m.EMPMASTID, mo.EMPMASTID)
          AND l.CANCEL = 'F'
    LEFT   JOIN (SELECT LEAVEAPPID, MIN(AREJOINDATE) AS AREJOINDATE
                   FROM ADK2026.REJOINBASIC
                  WHERE CANCEL = 'F'
                  GROUP BY LEAVEAPPID) r
           ON r.LEAVEAPPID = l.LBASICID
    WHERE  TRUNC(l.FDATE) <= V_TO
      AND  TRUNC(NVL(r.AREJOINDATE - 1, l.TDATE)) >= LEAST(V_FROM, V_FROM30)
      AND  GREATEST(TRUNC(l.FDATE), LEAST(V_FROM, V_FROM30), TRUNC(NVL(e.DOJ, l.FDATE)))
           <= LEAST(TRUNC(NVL(r.AREJOINDATE - 1, l.TDATE)), V_TO);

    ------------------------------------------------------------------
    -- ## LEAVE — STAGE A3: subtract leave working days from the range.
    -- COUNT(DISTINCT DT) → overlapping applications can't double-count.
    -- Day counted only if it was a working day for THAT employee's
    -- country calendar (IS_WORK_IND for IND, IS_WORK_OM otherwise).
    ------------------------------------------------------------------
    UPDATE GT_DPR_EMP g
       SET g.LEAVE_DAYS = (
               SELECT COUNT(DISTINCT c.DT)
                 FROM GT_DPR_LEAVE lv
                 JOIN TM_WORK_CALENDAR c
                   ON c.DT BETWEEN GREATEST(lv.LV_FROM, V_FROM) AND lv.LV_TO
                WHERE lv.EMPID = g.EMPID
                  AND (   (UPPER(TRIM(g.COM_LOC))  = 'IND' AND c.IS_WORK_IND = 1)
                       OR (UPPER(TRIM(g.COM_LOC)) <> 'IND' AND c.IS_WORK_OM  = 1))
           );

    UPDATE GT_DPR_EMP
       SET WORK_DAYS = GREATEST(WORK_DAYS - LEAVE_DAYS, 0),
           EXP_HOURS = ROUND(DAILY_EXP * GREATEST(WORK_DAYS - LEAVE_DAYS, 0), 1);

    SELECT COUNT(*), NVL(SUM(DAILY_EXP),0)
      INTO V_ELIG_CNT, V_DAY_EXP
      FROM GT_DPR_EMP;

    -- baseline working days for display / 30-day consistency denominator
    SELECT GREATEST(NVL(MAX(ce.CUM_OM),0) - NVL(MAX(cs.CUM_OM),0), 1)
      INTO V_WORK_DAYS
      FROM TM_WORK_CALENDAR ce
      LEFT JOIN TM_WORK_CALENDAR cs ON cs.DT = V_FROM - 1
     WHERE ce.DT = V_TO;

    SELECT GREATEST(NVL(MAX(ce.CUM_OM),0) - NVL(MAX(cs.CUM_OM),0), 1)
      INTO V_WORK30
      FROM TM_WORK_CALENDAR ce
      LEFT JOIN TM_WORK_CALENDAR cs ON cs.DT = V_FROM30 - 1
     WHERE ce.DT = V_TO;

    ------------------------------------------------------------------
    -- STAGE B: one pass over the time log (unchanged)
    ------------------------------------------------------------------
    INSERT INTO GT_DPR_LOG (USER_ID, LOG_DT, MINS)
    SELECT tl.USER_ID, TRUNC(tl.LOG_DATE), ROUND(SUM(NVL(tl.TIME_SPENT_MIN,0)))
    FROM   TS_TMST_TIME_LOG tl
    WHERE  tl.LOG_DATE >= LEAST(V_FROM, V_FROM30)
      AND  tl.LOG_DATE <  V_TO + 1
      AND  EXISTS (SELECT 1 FROM GT_DPR_EMP g WHERE g.EMPID = tl.USER_ID)
    GROUP  BY tl.USER_ID, TRUNC(tl.LOG_DATE);

    ------------------------------------------------------------------
    -- 1. SUMMARY  (ExpectedHours now net of leave via GT_DPR_EMP)
    ------------------------------------------------------------------
    OPEN P_SUMMARY_CURSOR FOR
    WITH R AS (
        SELECT USER_ID, SUM(MINS) AS MINS
        FROM   GT_DPR_LOG
        WHERE  LOG_DT BETWEEN V_FROM AND V_TO
        GROUP  BY USER_ID
    ),
    A AS (
        SELECT COUNT(*)                 AS LOGGED_CNT,
               NVL(SUM(R.MINS),0)       AS TOT_MINS
        FROM   R
    )
    SELECT
        V_ELIG_CNT                                              AS TotalEmployees,
        a.LOGGED_CNT                                            AS LoggedEmployees,
        V_ELIG_CNT - a.LOGGED_CNT                               AS NotLoggedEmployees,
        ROUND(a.LOGGED_CNT / GREATEST(V_ELIG_CNT,1) * 100, 1)   AS AdoptionPct,
        ROUND(a.TOT_MINS / 60, 1)                               AS HoursLogged,
        FLOOR(a.TOT_MINS / 60) || 'h ' ||
          LPAD(MOD(a.TOT_MINS, 60), 2, '0') || 'm'              AS HoursLoggedDisplay,
        (SELECT ROUND(NVL(SUM(EXP_HOURS),0),1) FROM GT_DPR_EMP) AS ExpectedHours,
        (SELECT NVL(SUM(LEAVE_DAYS),0) FROM GT_DPR_EMP)         AS TotalLeaveDays,   -- ## LEAVE
        V_WORK_DAYS                                             AS WorkingDays,
        TO_CHAR(V_FROM,'YYYY-MM-DD')                            AS FromDate,
        TO_CHAR(V_TO,'YYYY-MM-DD')                              AS ToDate
    FROM A a;

    ------------------------------------------------------------------
    -- 2. DEPARTMENTS  (ExpectedHrs / CompliancePct now net of leave)
    ------------------------------------------------------------------
    OPEN P_DEPT_CURSOR FOR
    WITH R AS (
        SELECT USER_ID, SUM(MINS) AS MINS
        FROM   GT_DPR_LOG
        WHERE  LOG_DT BETWEEN V_FROM AND V_TO
        GROUP  BY USER_ID
    ),
    DEPT_BASE AS (
        SELECT e.DEPARTMENT_ID                       AS DepartmentId,
               e.DEPTNAME                            AS DepartmentName,
               COUNT(*)                              AS Headcount,
               COUNT(r.USER_ID)                      AS LoggedCount,
               COUNT(*) - COUNT(r.USER_ID)           AS MissingCount,
               NVL(SUM(r.MINS),0)                    AS TOT_MINS,
               ROUND(SUM(e.EXP_HOURS),1)             AS ExpectedHrs,
               NVL(SUM(e.LEAVE_DAYS),0)              AS LeaveDays          -- ## LEAVE
        FROM   GT_DPR_EMP e
        LEFT   JOIN R r ON r.USER_ID = e.EMPID
        GROUP  BY e.DEPARTMENT_ID, e.DEPTNAME
    )
    SELECT db.DepartmentId, db.DepartmentName, db.Headcount,
           db.LoggedCount, db.MissingCount,
           ROUND(db.TOT_MINS / 60, 1)                          AS LoggedHrs,
           FLOOR(db.TOT_MINS / 60) || 'h ' ||
             LPAD(MOD(db.TOT_MINS, 60), 2, '0') || 'm'         AS LoggedHrsDisplay,
           db.ExpectedHrs,
           db.LeaveDays,                                       -- ## LEAVE
           ROUND(db.TOT_MINS / 60
                 / GREATEST(db.ExpectedHrs,1) * 100, 1)        AS CompliancePct,
           ROW_NUMBER() OVER (
               ORDER BY db.TOT_MINS / GREATEST(db.ExpectedHrs,1) DESC,
                        db.DepartmentName)                     AS DeptRank
    FROM   DEPT_BASE db
    ORDER  BY DeptRank;

    ------------------------------------------------------------------
    -- 3. DAILY trend — ## LEAVE: expected hours for a day exclude the
    --    daily quota of employees on leave THAT day, so adoption/expected
    --    no longer punish days when part of the team is on leave.
    ------------------------------------------------------------------
    OPEN P_DAILY_CURSOR FOR
    WITH DAYS AS (
        SELECT c.DT
        FROM   TM_WORK_CALENDAR c
        WHERE  c.DT BETWEEN V_FROM AND V_TO
          AND  c.IS_WORK_OM = 1
    ),
    D AS (
        SELECT LOG_DT, COUNT(DISTINCT USER_ID) AS EMPS, SUM(MINS) AS MINS
        FROM   GT_DPR_LOG
        WHERE  LOG_DT BETWEEN V_FROM AND V_TO
        GROUP  BY LOG_DT
    ),
    ONLV AS (                                                   -- ## LEAVE
        SELECT x.DT,
               COUNT(*)          AS EMPS_ON_LEAVE,
               SUM(e.DAILY_EXP)  AS LV_EXP
        FROM  (SELECT DISTINCT dy.DT, lv.EMPID
                 FROM DAYS dy
                 JOIN GT_DPR_LEAVE lv
                   ON dy.DT BETWEEN lv.LV_FROM AND lv.LV_TO) x
        JOIN   GT_DPR_EMP e ON e.EMPID = x.EMPID
        GROUP  BY x.DT
    )
    SELECT TO_CHAR(dy.DT,'YYYY-MM-DD')                        AS LogDate,
           TO_CHAR(dy.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH')    AS DayName,
           NVL(d.EMPS,0)                                      AS LoggedEmployees,
           ROUND(NVL(d.MINS,0) / 60, 1)                       AS HoursLogged,
           FLOOR(NVL(d.MINS,0) / 60) || 'h ' ||
             LPAD(MOD(NVL(d.MINS,0), 60), 2, '0') || 'm'      AS HoursLoggedDisplay,
           GREATEST(V_DAY_EXP - NVL(o.LV_EXP,0), 0)           AS ExpectedHours,     -- ## LEAVE
           NVL(o.EMPS_ON_LEAVE,0)                             AS EmployeesOnLeave,  -- ## LEAVE
           ROUND(NVL(d.EMPS,0)
                 / GREATEST(V_ELIG_CNT - NVL(o.EMPS_ON_LEAVE,0),1) * 100, 1)
                                                              AS AdoptionPct        -- ## LEAVE
    FROM   DAYS dy
    LEFT   JOIN D    d ON d.LOG_DT = dy.DT
    LEFT   JOIN ONLV o ON o.DT     = dy.DT
    ORDER  BY dy.DT;

    ------------------------------------------------------------------
    -- 4. HEATMAP — ## LEAVE: same per-day exclusion, per department.
    ------------------------------------------------------------------
    OPEN P_HEATMAP_CURSOR FOR
    WITH DAYS AS (
        SELECT c.DT
        FROM   TM_WORK_CALENDAR c
        WHERE  c.DT BETWEEN V_FROM AND V_TO
          AND  c.IS_WORK_OM = 1
    ),
    DEPT_EXP AS (
        SELECT DEPARTMENT_ID, DEPTNAME, SUM(DAILY_EXP) AS DAY_EXP
        FROM   GT_DPR_EMP
        GROUP  BY DEPARTMENT_ID, DEPTNAME
    ),
    DEPT_DAY AS (
        SELECT e.DEPARTMENT_ID, l.LOG_DT, SUM(l.MINS) AS MINS
        FROM   GT_DPR_LOG l
        JOIN   GT_DPR_EMP e ON e.EMPID = l.USER_ID
        WHERE  l.LOG_DT BETWEEN V_FROM AND V_TO
        GROUP  BY e.DEPARTMENT_ID, l.LOG_DT
    ),
    DEPT_DAY_LV AS (                                            -- ## LEAVE
        SELECT e.DEPARTMENT_ID, x.DT, SUM(e.DAILY_EXP) AS LV_EXP
        FROM  (SELECT DISTINCT dy.DT, lv.EMPID
                 FROM DAYS dy
                 JOIN GT_DPR_LEAVE lv
                   ON dy.DT BETWEEN lv.LV_FROM AND lv.LV_TO) x
        JOIN   GT_DPR_EMP e ON e.EMPID = x.EMPID
        GROUP  BY e.DEPARTMENT_ID, x.DT
    )
    SELECT de.DEPARTMENT_ID                          AS DepartmentId,
           de.DEPTNAME                               AS DepartmentName,
           TO_CHAR(dy.DT,'YYYY-MM-DD')               AS LogDate,
           ROUND(NVL(dd.MINS,0) / 60, 1)             AS LoggedHrs,
           FLOOR(NVL(dd.MINS,0) / 60) || 'h ' ||
             LPAD(MOD(NVL(dd.MINS,0), 60), 2, '0') || 'm' AS LoggedHrsDisplay,
           GREATEST(de.DAY_EXP - NVL(dl.LV_EXP,0), 0) AS ExpectedHrs,        -- ## LEAVE
           ROUND(NVL(dd.MINS,0) / 60
                 / GREATEST(de.DAY_EXP - NVL(dl.LV_EXP,0), 1) * 100, 1)
                                                     AS CompliancePct        -- ## LEAVE
    FROM   DEPT_EXP de
    CROSS  JOIN DAYS dy
    LEFT   JOIN DEPT_DAY dd
           ON dd.DEPARTMENT_ID = de.DEPARTMENT_ID AND dd.LOG_DT = dy.DT
    LEFT   JOIN DEPT_DAY_LV dl
           ON dl.DEPARTMENT_ID = de.DEPARTMENT_ID AND dl.DT     = dy.DT
    ORDER  BY de.DEPTNAME, dy.DT;

    ------------------------------------------------------------------
    -- 5. EMPLOYEES — ExpectedHrs/CompliancePct net via GT_DPR_EMP;
    --    ## LEAVE: LeaveDays exposed; 30-day consistency denominator
    --    is net of that employee's leave inside the trailing window.
    ------------------------------------------------------------------
    OPEN P_EMPLOYEE_CURSOR FOR
    WITH RANGE_LOGS AS (
        SELECT USER_ID, SUM(MINS) AS MINS, COUNT(DISTINCT LOG_DT) AS LOGGED_DAYS
        FROM   GT_DPR_LOG
        WHERE  LOG_DT BETWEEN V_FROM AND V_TO
        GROUP  BY USER_ID
    ),
    CONS30 AS (
        SELECT USER_ID, COUNT(DISTINCT LOG_DT) AS DAYS30
        FROM   GT_DPR_LOG
        WHERE  LOG_DT BETWEEN V_FROM30 AND V_TO
        GROUP  BY USER_ID
    ),
    LV30 AS (                                                   -- ## LEAVE
        SELECT e.EMPID, COUNT(DISTINCT c.DT) AS LV_WD30
        FROM   GT_DPR_EMP e
        JOIN   GT_DPR_LEAVE lv ON lv.EMPID = e.EMPID
        JOIN   TM_WORK_CALENDAR c
               ON c.DT BETWEEN GREATEST(lv.LV_FROM, V_FROM30) AND lv.LV_TO
        WHERE  (   (UPPER(TRIM(e.COM_LOC))  = 'IND' AND c.IS_WORK_IND = 1)
                OR (UPPER(TRIM(e.COM_LOC)) <> 'IND' AND c.IS_WORK_OM  = 1))
        GROUP  BY e.EMPID
    ),
    LAST_LOG AS (
        SELECT tl.USER_ID, MAX(TRUNC(tl.LOG_DATE)) AS LAST_DT
        FROM   TS_TMST_TIME_LOG tl
        WHERE  tl.LOG_DATE >= V_TO - 365
          AND  tl.LOG_DATE <  V_TO + 1
        GROUP  BY tl.USER_ID
    ),
    BASE AS (
        SELECT e.EMPID AS EmployeeId, e.EMPLOYEENAME AS EmployeeName,
               e.DESIGNATION AS Designation, e.EMPCATEGORY AS EmpCategory,
               e.COM_LOC AS Location, e.DEPARTMENT_ID AS DepartmentId,
               e.DEPTNAME AS DepartmentName,
               e.DAILY_EXP AS DailyExpectedHrs,
               e.EXP_HOURS AS ExpectedHrs,
               e.LEAVE_DAYS AS LeaveDays,                              -- ## LEAVE
               NVL(rl.MINS,0) AS TOT_MINS,
               NVL(rl.LOGGED_DAYS,0) AS LoggedDays,
               e.WORK_DAYS AS WorkingDays,
               CASE WHEN rl.USER_ID IS NOT NULL THEN 'Y' ELSE 'N' END AS LoggedInRange,
               TO_CHAR(ll.LAST_DT,'YYYY-MM-DD') AS LastLogDate,
               CASE WHEN ll.LAST_DT IS NULL THEN -1
                    ELSE TRUNC(SYSDATE) - ll.LAST_DT END AS DaysSinceLastLog,
               NVL(c30.DAYS30,0) AS LoggedDays30,
               GREATEST(V_WORK30 - NVL(l30.LV_WD30,0), 0) AS WorkingDays30, -- ## LEAVE
               ROUND(NVL(c30.DAYS30,0)
                     / GREATEST(V_WORK30 - NVL(l30.LV_WD30,0), 1) * 100, 1)
                                                          AS ConsistencyPct -- ## LEAVE
        FROM   GT_DPR_EMP e
        LEFT   JOIN RANGE_LOGS rl  ON rl.USER_ID  = e.EMPID
        LEFT   JOIN LAST_LOG   ll  ON ll.USER_ID  = e.EMPID
        LEFT   JOIN CONS30     c30 ON c30.USER_ID = e.EMPID
        LEFT   JOIN LV30       l30 ON l30.EMPID   = e.EMPID
    )
    SELECT b.EmployeeId, b.EmployeeName, b.Designation, b.EmpCategory, b.Location,
           b.DepartmentId, b.DepartmentName, b.DailyExpectedHrs, b.ExpectedHrs,
           ROUND(b.TOT_MINS / 60, 1)                          AS LoggedHrs,
           FLOOR(b.TOT_MINS / 60) || 'h ' ||
             LPAD(MOD(b.TOT_MINS, 60), 2, '0') || 'm'         AS LoggedHrsDisplay,
           b.LoggedDays, b.WorkingDays,
           b.LeaveDays,                                       -- ## LEAVE
           b.LoggedInRange,
           ROUND(b.TOT_MINS / 60
                 / GREATEST(b.ExpectedHrs,1) * 100, 1)        AS CompliancePct,
           b.LastLogDate, b.DaysSinceLastLog,
           b.LoggedDays30, b.WorkingDays30, b.ConsistencyPct,
           ROW_NUMBER() OVER (
               PARTITION BY b.DepartmentId
               ORDER BY b.TOT_MINS / GREATEST(b.ExpectedHrs,1) DESC,
                        b.TOT_MINS DESC, b.EmployeeName
           ) AS DeptRank
    FROM   BASE b
    ORDER  BY b.DepartmentName, DeptRank;

    P_SUCCESS := 'Y';
    P_MESSAGE := 'CED DPR dashboard data fetched successfully';

    PKG_LOG.SP_INSERT_LOG('SP_GET_CED_DPR_DASHBOARD','CED_DASHBOARD','SUCCESS',
        'From=' || TO_CHAR(V_FROM,'DD-MON-YYYY') || ', To=' || TO_CHAR(V_TO,'DD-MON-YYYY')
        || ', WorkDays=' || V_WORK_DAYS || ', Work30=' || V_WORK30);

EXCEPTION
    WHEN OTHERS THEN
        P_SUCCESS := 'N';
        P_MESSAGE := 'Error fetching CED dashboard: ' || SQLERRM;
        PKG_LOG.SP_INSERT_LOG('SP_GET_CED_DPR_DASHBOARD','CED_DASHBOARD','FAILURE',SQLERRM);

        OPEN P_SUMMARY_CURSOR  FOR SELECT NULL AS TotalEmployees FROM DUAL WHERE 1=0;
        OPEN P_DEPT_CURSOR     FOR SELECT NULL AS DepartmentId   FROM DUAL WHERE 1=0;
        OPEN P_DAILY_CURSOR    FOR SELECT NULL AS LogDate        FROM DUAL WHERE 1=0;
        OPEN P_HEATMAP_CURSOR  FOR SELECT NULL AS DepartmentId   FROM DUAL WHERE 1=0;
        OPEN P_EMPLOYEE_CURSOR FOR SELECT NULL AS EmployeeId     FROM DUAL WHERE 1=0;
END SP_GET_CED_DPR_DASHBOARD;
