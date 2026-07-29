------------------------------------------------------------------------------
-- 15_work_calendar_6day.sql — RUN FIRST (before 16/17/18).
--
-- WHY: the weekend rule was wrong for expatriate staff in Oman. Only
-- OMANI / NATIONALS have the 5-day week (Friday + Saturday off).
-- Expat staff work 6 days — Friday only off. The calendar table only had
-- two profiles (OM = 5-day, IND) so every non-Indian employee was being
-- given Fri+Sat off. This adds the third profile:
--
--   IS_WORK_OM  / CUM_OM   -> Omani/Nationals : Fri+Sat off, ADK2026 holidays
--   IS_WORK_OM6 / CUM_OM6  -> NEW  expat staff: Fri only off, ADK2026 holidays
--   IS_WORK_IND / CUM_IND  -> India           : Fri only off, ADKIND_UAT holidays
--
-- STEP 1: add the two columns (skip if they already exist).
------------------------------------------------------------------------------
ALTER TABLE TM_WORK_CALENDAR ADD (IS_WORK_OM6 NUMBER(1), CUM_OM6 NUMBER);

------------------------------------------------------------------------------
-- STEP 2: rebuild procedure now fills all three profiles.
------------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_BUILD_WORK_CALENDAR AS
BEGIN
  EXECUTE IMMEDIATE 'TRUNCATE TABLE TM_WORK_CALENDAR';

  INSERT INTO TM_WORK_CALENDAR (DT, IS_WORK_OM, IS_WORK_OM6, IS_WORK_IND,
                                CUM_OM, CUM_OM6, CUM_IND)
  WITH D AS (
      SELECT DATE '2015-01-01' + LEVEL - 1 AS DT
      FROM   DUAL
      CONNECT BY DATE '2015-01-01' + LEVEL - 1 <= DATE '2035-12-31'
  ),
  F AS (
      SELECT D.DT,
             -- Omani / Nationals: 5-day week (Fri + Sat off) + Oman holidays
             CASE WHEN TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') IN ('FRI','SAT') THEN 0
                  WHEN EXISTS (SELECT 1 FROM ADK2026.HDDETAIL H
                               WHERE TRUNC(H.HDATE) = D.DT
                                 AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND') THEN 0
                  ELSE 1 END AS W_OM,
             -- ## 6DAY — expat staff in Oman: 6-day week (Fri only off) + Oman holidays
             CASE WHEN TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') = 'FRI' THEN 0
                  WHEN EXISTS (SELECT 1 FROM ADK2026.HDDETAIL H
                               WHERE TRUNC(H.HDATE) = D.DT
                                 AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND') THEN 0
                  ELSE 1 END AS W_OM6,
             -- India: 6-day week (Fri only off) + India holidays
             CASE WHEN TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') = 'FRI' THEN 0
                  WHEN EXISTS (SELECT 1 FROM ADKIND_UAT.HDDETAIL H
                               WHERE TRUNC(H.HDATE) = D.DT
                                 AND UPPER(TRIM(H.HDESCRIPTION)) <> 'WEEKEND') THEN 0
                  ELSE 1 END AS W_IND
      FROM D
  )
  SELECT DT, W_OM, W_OM6, W_IND,
         SUM(W_OM)  OVER (ORDER BY DT),
         SUM(W_OM6) OVER (ORDER BY DT),
         SUM(W_IND) OVER (ORDER BY DT)
  FROM   F;

  COMMIT;
END;
/

------------------------------------------------------------------------------
-- STEP 3: rebuild the calendar data NOW.
------------------------------------------------------------------------------
BEGIN
  SP_BUILD_WORK_CALENDAR;
END;
/

------------------------------------------------------------------------------
-- VERIFY: July 2026 (1st..28th) should give OM(5-day)=20, OM6(6-day)=24, IND=22
-- (any Oman/India public holidays in the range reduce these further).
--
-- SELECT SUM(IS_WORK_OM)  AS OM_5DAY,
--        SUM(IS_WORK_OM6) AS OM_6DAY,
--        SUM(IS_WORK_IND) AS IND
--   FROM TM_WORK_CALENDAR
--  WHERE DT BETWEEN DATE '2026-07-01' AND DATE '2026-07-28';
------------------------------------------------------------------------------
