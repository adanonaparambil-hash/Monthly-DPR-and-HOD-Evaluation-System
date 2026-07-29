------------------------------------------------------------------------------
-- 20_pkg_dpr_calc_india_sat.sql — USE THIS INSTEAD OF SCRIPT 16.
-- Compile AFTER 19. (If 16 was already compiled, just compile this on top.)
--
-- Same as 16 (category-based weekends: Omani 5-day, expat 6-day, India) PLUS
-- the India weekend correction (## INDSAT):
--   India weekly off = FRIDAY ONLY. Saturdays (incl. 2nd/4th) and Sundays
--   are WORKING days. ADKIND_UAT.HDDETAIL supplies only real public
--   holidays — weekend-type rows are ignored as data-entry noise: WEEKEND
--   (incl. misspellings WEEKNED/WEKEND/WEEKNEND), bare SUNDAY/SATURDAY/W,
--   and 2nd/4th Sat(/Sun) texts in every spelling seen. A genuine holiday
--   merely containing SAT (e.g. SATYANARAYAN) still counts.
-- Oman logic identical to 16. Spec (16's CREATE OR REPLACE PACKAGE) is
-- unchanged — this file carries both spec and body so it works standalone.
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

        ------------------------------------------------------------------
        -- ## INDSAT — India: weekly off = FRIDAY ONLY (Saturdays and
        -- Sundays are working days; 2nd/4th Saturday is NOT off) + real
        -- public holidays. Weekend-type HDDETAIL rows are ignored.
        ------------------------------------------------------------------
        IF V_GRP = 'IND' THEN
            SELECT COUNT(*)
              INTO V_CNT
              FROM (SELECT V_FROM + LEVEL - 1 AS DT
                      FROM DUAL
                   CONNECT BY V_FROM + LEVEL - 1 <= V_TO) D
             WHERE TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') <> 'FRI'
               -- real public holidays only: skip weekend rows (incl. the
               -- misspellings WEEKNED/WEKEND/WEEKNEND), bare SUNDAY/SATURDAY/W,
               -- and 2nd/4th Sat(/Sun) texts in every spelling seen — but a
               -- holiday merely containing SAT (e.g. SATYANARAYAN) still counts
               AND NOT EXISTS (SELECT 1 FROM ADKIND_UAT.HDDETAIL H
                                WHERE TRUNC(H.HDATE) = D.DT
                                  AND NOT REGEXP_LIKE(UPPER(TRIM(H.HDESCRIPTION)), '^WE+K')
                                  AND UPPER(TRIM(H.HDESCRIPTION)) NOT IN ('SUNDAY','SATURDAY','W')
                                  AND NOT REGEXP_LIKE(UPPER(TRIM(H.HDESCRIPTION)),
                                          '(2|4|SECOND|FOURTH).*(SAT|SUN)|(SAT|SUN).*(2|4|SECOND|FOURTH)'));
            RETURN V_CNT;
        END IF;

        ------------------------------------------------------------------
        -- Oman: Omani/Nationals 5-day, expat staff 6-day (## 6DAY)
        ------------------------------------------------------------------
        SELECT COUNT(*)
          INTO V_CNT
          FROM (SELECT V_FROM + LEVEL - 1 AS DT
                  FROM DUAL
               CONNECT BY V_FROM + LEVEL - 1 <= V_TO) D
         WHERE
               (
                    (V_GRP = 'OM5' AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') NOT IN ('FRI','SAT'))
                 OR (V_GRP = 'OM6' AND TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') <> 'FRI')
               )
           AND NOT EXISTS (SELECT 1 FROM ADK2026.HDDETAIL H
                            WHERE TRUNC(H.HDATE) = D.DT
                              AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND');

        RETURN V_CNT;
    END FN_WORKING_DAYS;

    ----------------------------------------------------------------------------
    -- Working days the employee was on approved leave inside [P_FROM..P_TO].
    --
    -- IND  -> ADKIND_UAT per-day leave rows: fractional (0.5 = half day),
    --         'Privilege / Earned Leave' EXCLUDED (does not reduce the target),
    --         day counted only if it is an Indian working day (## INDSAT rule).
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
                       -- ## INDSAT — count only Indian WORKING days:
                       -- not Friday, not a real public holiday
                       AND TO_CHAR(ld.LDATE,'DY','NLS_DATE_LANGUAGE=ENGLISH') <> 'FRI'
                       AND NOT EXISTS (SELECT 1 FROM ADKIND_UAT.HDDETAIL h
                                        WHERE TRUNC(h.HDATE) = TRUNC(ld.LDATE)
                                          AND NOT REGEXP_LIKE(UPPER(TRIM(h.HDESCRIPTION)), '^WE+K')
                                          AND UPPER(TRIM(h.HDESCRIPTION)) NOT IN ('SUNDAY','SATURDAY','W')
                                          AND NOT REGEXP_LIKE(UPPER(TRIM(h.HDESCRIPTION)),
                                                  '(2|4|SECOND|FOURTH).*(SAT|SUN)|(SAT|SUN).*(2|4|SECOND|FOURTH)'))
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
-- VERIFY (July 1-28 2026): OMANI_5D=20, EXPAT_6D=24,
-- INDIA=24 (only the 4 Fridays are off; the 2ND SAT / 4TH SAT rows on
-- 11 & 25 Jul are ignored — Saturdays are working days for India).
--
-- SELECT PKG_DPR_CALC.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'OM',  NULL, 'OMANI') AS OMANI_5D,
--        PKG_DPR_CALC.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'OM',  NULL, 'STAFF') AS EXPAT_6D,
--        PKG_DPR_CALC.FN_WORKING_DAYS(DATE '2026-07-01', DATE '2026-07-28', 'IND', NULL, 'STAFF') AS INDIA
--   FROM DUAL;
--
-- Real-holiday check — January 2026: 31 days - 5 Fridays - REPUBLIC DAY
-- (26 Jan, a Monday) = 25. The 2nd/4th-Sat rows in January are ignored.
--
-- SELECT PKG_DPR_CALC.FN_WORKING_DAYS(DATE '2026-01-01', DATE '2026-01-31', 'IND', NULL, 'STAFF') AS INDIA_JAN
--   FROM DUAL;
------------------------------------------------------------------------------
