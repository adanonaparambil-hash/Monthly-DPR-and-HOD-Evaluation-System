------------------------------------------------------------------------------
-- 07_ced_dashboard_exclude_hods.sql
-- Exclude Heads of Department from SP_GET_CED_DPR_DASHBOARD.
--
-- HODs review DPRs; they do not submit them, so their rows must not appear in
-- the dashboard at all (they were inflating headcount, dragging adoption % and
-- department compliance down, and showing up as zero-hour employees).
--
-- ONE change is enough. Everything in the procedure derives from GT_DPR_EMP:
--   GT_DPR_LOG      → INSERT ... WHERE EXISTS (SELECT 1 FROM GT_DPR_EMP ...)
--   V_ELIG_CNT      → SELECT COUNT(*) FROM GT_DPR_EMP
--   V_DAY_EXP       → SELECT SUM(DAILY_EXP) FROM GT_DPR_EMP
--   summary cursor  → GT_DPR_LOG + GT_DPR_EMP
--   dept cursor     → GT_DPR_EMP
--   daily cursor    → GT_DPR_LOG (+ GT_DPR_EMP for leave quota)
--   heatmap cursor  → GT_DPR_EMP + GT_DPR_LOG
--   employee cursor → GT_DPR_EMP
-- so filtering the Stage A1 INSERT removes HODs from every output.
--
-- Full updated procedure: 03_sp_get_ced_dpr_dashboard.sql (already contains this).
-- To patch a live copy by hand, add the NOT EXISTS block below to the WHERE
-- clause of the Stage A1 "INSERT INTO GT_DPR_EMP ... FROM (SELECT ...) x".
------------------------------------------------------------------------------

/*  ── the patch ───────────────────────────────────────────────────────────────

        WHERE  TRIM(UPPER(e.CURRENTSTATUS)) = 'ACTIVE'
          AND  TRIM(UPPER(NVL(e.IS_DPR,'N'))) = 'Y'
          AND  e.EMPLOYEENAME IS NOT NULL
          -- ## HOD — HODs don't submit DPRs; keep them out of every cursor.
          AND  NOT EXISTS (
                   SELECT 1
                     FROM TM_DPR_HOD_MASTER h
                    WHERE h.EMP_ID = e.EMPID
                      AND TRIM(h.IS_ACTIVE) = 'Y'
               )
    ) x;

    ────────────────────────────────────────────────────────────────────────── */

------------------------------------------------------------------------------
-- VERIFY (run after recompiling the package body)
------------------------------------------------------------------------------

-- V1. How many active HODs will be removed, and who are they?
SELECT h.EMP_ID, e.EMPLOYEENAME, e.DEPARTMENT
  FROM TM_DPR_HOD_MASTER h
  JOIN TM_DPR_EMPLOYEE_DETAILS e ON e.EMPID = h.EMP_ID
 WHERE TRIM(h.IS_ACTIVE) = 'Y'
 ORDER BY e.DEPARTMENT, e.EMPLOYEENAME;

-- V2. Headcount before vs after. The dashboard's TotalEmployees should drop by
--     exactly the DISTINCT count from V1 (one HOD can head several departments,
--     so TM_DPR_HOD_MASTER may hold repeated EMP_IDs — NOT EXISTS de-dupes).
SELECT COUNT(*) AS eligible_incl_hods,
       COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                                    WHERE h.EMP_ID = e.EMPID
                                      AND TRIM(h.IS_ACTIVE) = 'Y')
                  THEN 1 END)      AS eligible_excl_hods
  FROM TM_DPR_EMPLOYEE_DETAILS e
  JOIN TM_DEPTMASTER d ON d.DEPTNAME = e.DEPARTMENT AND d.IS_ACTIVE = 'Y'
 WHERE TRIM(UPPER(e.CURRENTSTATUS)) = 'ACTIVE'
   AND TRIM(UPPER(NVL(e.IS_DPR,'N'))) = 'Y'
   AND e.EMPLOYEENAME IS NOT NULL;

-- V3. Both sources must now agree on headcount — the dashboard and the AI
--     report should show the SAME eligible-employee count for a given range.
--     Run the dashboard proc for a range, note TotalEmployees, and compare with
--     the AI report's "Eligible Employees" KPI tile for the same range.

-- V4. Sanity: no HOD may survive in the dashboard's employee cursor. After
--     running the proc, GT_DPR_EMP must return zero rows here:
--       SELECT g.EMPID, g.EMPLOYEENAME
--         FROM GT_DPR_EMP g
--        WHERE EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
--                       WHERE h.EMP_ID = g.EMPID AND TRIM(h.IS_ACTIVE) = 'Y');
--     (GT_DPR_EMP is an ON COMMIT PRESERVE ROWS GTT, so query it in the SAME
--      session that ran the procedure, before any commit/reconnect.)
