------------------------------------------------------------------------------
-- 16_pkg_dpr_calc_6day.sql — RUN SECOND (after 15).
--
-- Weekend rule is now decided by CATEGORY, not location:
--   OMANI / NATIONALS         -> 5-day week (Fri + Sat off), 8 h/day
--   COM_LOC = 'IND'           -> 6-day week (Fri off), 8 h/day, ADKIND holidays
--   everyone else (expats)    -> 6-day week (Fri off), 9 h/day  ## was wrongly Fri+Sat
--
-- FN_WORKING_DAYS / FN_LEAVE_DAYS / FN_WORKING_DAYS_NET gain a new LAST
-- parameter P_CATEGORY (DEFAULT NULL). All existing positional calls still
-- compile, but every caller MUST pass the category or Omanis would be
-- treated as 6-day — script 17 updates the only caller (PKG_AI_INSIGHTS).
--
-- NOTE: replacing the SPEC invalidates PKG_AI_INSIGHTS until script 17 runs.
------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_DPR_CALC AS

    FUNCTION FN_DAILY_EXP (P_CATEGORY IN VARCHAR2,
                           P_COM_LOC  IN VARCHAR2) RETURN NUMBER;

    FUNCTION FN_WORKING_DAYS (P_FROM     IN DATE,
                              P_TO       IN DATE,
                              P_COM_LOC  IN VARCHAR2,
                              P_DOJ      IN DATE     DEFAULT NULL,
                              P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER;

    FUNCTION FN_LEAVE_DAYS (P_FROM     IN DATE,
                            P_TO       IN DATE,
                            P_EMPID    IN VARCHAR2,          -- human code, e.g. 'ITS41'
                            P_COM_LOC  IN VARCHAR2,
                            P_DOJ      IN DATE     DEFAULT NULL,
                            P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER;

    FUNCTION FN_WORKING_DAYS_NET (P_FROM     IN DATE,
                                  P_TO       IN DATE,
                                  P_EMPID    IN VARCHAR2,
                                  P_COM_LOC  IN VARCHAR2,
                                  P_DOJ      IN DATE     DEFAULT NULL,
                                  P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER;

END PKG_DPR_CALC;
/

CREATE OR REPLACE PACKAGE BODY PKG_DPR_CALC AS

    ----------------------------------------------------------------------------
    -- Group resolution — category wins over location (same precedence as
    -- FN_DAILY_EXP): 'OM5' = Omani/Nationals 5-day; 'IND' = India; 'OM6' =
    -- expat staff 6-day.
    ----------------------------------------------------------------------------
    FUNCTION FN_GRP (P_CATEGORY IN VARCHAR2, P_COM_LOC IN VARCHAR2)
        RETURN VARCHAR2 IS
    BEGIN
        RETURN CASE
                   WHEN UPPER(TRIM(NVL(P_CATEGORY,'X'))) IN ('OMANI','NATIONALS') THEN 'OM5'
                   WHEN UPPER(TRIM(NVL(P_COM_LOC,'X')))  = 'IND'                  THEN 'IND'
                   ELSE 'OM6'
               END;
    END FN_GRP;

    ----------------------------------------------------------------------------
    FUNCTION FN_DAILY_EXP (P_CATEGORY IN VARCHAR2,
                           P_COM_LOC  IN VARCHAR2) RETURN NUMBER IS
    BEGIN
        RETURN CASE
                   WHEN UPPER(TRIM(P_CATEGORY)) IN ('OMANI','NATIONALS') THEN 8
                   WHEN UPPER(TRIM(P_COM_LOC))  = 'IND'                  THEN 8   -- ## IND: was 8.5
                   ELSE 9
               END;
    END FN_DAILY_EXP;

    ----------------------------------------------------------------------------
    FUNCTION FN_WORKING_DAYS (P_FROM     IN DATE,
                              P_TO       IN DATE,
                              P_COM_LOC  IN VARCHAR2,
                              P_DOJ      IN DATE     DEFAULT NULL,
                              P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER IS
        V_FROM DATE         := GREATEST(TRUNC(P_FROM), NVL(TRUNC(P_DOJ), TRUNC(P_FROM)));
        V_TO   DATE         := TRUNC(P_TO);
        V_GRP  VARCHAR2(3)  := FN_GRP(P_CATEGORY, P_COM_LOC);
        V_CNT  NUMBER       := 0;
    BEGIN
        IF V_FROM > V_TO THEN
            RETURN 0;
        END IF;

        SELECT COUNT(*)
          INTO V_CNT
          FROM (SELECT V_FROM + LEVEL - 1 AS DT
                  FROM DUAL
               CONNECT BY V_FROM + LEVEL - 1 <= V_TO) D
         WHERE
               (    -- ## 6DAY — only Omani/Nationals get Saturday off
                    (V_GRP =  'OM5' AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') NOT IN ('FRI','SAT'))
                 OR (V_GRP <> 'OM5' AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') <> 'FRI')
               )
           AND NOT ( V_GRP = 'IND'
                     AND EXISTS (SELECT 1 FROM ADKIND_UAT.HDDETAIL H
                                  WHERE TRUNC(H.HDATE) = D.DT
                                    AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND') )
           AND NOT ( V_GRP <> 'IND'
                     AND EXISTS (SELECT 1 FROM ADK2026.HDDETAIL H
                                  WHERE TRUNC(H.HDATE) = D.DT
                                    AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND') );

        RETURN V_CNT;
    END FN_WORKING_DAYS;

    ----------------------------------------------------------------------------
    -- Working days the employee was on approved leave inside [P_FROM..P_TO].
    --
    -- IND  -> ADKIND_UAT per-day leave rows: fractional (0.5 = half day),
    --         'Privilege / Earned Leave' EXCLUDED (does not reduce the target),
    --         day counted only if it is an Indian working day.
    -- else -> ADK2026 span logic; a day inside the span counts only if it is
    --         a working day FOR THAT GROUP (Omani: not Fri/Sat; expat: not Fri).
    ----------------------------------------------------------------------------
    FUNCTION FN_LEAVE_DAYS (P_FROM     IN DATE,
                            P_TO       IN DATE,
                            P_EMPID    IN VARCHAR2,
                            P_COM_LOC  IN VARCHAR2,
                            P_DOJ      IN DATE     DEFAULT NULL,
                            P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER IS
        V_FROM DATE        := GREATEST(TRUNC(P_FROM), NVL(TRUNC(P_DOJ), TRUNC(P_FROM)));
        V_TO   DATE        := TRUNC(P_TO);
        V_GRP  VARCHAR2(3) := FN_GRP(P_CATEGORY, P_COM_LOC);
        V_CNT  NUMBER      := 0;
    BEGIN
        IF V_FROM > V_TO THEN
            RETURN 0;
        END IF;

        ------------------------------------------------------------------
        -- ## IND — per-day leave from ADKIND_UAT (fractional, PL excluded)
        ------------------------------------------------------------------
        IF V_GRP = 'IND' THEN
            SELECT NVL(SUM(DAY_LEAVE), 0)
              INTO V_CNT
              FROM (
                    -- one row per leave DAY; cap at 1 in case two half-day
                    -- applications land on the same date
                    SELECT TRUNC(ld.LDATE)                    AS LDT,
                           LEAST(SUM(NVL(ld.NOOFLEAVE,1)), 1) AS DAY_LEAVE
                      FROM ADKIND_UAT.LEAVEDETAIL ld
                      JOIN ADKIND_UAT.LBASIC  l  ON l.LBASICID    = ld.LBASICID
                                                AND l.CANCEL      = 'F'
                      JOIN ADKIND_UAT.EMPMAST e  ON e.EMPMASTID   = l.EMPMASTERID
                      JOIN ADKIND_UAT.LMDETAIL lm ON lm.LMDETAILID = ld.LVCODE
                     WHERE e.EMPID = P_EMPID
                       AND TRUNC(ld.LDATE) BETWEEN V_FROM AND V_TO
                       -- Privilege / Earned Leave keeps FULL target hours
                       AND NVL(UPPER(lm.LEAVEDESC), ' ') NOT LIKE '%PRIVILEGE%'
                       -- count only Indian WORKING days (not Fri, not holiday)
                       AND TO_CHAR(ld.LDATE,'DY','NLS_DATE_LANGUAGE=ENGLISH') <> 'FRI'
                       AND NOT EXISTS (SELECT 1 FROM ADKIND_UAT.HDDETAIL h
                                        WHERE TRUNC(h.HDATE) = TRUNC(ld.LDATE)
                                          AND UPPER(TRIM(h.HDESCRIPTION)) <> 'WEEKEND')
                     GROUP BY TRUNC(ld.LDATE)
                   );
            RETURN V_CNT;
        END IF;

        ------------------------------------------------------------------
        -- Non-IND — ADK2026 spans; working-day test depends on the group
        ------------------------------------------------------------------
        SELECT COUNT(*)
          INTO V_CNT
          FROM (SELECT V_FROM + LEVEL - 1 AS DT
                  FROM DUAL
               CONNECT BY V_FROM + LEVEL - 1 <= V_TO) D
         WHERE
               (    -- ## 6DAY — Saturday IS a working day for expat staff,
                    -- so a leave day falling on Saturday must count for them
                    (V_GRP = 'OM5' AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') NOT IN ('FRI','SAT'))
                 OR (V_GRP = 'OM6' AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') <> 'FRI')
               )
           AND NOT EXISTS (SELECT 1 FROM ADK2026.HDDETAIL H
                            WHERE TRUNC(H.HDATE) = D.DT
                              AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND')
           AND EXISTS (
                   SELECT 1
                     FROM ADK2026.LBASIC L
                     LEFT JOIN (SELECT LEAVEAPPID, MIN(AREJOINDATE) AS AREJOINDATE
                                  FROM ADK2026.REJOINBASIC
                                 WHERE CANCEL = 'F'
                                 GROUP BY LEAVEAPPID) R
                            ON R.LEAVEAPPID = L.LBASICID
                    WHERE L.CANCEL = 'F'
                      AND D.DT BETWEEN TRUNC(L.FDATE)
                                   AND TRUNC(NVL(R.AREJOINDATE - 1, L.TDATE))
                      -- lbasic.EMPID = EMPMASTID; match current AND pre-rehire identity
                      AND L.EMPID IN (
                              SELECT M.EMPMASTID
                                FROM ADK2026.EMPMAST M
                               WHERE M.EMPID = P_EMPID
                              UNION
                              SELECT MO.EMPMASTID
                                FROM ADK2026.EMPMAST M
                                JOIN ADK2026.EMPMAST MO ON MO.EMPID = M.EMPIDOLD
                               WHERE M.EMPID = P_EMPID
                          )
               );

        RETURN V_CNT;
    END FN_LEAVE_DAYS;

    ----------------------------------------------------------------------------
    -- The one every expected-hours calculation should call.
    -- For IND the result can be fractional (half-day leave), e.g. 18.5.
    ----------------------------------------------------------------------------
    FUNCTION FN_WORKING_DAYS_NET (P_FROM     IN DATE,
                                  P_TO       IN DATE,
                                  P_EMPID    IN VARCHAR2,
                                  P_COM_LOC  IN VARCHAR2,
                                  P_DOJ      IN DATE     DEFAULT NULL,
                                  P_CATEGORY IN VARCHAR2 DEFAULT NULL) RETURN NUMBER IS
    BEGIN
        RETURN GREATEST(
                   FN_WORKING_DAYS(P_FROM, P_TO, P_COM_LOC, P_DOJ, P_CATEGORY)
                 - FN_LEAVE_DAYS (P_FROM, P_TO, P_EMPID, P_COM_LOC, P_DOJ, P_CATEGORY)
               , 0);
    END FN_WORKING_DAYS_NET;

END PKG_DPR_CALC;
/

------------------------------------------------------------------------------
-- VERIFY (July 1-28 2026):
--   Omani     -> 20 working days (Fri+Sat off)
--   Expat OM  -> 24 working days (Fri only off)   ## the fix
--   India     -> 22 working days (Fri only off, ADKIND holidays)
--
-- SELECT PKG_DPR_CALC.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'OM',  NULL, 'OMANI') AS OMANI_5D,
--        PKG_DPR_CALC.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'OM',  NULL, 'STAFF') AS EXPAT_6D,
--        PKG_DPR_CALC.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'IND', NULL, 'STAFF') AS INDIA_6D
--   FROM DUAL;
------------------------------------------------------------------------------
