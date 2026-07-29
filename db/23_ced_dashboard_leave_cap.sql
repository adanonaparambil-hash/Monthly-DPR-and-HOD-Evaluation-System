------------------------------------------------------------------------------
-- 23_ced_dashboard_leave_cap.sql
-- ONE-LINE fix inside PKG_TMST_TASK.SP_GET_CED_DPR_DASHBOARD, stage A3.
--
-- WHY
--   PKG_DPR_CALC.FN_LEAVE_DAYS (the AI section) caps each Indian leave DAY at
--   1.0 before summing:
--         LEAST(SUM(NVL(ld.NOOFLEAVE,1)), 1)   per TRUNC(LDATE)
--   The dashboard sums the raw rows instead:
--         SUM(NVL(ld.NOOFLEAVE,1))             over the whole range
--   so if one date carries more than 1.0 day of leave (overlapping / duplicate
--   applications) the dashboard subtracts MORE leave than the AI report does,
--   giving that employee a smaller target and a higher compliance %.
--
--   Live data check (29-Jul-2026): 1 such employee-day exists in the whole
--   history (AIS62, 28-Jun-2017, total 2.0 -> 1.0 day over-subtracted); 0 in
--   the last 12 months. So the numbers agree TODAY, but the two paths can
--   silently drift apart the moment such a row is entered again. This patch
--   makes the dashboard use the same capped-per-day rule.
--
-- HOW TO APPLY
--   In the PKG_TMST_TASK package body, inside SP_GET_CED_DPR_DASHBOARD,
--   stage "A3: leave working days per employee", replace the IND branch of
--   the CASE with the block below, then compile the package. Nothing else in
--   the procedure changes.
------------------------------------------------------------------------------

-- ─── BEFORE (current, uncapped) ───────────────────────────────────────────
--                 CASE WHEN UPPER(TRIM(g.COM_LOC)) = 'IND' THEN
--                     NVL((SELECT SUM(NVL(ld.NOOFLEAVE, 1))
--                            FROM ADKIND_UAT.EMPMAST  e
--                            JOIN ADKIND_UAT.LBASIC   l  ON l.EMPMASTERID = e.EMPMASTID
--                                                       AND l.CANCEL      = 'F'
--                            JOIN ADKIND_UAT.LEAVEDETAIL ld ON ld.LBASICID = l.LBASICID
--                            JOIN ADKIND_UAT.LMDETAIL lm ON lm.LMDETAILID  = ld.LVCODE
--                            JOIN TM_WORK_CALENDAR    c  ON c.DT = TRUNC(ld.LDATE)
--                                                       AND c.IS_WORK_IND = 1
--                           WHERE e.EMPID = g.EMPID
--                             AND TRUNC(ld.LDATE) BETWEEN V_FROM AND V_TO
--                             AND NVL(UPPER(lm.LEAVEDESC), ' ') NOT LIKE '%PRIVILEGE%'), 0)

-- ─── AFTER (capped per day — matches PKG_DPR_CALC.FN_LEAVE_DAYS) ──────────
                   CASE WHEN UPPER(TRIM(g.COM_LOC)) = 'IND' THEN               -- ## IND
                       -- ## CAP — group to ONE row per leave date and cap that
                       -- date at 1.0 day, exactly like PKG_DPR_CALC does, so
                       -- overlapping applications on the same date can never
                       -- subtract more than a single working day.
                       NVL((SELECT SUM(DAY_LEAVE)
                              FROM (SELECT LEAST(SUM(NVL(ld.NOOFLEAVE, 1)), 1) AS DAY_LEAVE
                                      FROM ADKIND_UAT.EMPMAST  e
                                      JOIN ADKIND_UAT.LBASIC   l  ON l.EMPMASTERID = e.EMPMASTID
                                                                 AND l.CANCEL      = 'F'
                                      JOIN ADKIND_UAT.LEAVEDETAIL ld ON ld.LBASICID = l.LBASICID
                                      JOIN ADKIND_UAT.LMDETAIL lm ON lm.LMDETAILID  = ld.LVCODE
                                      JOIN TM_WORK_CALENDAR    c  ON c.DT = TRUNC(ld.LDATE)
                                                                 AND c.IS_WORK_IND = 1
                                     WHERE e.EMPID = g.EMPID
                                       AND TRUNC(ld.LDATE) BETWEEN V_FROM AND V_TO
                                       AND NVL(UPPER(lm.LEAVEDESC), ' ') NOT LIKE '%PRIVILEGE%'
                                     GROUP BY TRUNC(ld.LDATE))), 0)

------------------------------------------------------------------------------
-- VERIFY after compiling — for every Indian DPR employee the dashboard's
-- LEAVE_DAYS must equal PKG_DPR_CALC.FN_LEAVE_DAYS for the same window.
-- This query compares the two directly (0 rows = the two paths agree):
--
-- WITH DASH AS (
--   SELECT e.EMPID,
--          NVL((SELECT SUM(DAY_LEAVE)
--                 FROM (SELECT LEAST(SUM(NVL(ld.NOOFLEAVE,1)),1) AS DAY_LEAVE
--                         FROM ADKIND_UAT.EMPMAST  x
--                         JOIN ADKIND_UAT.LBASIC   l  ON l.EMPMASTERID = x.EMPMASTID AND l.CANCEL='F'
--                         JOIN ADKIND_UAT.LEAVEDETAIL ld ON ld.LBASICID = l.LBASICID
--                         JOIN ADKIND_UAT.LMDETAIL lm ON lm.LMDETAILID = ld.LVCODE
--                         JOIN TM_WORK_CALENDAR    c  ON c.DT = TRUNC(ld.LDATE) AND c.IS_WORK_IND = 1
--                        WHERE x.EMPID = e.EMPID
--                          AND TRUNC(ld.LDATE) BETWEEN DATE '2026-07-01' AND DATE '2026-07-28'
--                          AND NVL(UPPER(lm.LEAVEDESC),' ') NOT LIKE '%PRIVILEGE%'
--                        GROUP BY TRUNC(ld.LDATE))), 0) AS DASH_LV
--     FROM TM_DPR_EMPLOYEE_DETAILS e
--    WHERE UPPER(TRIM(e.COM_LOC)) = 'IND'
--      AND TRIM(UPPER(e.CURRENTSTATUS)) = 'ACTIVE'
--      AND TRIM(UPPER(NVL(e.IS_DPR,'N'))) = 'Y')
-- SELECT d.EMPID, d.DASH_LV,
--        PKG_DPR_CALC.FN_LEAVE_DAYS(DATE '2026-07-01', DATE '2026-07-28',
--                                   d.EMPID, 'IND', NULL, 'STAFF') AS FN_LV
--   FROM DASH d
--  WHERE d.DASH_LV <> PKG_DPR_CALC.FN_LEAVE_DAYS(DATE '2026-07-01', DATE '2026-07-28',
--                                                d.EMPID, 'IND', NULL, 'STAFF');
------------------------------------------------------------------------------
