------------------------------------------------------------------------------
-- 02_pkg_dpr_calc.sql — PKG_DPR_CALC with leave-aware working days.
--
-- New:
--   FN_LEAVE_DAYS        — working days inside approved leave spans
--                          (adk2026.lbasic + rejoinbasic), per employee,
--                          counted with the SAME weekend/holiday rules as
--                          FN_WORKING_DAYS so the subtraction is apples-to-apples.
--   FN_WORKING_DAYS_NET  — FN_WORKING_DAYS minus FN_LEAVE_DAYS (floored at 0).
--                          This is what every expected-hours calc should use.
--
-- Leave rules baked in (per lbasic/rejoinbasic semantics):
--   * lbasic.EMPID stores EMPMAST.EMPMASTID (surrogate), NOT the code 'ITS41'
--     → bridged through ADK2026.EMPMAST, including EMPIDOLD for rehires.
--   * cancel = 'F' rows only, on both lbasic and rejoinbasic.
--   * effective end = NVL(actual rejoin date - 1, applied tdate):
--     the rejoin day itself is a WORKED day, never a leave day.
--   * all leave types count (Annual/Sick/Unpaid/etc. — LEAVEDESC not filtered).
------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE PKG_DPR_CALC AS

    FUNCTION FN_DAILY_EXP (P_CATEGORY IN VARCHAR2,
                           P_COM_LOC  IN VARCHAR2) RETURN NUMBER;

    FUNCTION FN_WORKING_DAYS (P_FROM    IN DATE,
                              P_TO      IN DATE,
                              P_COM_LOC IN VARCHAR2,
                              P_DOJ     IN DATE DEFAULT NULL) RETURN NUMBER;

    FUNCTION FN_LEAVE_DAYS (P_FROM    IN DATE,
                            P_TO      IN DATE,
                            P_EMPID   IN VARCHAR2,          -- human code, e.g. 'ITS41'
                            P_COM_LOC IN VARCHAR2,
                            P_DOJ     IN DATE DEFAULT NULL) RETURN NUMBER;

    FUNCTION FN_WORKING_DAYS_NET (P_FROM    IN DATE,
                                  P_TO      IN DATE,
                                  P_EMPID   IN VARCHAR2,
                                  P_COM_LOC IN VARCHAR2,
                                  P_DOJ     IN DATE DEFAULT NULL) RETURN NUMBER;

END PKG_DPR_CALC;
/

CREATE OR REPLACE PACKAGE BODY PKG_DPR_CALC AS

    ----------------------------------------------------------------------------
    FUNCTION FN_DAILY_EXP (P_CATEGORY IN VARCHAR2,
                           P_COM_LOC  IN VARCHAR2) RETURN NUMBER IS
    BEGIN
        RETURN CASE
                   WHEN UPPER(TRIM(P_CATEGORY)) IN ('OMANI','NATIONALS') THEN 8
                   WHEN UPPER(TRIM(P_COM_LOC))  = 'IND'                  THEN 8.5
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
    -- Same weekend + holiday filters as FN_WORKING_DAYS, so
    --   NET = FN_WORKING_DAYS - FN_LEAVE_DAYS
    -- can never go negative from rule mismatch. Overlapping leave applications
    -- cannot double-count a day (EXISTS, day-driven).
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
                                    AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND') )
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
