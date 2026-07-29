------------------------------------------------------------------------------
-- 22b_ai_insights_delegate_fns.sql
--
-- ALTERNATIVE to db/22 — pick ONE of the two, not both:
--
--   db/22  = DELETE the duplicate functions from PKG_AI_INSIGHTS.
--            Cleanest, but any outside caller (n8n workflow, a saved Toad
--            query, a report someone wrote) that calls
--            PKG_AI_INSIGHTS.FN_DAILY_EXP / FN_WORKING_DAYS would start
--            failing with PLS-00302.
--
--   db/22b = KEEP the function names but make them thin wrappers that call
--            PKG_DPR_CALC. Any existing caller keeps working AND starts
--            getting the correct numbers. Zero risk of breaking anything.
--
-- Use db/22b if you are not certain nothing outside the database calls them.
--
-- WHAT IS WRONG TODAY (measured on live data, 1-28 Jul 2026):
--   PKG_AI_INSIGHTS.FN_DAILY_EXP('STAFF','IND')  = 8.5   should be 8
--   PKG_AI_INSIGHTS.FN_WORKING_DAYS(...,'IND')   = 22    should be 24
--   PKG_AI_INSIGHTS.FN_WORKING_DAYS(...,'OM')    = 20    should be 24
-- because these copies were never updated when the India (8 h, Friday-only
-- weekend) and expat (6-day week) rules changed in PKG_DPR_CALC.
--
-- After this script both names still exist, but every answer comes from
-- PKG_DPR_CALC — one source of truth, no second copy of the rules to drift.
--
-- Only the two functions change. Every procedure in the package is left
-- exactly as deployed, so ONLY the two blocks below need pasting:
--   1. replace the two FUNCTION declarations at the end of the package SPEC
--   2. replace the two FUNCTION bodies at the end of the package BODY
-- then compile spec, then body.
------------------------------------------------------------------------------


-- ═══ 1. In the package SPEC, replace the two declarations with these ══════
--        (P_CATEGORY is NEW and defaults to NULL, so every existing
--         3- and 4-argument call still compiles unchanged.)

    -- DEPRECATED: kept only for backward compatibility.
    -- New code must call PKG_DPR_CALC.FN_DAILY_EXP directly.
    FUNCTION FN_DAILY_EXP (P_CATEGORY IN VARCHAR2,
                           P_COM_LOC  IN VARCHAR2) RETURN NUMBER;

    -- DEPRECATED: kept only for backward compatibility.
    -- New code must call PKG_DPR_CALC.FN_WORKING_DAYS directly.
    FUNCTION FN_WORKING_DAYS (P_FROM     IN DATE,
                              P_TO       IN DATE,
                              P_COM_LOC  IN VARCHAR2,
                              P_DOJ      IN DATE     DEFAULT NULL,
                              P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER;


-- ═══ 2. In the package BODY, replace the two function bodies with these ═══

    ----------------------------------------------------------------------------
    -- DEPRECATED WRAPPER — delegates to PKG_DPR_CALC so the daily-hours rule
    -- lives in exactly one place. (This copy used to hard-code 8.5 for India.)
    ----------------------------------------------------------------------------
    FUNCTION FN_DAILY_EXP (P_CATEGORY IN VARCHAR2,
                           P_COM_LOC  IN VARCHAR2) RETURN NUMBER IS
    BEGIN
        RETURN PKG_DPR_CALC.FN_DAILY_EXP(P_CATEGORY, P_COM_LOC);
    END FN_DAILY_EXP;

    ----------------------------------------------------------------------------
    -- DEPRECATED WRAPPER — delegates to PKG_DPR_CALC.
    --
    -- IMPORTANT: the weekend rule depends on CATEGORY, not location
    -- (only OMANI/NATIONALS get the 5-day Fri+Sat week; expat staff and
    -- India work 6 days). This old signature had no category, which is
    -- exactly why it returned 20 days for expats instead of 24.
    --
    -- P_CATEGORY is therefore optional-but-important:
    --   passed      -> fully correct for all three groups
    --   omitted     -> PKG_DPR_CALC treats a non-IND employee as expat
    --                  (6-day). Correct for expats and India; an
    --                  Omani/National would be over-counted, so ALWAYS pass
    --                  EMPCATEGORY when the caller has it.
    ----------------------------------------------------------------------------
    FUNCTION FN_WORKING_DAYS (P_FROM     IN DATE,
                              P_TO       IN DATE,
                              P_COM_LOC  IN VARCHAR2,
                              P_DOJ      IN DATE     DEFAULT NULL,
                              P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER IS
    BEGIN
        RETURN PKG_DPR_CALC.FN_WORKING_DAYS(P_FROM, P_TO, P_COM_LOC,
                                            P_DOJ, P_CATEGORY);
    END FN_WORKING_DAYS;


------------------------------------------------------------------------------
-- VERIFY after compiling — the two packages must now agree everywhere:
--
-- SELECT PKG_AI_INSIGHTS.FN_DAILY_EXP('STAFF','IND')  AS AI_IND,   -- 8
--        PKG_DPR_CALC.FN_DAILY_EXP  ('STAFF','IND')   AS CALC_IND, -- 8
--        PKG_AI_INSIGHTS.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28',
--                                        'IND', NULL, 'STAFF')     AS AI_IND_D,   -- 24
--        PKG_AI_INSIGHTS.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28',
--                                        'OM',  NULL, 'STAFF')     AS AI_EXPAT_D, -- 24
--        PKG_AI_INSIGHTS.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28',
--                                        'OM',  NULL, 'OMANI')     AS AI_OMANI_D  -- 20
--   FROM DUAL;
--
-- Old 3-argument calls must still work (backward compatibility):
--
-- SELECT PKG_AI_INSIGHTS.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'IND')
--   FROM DUAL;   -- 24
------------------------------------------------------------------------------
