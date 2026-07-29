------------------------------------------------------------------------------
-- 13_pkg_dpr_calc_india.sql — FULL replacement of PKG_DPR_CALC body.
-- Two India-only changes (everyone else identical to what is deployed):
--
--   1. FN_DAILY_EXP: Indian staff daily target 8.5 -> 8 hours.
--
--   2. FN_LEAVE_DAYS: Indian leave now comes from the ADKIND_UAT schema
--      (per-day rows), not the Oman ADK2026.LBASIC spans:
--        ADKIND_UAT.LEAVEDETAIL ld  — one row per leave DAY (LDATE, NOOFLEAVE)
--        ADKIND_UAT.LBASIC      l   — application header (CANCEL, EMPMASTERID)
--        ADKIND_UAT.EMPMAST     e   — bridges EMPMASTID -> human EMPID
--        ADKIND_UAT.LMDETAIL    lm  — leave-type master (LVCODE -> LEAVEDESC)
--      Rules:
--        * NOOFLEAVE 0.5 = HALF day -> target reduced by half a day (4h) only.
--          The function now returns fractional days for IND (e.g. 2.5).
--        * 'Privilege / Earned Leave' (PL) does NOT reduce the target —
--          those days keep full expected hours. All other types (CL, SL, …)
--          reduce it.
--        * A leave day only counts if it falls on an Indian WORKING day
--          (not Friday, not an ADKIND_UAT holiday) — same rule set as
--          FN_WORKING_DAYS, so NET can never go negative from rule mismatch.
--
-- FN_WORKING_DAYS and FN_WORKING_DAYS_NET are unchanged (NET handles the
-- fractional IND result naturally: 8 x 18.5 days = 148 expected hours).
-- Consumers (PKG_AI_INSIGHTS, reports, chatbot) pick this up automatically.
------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE BODY PKG_DPR_CALC AS

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
    FUNCTION FN_WORKING_DAYS (P_FROM    IN DATE,
                              P_TO      IN DATE,
                              P_COM_LOC IN VARCHAR2,
                              P_DOJ     IN DATE DEFAULT NULL) RETURN NUMBER IS
        V_FROM   DATE   := GREATEST(TRUNC(P_FROM), NVL(TRUNC(P_DOJ), TRUNC(P_FROM)));
        V_TO     DATE   := TRUNC(P_TO);
        V_IS_IND NUMBER := CASE WHEN UPPER(TRIM(P_COM_LOC)) = 'IND' THEN 1 ELSE 0 END;
        V_CNT    NUMBER := 0;
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
               (
                    (V_IS_IND = 1 AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') <> 'FRI')
                 OR (V_IS_IND = 0 AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') NOT IN ('FRI','SAT'))
               )
           AND NOT ( V_IS_IND = 1
                     AND EXISTS (SELECT 1 FROM ADKIND_UAT.HDDETAIL H
                                  WHERE TRUNC(H.HDATE) = D.DT
                                    AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND') )
           AND NOT ( V_IS_IND = 0
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
    -- else -> ADK2026 span logic (lbasic/rejoinbasic), unchanged.
    ----------------------------------------------------------------------------
    FUNCTION FN_LEAVE_DAYS (P_FROM    IN DATE,
                            P_TO      IN DATE,
                            P_EMPID   IN VARCHAR2,
                            P_COM_LOC IN VARCHAR2,
                            P_DOJ     IN DATE DEFAULT NULL) RETURN NUMBER IS
        V_FROM   DATE   := GREATEST(TRUNC(P_FROM), NVL(TRUNC(P_DOJ), TRUNC(P_FROM)));
        V_TO     DATE   := TRUNC(P_TO);
        V_IS_IND NUMBER := CASE WHEN UPPER(TRIM(P_COM_LOC)) = 'IND' THEN 1 ELSE 0 END;
        V_CNT    NUMBER := 0;
    BEGIN
        IF V_FROM > V_TO THEN
            RETURN 0;
        END IF;

        ------------------------------------------------------------------
        -- ## IND — per-day leave from ADKIND_UAT (fractional, PL excluded)
        ------------------------------------------------------------------
        IF V_IS_IND = 1 THEN
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
        -- Non-IND — ADK2026 span logic (unchanged)
        ------------------------------------------------------------------
        SELECT COUNT(*)
          INTO V_CNT
          FROM (SELECT V_FROM + LEVEL - 1 AS DT
                  FROM DUAL
               CONNECT BY V_FROM + LEVEL - 1 <= V_TO) D
         WHERE
               TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') NOT IN ('FRI','SAT')
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
    FUNCTION FN_WORKING_DAYS_NET (P_FROM    IN DATE,
                                  P_TO      IN DATE,
                                  P_EMPID   IN VARCHAR2,
                                  P_COM_LOC IN VARCHAR2,
                                  P_DOJ     IN DATE DEFAULT NULL) RETURN NUMBER IS
    BEGIN
        RETURN GREATEST(
                   FN_WORKING_DAYS(P_FROM, P_TO, P_COM_LOC, P_DOJ)
                 - FN_LEAVE_DAYS (P_FROM, P_TO, P_EMPID, P_COM_LOC, P_DOJ)
               , 0);
    END FN_WORKING_DAYS_NET;

END PKG_DPR_CALC;
/

------------------------------------------------------------------------------
-- VERIFY with the example employee from the requirement (RAHUL JAYARAM AIS462,
-- March 2026: CL 1.0 + PL 0.5 + PL 0.5 + SL 0.5 + PL 1.0):
--   counted  = CL 1.0 + SL 0.5              = 1.5 days   (PL rows ignored)
--   expected = 8 x (working days - 1.5)
--
-- SELECT PKG_DPR_CALC.FN_DAILY_EXP('STAFF','IND')                          AS IND_DAILY,   -- 8
--        PKG_DPR_CALC.FN_LEAVE_DAYS(DATE '2026-03-01', DATE '2026-03-31',
--                                   'AIS462', 'IND')                        AS LEAVE_DAYS,  -- 1.5
--        PKG_DPR_CALC.FN_WORKING_DAYS_NET(DATE '2026-03-01', DATE '2026-03-31',
--                                   'AIS462', 'IND')                        AS NET_DAYS
--   FROM DUAL;
------------------------------------------------------------------------------
