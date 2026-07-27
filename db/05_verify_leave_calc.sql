------------------------------------------------------------------------------
-- 05_verify_leave_calc.sql — run these BEFORE and AFTER deploying to prove
-- the numbers move the right way. Pick an employee you KNOW took leave.
------------------------------------------------------------------------------

-- V1. Does the calendar table have the IND working-day flag the new code uses?
--     (Stage A already used CUM_IND, so IS_WORK_IND should exist. If this
--      returns no row, tell me — the UPDATE in 03 must fall back to CUM diff.)
SELECT column_name
  FROM all_tab_columns
 WHERE table_name = 'TM_WORK_CALENDAR'
   AND column_name IN ('IS_WORK_OM','IS_WORK_IND','CUM_OM','CUM_IND');

-- V2. Gross vs leave vs net for one employee / one range (edit the 3 values):
SELECT PKG_DPR_CALC.FN_WORKING_DAYS    (DATE '2025-06-01', DATE '2025-06-30', e.COM_LOC, e.DOJ)            AS GROSS_WD,
       PKG_DPR_CALC.FN_LEAVE_DAYS      (DATE '2025-06-01', DATE '2025-06-30', e.EMPID, e.COM_LOC, e.DOJ)   AS LEAVE_WD,
       PKG_DPR_CALC.FN_WORKING_DAYS_NET(DATE '2025-06-01', DATE '2025-06-30', e.EMPID, e.COM_LOC, e.DOJ)   AS NET_WD
  FROM TM_DPR_EMPLOYEE_DETAILS e
 WHERE e.EMPID = 'ITS41';

-- V3. Cross-check LEAVE_WD against the raw leave rows for the same person:
SELECT em.EMPID, l.LEAVEDESC,
       TRUNC(l.FDATE) AS FROM_DT, TRUNC(l.TDATE) AS TO_DT,
       TRUNC(r.AREJOINDATE) AS REJOIN,
       TRUNC(NVL(r.AREJOINDATE-1, l.TDATE)) AS EFFECTIVE_END
  FROM ADK2026.LBASIC l
  JOIN ADK2026.EMPMAST em ON em.EMPMASTID = l.EMPID
  LEFT JOIN (SELECT LEAVEAPPID, MIN(AREJOINDATE) AS AREJOINDATE
               FROM ADK2026.REJOINBASIC WHERE CANCEL='F' GROUP BY LEAVEAPPID) r
         ON r.LEAVEAPPID = l.LBASICID
 WHERE l.CANCEL = 'F'
   AND em.EMPID = 'ITS41'
   AND TRUNC(l.FDATE) <= DATE '2025-06-30'
   AND TRUNC(NVL(r.AREJOINDATE-1, l.TDATE)) >= DATE '2025-06-01';

-- V4. After deploying 03: expected hours must DROP only for people with leave.
--     Run the dashboard for a month with known leave, then:
--       * Employee cursor: LeaveDays > 0 exactly for the leave-takers,
--         their ExpectedHrs = DailyExpectedHrs * WorkingDays (already net).
--       * Summary.ExpectedHours = SUM of employee ExpectedHrs.
--       * An employee on leave the FULL range: ExpectedHrs = 0,
--         CompliancePct uses GREATEST(...,1) so no divide-by-zero.

-- V5. Data-quality guard: any live leave rows with multiple live rejoins?
--     (MIN() in the code handles it, but these are worth cleaning.)
SELECT LEAVEAPPID, COUNT(*)
  FROM ADK2026.REJOINBASIC
 WHERE CANCEL = 'F'
 GROUP BY LEAVEAPPID
HAVING COUNT(*) > 1;
