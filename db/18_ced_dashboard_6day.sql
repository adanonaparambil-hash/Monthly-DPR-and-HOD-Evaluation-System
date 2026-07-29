------------------------------------------------------------------------------
-- 18_ced_dashboard_6day.sql — RUN LAST (after 15 + 16 + 17).
--
-- Paste this procedure into the PKG_TMST_TASK package BODY, replacing the
-- current SP_GET_CED_DPR_DASHBOARD, then compile the package.
--
-- WHAT CHANGED (all marked -- ## 6DAY), based on the live body fetched from
-- USER_SOURCE on 28-Jul-2026:
--   Weekend is now decided by CATEGORY:
--     OMANI/NATIONALS -> 5-day week (Fri+Sat off)  -> IS_WORK_OM  / CUM_OM
--     expat staff     -> 6-day week (Fri off)      -> IS_WORK_OM6 / CUM_OM6 (NEW)
--     COM_LOC = IND   -> 6-day week (Fri off)      -> IS_WORK_IND / CUM_IND
--   1. A1  WORK_DAYS        : three-way CASE (category first).
--   2. A3  LEAVE_DAYS       : non-IND leave days counted on the GROUP's
--                             working days (Saturday counts for expats).
--   3. Daily trend cursor   : Saturday is now a working day for most staff,
--                             so per-day ExpectedHours / AdoptionPct only
--                             count the employees whose group works that day.
--   4. Heatmap cursor       : same per-day, per-department.
--   5. Consistency (30-day) : denominator is the employee's own group
--                             calendar (V_WORK30_OM5 / _OM6 / _IND).
--   6. V_WORK_DAYS display  : now the 6-day count (majority of DPR users).
--   All ## IND logic from script 14 (ADKIND_UAT leave, PL excluded,
--   fractional half-days) and the ## HOD exclusion are preserved.
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
            V_FROM        DATE;
            V_TO          DATE;
            V_TMP         DATE;
            V_WORK_DAYS   NUMBER := 0;
            V_FROM30      DATE;
            V_WORK30_OM5  NUMBER := 0;   -- ## 6DAY: 30-day working days per group
            V_WORK30_OM6  NUMBER := 0;   -- ## 6DAY
            V_WORK30_IND  NUMBER := 0;   -- ## 6DAY
            V_ELIG_CNT    NUMBER := 0;
            V_DAY_EXP     NUMBER := 0;
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
            -- STAGE A1: eligible employees, GROSS working days
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
                            WHEN UPPER(TRIM(e.COM_LOC)) = 'IND'                      THEN 8   -- ## IND: was 8.5
                            ELSE 9 END AS DAILY_EXP,
                       -- ## 6DAY — working-day profile decided by CATEGORY first:
                       -- Omani/Nationals 5-day, India calendar, everyone else 6-day
                       GREATEST(
                           CASE WHEN UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) IN ('OMANI','NATIONALS')
                                THEN NVL(ce.CUM_OM,0)  - NVL(cs.CUM_OM,0)
                                WHEN UPPER(TRIM(NVL(e.COM_LOC,'X'))) = 'IND'
                                THEN NVL(ce.CUM_IND,0) - NVL(cs.CUM_IND,0)
                                ELSE NVL(ce.CUM_OM6,0) - NVL(cs.CUM_OM6,0)
                           END, 0) AS WORK_DAYS
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
            -- ## LEAVE — STAGE A2: approved leave spans, NON-INDIAN employees
            -- (ADK2026 lbasic/rejoinbasic — unchanged, but now excludes IND).
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
            WHERE  UPPER(TRIM(g.COM_LOC)) <> 'IND'                          -- ## IND: Oman source no longer used for Indians
              AND  TRUNC(l.FDATE) <= V_TO
              AND  TRUNC(NVL(r.AREJOINDATE - 1, l.TDATE)) >= LEAST(V_FROM, V_FROM30)
              AND  GREATEST(TRUNC(l.FDATE), LEAST(V_FROM, V_FROM30), TRUNC(NVL(e.DOJ, l.FDATE)))
                   <= LEAST(TRUNC(NVL(r.AREJOINDATE - 1, l.TDATE)), V_TO);

            ------------------------------------------------------------------
            -- ## IND — STAGE A2b: Indian leave DAYS from ADKIND_UAT.
            -- One 1-day span per leave day (dedup two half-day rows on the
            -- same date). 'Privilege / Earned Leave' is excluded entirely:
            -- it does NOT reduce the target, so it must not appear here.
            -- These rows feed the daily/heatmap/consistency exclusions; the
            -- exact fractional LEAVE_DAYS is computed in A3 below.
            ------------------------------------------------------------------
            INSERT INTO GT_DPR_LEAVE (EMPID, LV_FROM, LV_TO)
            SELECT g.EMPID, TRUNC(ld.LDATE), TRUNC(ld.LDATE)
            FROM   GT_DPR_EMP g
            JOIN   TM_DPR_EMPLOYEE_DETAILS e2 ON e2.EMPID = g.EMPID
            JOIN   ADKIND_UAT.EMPMAST  e  ON e.EMPID       = g.EMPID
            JOIN   ADKIND_UAT.LBASIC   l  ON l.EMPMASTERID = e.EMPMASTID
                                         AND l.CANCEL      = 'F'
            JOIN   ADKIND_UAT.LEAVEDETAIL ld ON ld.LBASICID = l.LBASICID
            JOIN   ADKIND_UAT.LMDETAIL lm ON lm.LMDETAILID = ld.LVCODE
            WHERE  UPPER(TRIM(g.COM_LOC)) = 'IND'
              AND  TRUNC(ld.LDATE) BETWEEN LEAST(V_FROM, V_FROM30) AND V_TO
              AND  TRUNC(ld.LDATE) >= TRUNC(NVL(e2.DOJ, ld.LDATE))
              AND  NVL(UPPER(lm.LEAVEDESC), ' ') NOT LIKE '%PRIVILEGE%'
            GROUP  BY g.EMPID, TRUNC(ld.LDATE);

            ------------------------------------------------------------------
            -- ## LEAVE — STAGE A3: leave working days per employee.
            --   IND      -> exact FRACTIONAL sum from ADKIND_UAT (0.5 = half
            --               day), PL excluded, Indian working days only.
            --   non-IND  -> distinct working days inside the ADK2026 spans,
            --               counted on the employee's OWN group calendar:
            --               ## 6DAY — Saturday counts for expat staff.
            ------------------------------------------------------------------
            UPDATE GT_DPR_EMP g
               SET g.LEAVE_DAYS =
                   CASE WHEN UPPER(TRIM(g.COM_LOC)) = 'IND' THEN               -- ## IND
                       NVL((SELECT SUM(NVL(ld.NOOFLEAVE, 1))
                              FROM ADKIND_UAT.EMPMAST  e
                              JOIN ADKIND_UAT.LBASIC   l  ON l.EMPMASTERID = e.EMPMASTID
                                                         AND l.CANCEL      = 'F'
                              JOIN ADKIND_UAT.LEAVEDETAIL ld ON ld.LBASICID = l.LBASICID
                              JOIN ADKIND_UAT.LMDETAIL lm ON lm.LMDETAILID  = ld.LVCODE
                              JOIN TM_WORK_CALENDAR    c  ON c.DT = TRUNC(ld.LDATE)
                                                         AND c.IS_WORK_IND = 1
                             WHERE e.EMPID = g.EMPID
                               AND TRUNC(ld.LDATE) BETWEEN V_FROM AND V_TO
                               AND NVL(UPPER(lm.LEAVEDESC), ' ') NOT LIKE '%PRIVILEGE%'), 0)
                   ELSE
                       NVL((SELECT COUNT(DISTINCT c.DT)
                              FROM GT_DPR_LEAVE lv
                              JOIN TM_WORK_CALENDAR c
                                ON c.DT BETWEEN GREATEST(lv.LV_FROM, V_FROM) AND lv.LV_TO
                             WHERE lv.EMPID = g.EMPID
                               AND (   (UPPER(TRIM(NVL(g.EMPCATEGORY,'X'))) IN ('OMANI','NATIONALS')
                                        AND c.IS_WORK_OM  = 1)
                                    OR (UPPER(TRIM(NVL(g.EMPCATEGORY,'X'))) NOT IN ('OMANI','NATIONALS')
                                        AND c.IS_WORK_OM6 = 1))), 0)           -- ## 6DAY
                   END;

            UPDATE GT_DPR_EMP
               SET WORK_DAYS = GREATEST(WORK_DAYS - LEAVE_DAYS, 0),
                   EXP_HOURS = ROUND(DAILY_EXP * GREATEST(WORK_DAYS - LEAVE_DAYS, 0), 1);

            SELECT COUNT(*), NVL(SUM(DAILY_EXP),0)
              INTO V_ELIG_CNT, V_DAY_EXP
              FROM GT_DPR_EMP;

            -- ## 6DAY — display baseline: the 6-day calendar (most DPR users)
            SELECT GREATEST(NVL(MAX(ce.CUM_OM6),0) - NVL(MAX(cs.CUM_OM6),0), 1)
              INTO V_WORK_DAYS
              FROM TM_WORK_CALENDAR ce
              LEFT JOIN TM_WORK_CALENDAR cs ON cs.DT = V_FROM - 1
             WHERE ce.DT = V_TO;

            -- ## 6DAY — 30-day consistency denominators, one per group
            SELECT GREATEST(NVL(MAX(ce.CUM_OM),0)  - NVL(MAX(cs.CUM_OM),0),  1),
                   GREATEST(NVL(MAX(ce.CUM_OM6),0) - NVL(MAX(cs.CUM_OM6),0), 1),
                   GREATEST(NVL(MAX(ce.CUM_IND),0) - NVL(MAX(cs.CUM_IND),0), 1)
              INTO V_WORK30_OM5, V_WORK30_OM6, V_WORK30_IND
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
            -- 1. SUMMARY  (unchanged)
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
            -- 2. DEPARTMENTS  (unchanged)
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
            -- 3. DAILY trend
            -- ## 6DAY — Saturday is a working day for expat staff but not for
            -- Omani/Nationals, so a day's ExpectedHours / AdoptionPct must
            -- only count the employees whose group works that day.
            ------------------------------------------------------------------
            OPEN P_DAILY_CURSOR FOR
            WITH DAYS AS (
                SELECT c.DT, c.IS_WORK_OM, c.IS_WORK_OM6, c.IS_WORK_IND
                FROM   TM_WORK_CALENDAR c
                WHERE  c.DT BETWEEN V_FROM AND V_TO
                  AND  (c.IS_WORK_OM = 1 OR c.IS_WORK_OM6 = 1 OR c.IS_WORK_IND = 1)
            ),
            G AS (
                SELECT e.EMPID, e.DAILY_EXP,
                       CASE WHEN UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) IN ('OMANI','NATIONALS') THEN 'OM5'
                            WHEN UPPER(TRIM(NVL(e.COM_LOC,'X'))) = 'IND'                      THEN 'IND'
                            ELSE 'OM6' END AS GRP
                FROM   GT_DPR_EMP e
            ),
            DEXP AS (   -- who is expected to work each day
                SELECT dy.DT,
                       SUM(g.DAILY_EXP) AS DAY_EXP,
                       COUNT(*)         AS ELIG_CNT
                FROM   DAYS dy
                JOIN   G g ON (   (g.GRP = 'OM5' AND dy.IS_WORK_OM  = 1)
                               OR (g.GRP = 'OM6' AND dy.IS_WORK_OM6 = 1)
                               OR (g.GRP = 'IND' AND dy.IS_WORK_IND = 1))
                GROUP  BY dy.DT
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
                       SUM(x.DAILY_EXP)  AS LV_EXP
                FROM  (SELECT DISTINCT dy.DT, g.EMPID, g.DAILY_EXP
                         FROM DAYS dy
                         JOIN GT_DPR_LEAVE lv
                           ON dy.DT BETWEEN lv.LV_FROM AND lv.LV_TO
                         JOIN G g ON g.EMPID = lv.EMPID
                        WHERE (   (g.GRP = 'OM5' AND dy.IS_WORK_OM  = 1)
                               OR (g.GRP = 'OM6' AND dy.IS_WORK_OM6 = 1)
                               OR (g.GRP = 'IND' AND dy.IS_WORK_IND = 1))) x
                GROUP  BY x.DT
            )
            SELECT TO_CHAR(dy.DT,'YYYY-MM-DD')                        AS LogDate,
                   TO_CHAR(dy.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH')    AS DayName,
                   NVL(d.EMPS,0)                                      AS LoggedEmployees,
                   ROUND(NVL(d.MINS,0) / 60, 1)                       AS HoursLogged,
                   FLOOR(NVL(d.MINS,0) / 60) || 'h ' ||
                     LPAD(MOD(NVL(d.MINS,0), 60), 2, '0') || 'm'      AS HoursLoggedDisplay,
                   GREATEST(NVL(de.DAY_EXP,0) - NVL(o.LV_EXP,0), 0)   AS ExpectedHours,     -- ## 6DAY
                   NVL(o.EMPS_ON_LEAVE,0)                             AS EmployeesOnLeave,  -- ## LEAVE
                   ROUND(NVL(d.EMPS,0)
                         / GREATEST(NVL(de.ELIG_CNT,0) - NVL(o.EMPS_ON_LEAVE,0),1) * 100, 1)
                                                                      AS AdoptionPct        -- ## 6DAY
            FROM   DAYS dy
            LEFT   JOIN DEXP de ON de.DT     = dy.DT
            LEFT   JOIN D    d  ON d.LOG_DT  = dy.DT
            LEFT   JOIN ONLV o  ON o.DT      = dy.DT
            ORDER  BY dy.DT;

            ------------------------------------------------------------------
            -- 4. HEATMAP
            -- ## 6DAY — same per-day rule as the daily trend, per department.
            ------------------------------------------------------------------
            OPEN P_HEATMAP_CURSOR FOR
            WITH DAYS AS (
                SELECT c.DT, c.IS_WORK_OM, c.IS_WORK_OM6, c.IS_WORK_IND
                FROM   TM_WORK_CALENDAR c
                WHERE  c.DT BETWEEN V_FROM AND V_TO
                  AND  (c.IS_WORK_OM = 1 OR c.IS_WORK_OM6 = 1 OR c.IS_WORK_IND = 1)
            ),
            G AS (
                SELECT e.EMPID, e.DAILY_EXP, e.DEPARTMENT_ID,
                       CASE WHEN UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) IN ('OMANI','NATIONALS') THEN 'OM5'
                            WHEN UPPER(TRIM(NVL(e.COM_LOC,'X'))) = 'IND'                      THEN 'IND'
                            ELSE 'OM6' END AS GRP
                FROM   GT_DPR_EMP e
            ),
            DEPTS AS (
                SELECT DISTINCT DEPARTMENT_ID, DEPTNAME FROM GT_DPR_EMP
            ),
            DEXP AS (
                SELECT g.DEPARTMENT_ID, dy.DT, SUM(g.DAILY_EXP) AS DAY_EXP
                FROM   DAYS dy
                JOIN   G g ON (   (g.GRP = 'OM5' AND dy.IS_WORK_OM  = 1)
                               OR (g.GRP = 'OM6' AND dy.IS_WORK_OM6 = 1)
                               OR (g.GRP = 'IND' AND dy.IS_WORK_IND = 1))
                GROUP  BY g.DEPARTMENT_ID, dy.DT
            ),
            DEPT_DAY AS (
                SELECT e.DEPARTMENT_ID, l.LOG_DT, SUM(l.MINS) AS MINS
                FROM   GT_DPR_LOG l
                JOIN   GT_DPR_EMP e ON e.EMPID = l.USER_ID
                WHERE  l.LOG_DT BETWEEN V_FROM AND V_TO
                GROUP  BY e.DEPARTMENT_ID, l.LOG_DT
            ),
            DEPT_DAY_LV AS (                                            -- ## LEAVE
                SELECT x.DEPARTMENT_ID, x.DT, SUM(x.DAILY_EXP) AS LV_EXP
                FROM  (SELECT DISTINCT g.DEPARTMENT_ID, dy.DT, g.EMPID, g.DAILY_EXP
                         FROM DAYS dy
                         JOIN GT_DPR_LEAVE lv
                           ON dy.DT BETWEEN lv.LV_FROM AND lv.LV_TO
                         JOIN G g ON g.EMPID = lv.EMPID
                        WHERE (   (g.GRP = 'OM5' AND dy.IS_WORK_OM  = 1)
                               OR (g.GRP = 'OM6' AND dy.IS_WORK_OM6 = 1)
                               OR (g.GRP = 'IND' AND dy.IS_WORK_IND = 1))) x
                GROUP  BY x.DEPARTMENT_ID, x.DT
            )
            SELECT dp.DEPARTMENT_ID                          AS DepartmentId,
                   dp.DEPTNAME                               AS DepartmentName,
                   TO_CHAR(dy.DT,'YYYY-MM-DD')               AS LogDate,
                   ROUND(NVL(dd.MINS,0) / 60, 1)             AS LoggedHrs,
                   FLOOR(NVL(dd.MINS,0) / 60) || 'h ' ||
                     LPAD(MOD(NVL(dd.MINS,0), 60), 2, '0') || 'm' AS LoggedHrsDisplay,
                   GREATEST(NVL(dx.DAY_EXP,0) - NVL(dl.LV_EXP,0), 0) AS ExpectedHrs,   -- ## 6DAY
                   ROUND(NVL(dd.MINS,0) / 60
                         / GREATEST(NVL(dx.DAY_EXP,0) - NVL(dl.LV_EXP,0), 1) * 100, 1)
                                                             AS CompliancePct          -- ## 6DAY
            FROM   DEPTS dp
            CROSS  JOIN DAYS dy
            LEFT   JOIN DEXP dx
                   ON dx.DEPARTMENT_ID = dp.DEPARTMENT_ID AND dx.DT     = dy.DT
            LEFT   JOIN DEPT_DAY dd
                   ON dd.DEPARTMENT_ID = dp.DEPARTMENT_ID AND dd.LOG_DT = dy.DT
            LEFT   JOIN DEPT_DAY_LV dl
                   ON dl.DEPARTMENT_ID = dp.DEPARTMENT_ID AND dl.DT     = dy.DT
            ORDER  BY dp.DEPTNAME, dy.DT;

            ------------------------------------------------------------------
            -- 5. EMPLOYEES
            -- ## 6DAY — consistency denominator uses the employee's own
            -- group calendar (Omani 5-day / expat 6-day / India).
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
                WHERE  (   (UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) IN ('OMANI','NATIONALS')
                            AND c.IS_WORK_OM  = 1)
                        OR (UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) NOT IN ('OMANI','NATIONALS')
                            AND UPPER(TRIM(NVL(e.COM_LOC,'X'))) = 'IND'  AND c.IS_WORK_IND = 1)
                        OR (UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) NOT IN ('OMANI','NATIONALS')
                            AND UPPER(TRIM(NVL(e.COM_LOC,'X'))) <> 'IND' AND c.IS_WORK_OM6 = 1))   -- ## 6DAY
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
                       GREATEST(
                           CASE WHEN UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) IN ('OMANI','NATIONALS')
                                THEN V_WORK30_OM5
                                WHEN UPPER(TRIM(NVL(e.COM_LOC,'X'))) = 'IND'
                                THEN V_WORK30_IND
                                ELSE V_WORK30_OM6
                           END - NVL(l30.LV_WD30,0), 0)         AS WorkingDays30, -- ## 6DAY
                       ROUND(NVL(c30.DAYS30,0)
                             / GREATEST(
                                   CASE WHEN UPPER(TRIM(NVL(e.EMPCATEGORY,'X'))) IN ('OMANI','NATIONALS')
                                        THEN V_WORK30_OM5
                                        WHEN UPPER(TRIM(NVL(e.COM_LOC,'X'))) = 'IND'
                                        THEN V_WORK30_IND
                                        ELSE V_WORK30_OM6
                                   END - NVL(l30.LV_WD30,0), 1) * 100, 1)
                                                                  AS ConsistencyPct -- ## 6DAY
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
                || ', WorkDays=' || V_WORK_DAYS || ', Work30_6D=' || V_WORK30_OM6);

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
