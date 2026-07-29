------------------------------------------------------------------------------
-- 19_work_calendar_india_sat.sql — USE THIS INSTEAD OF SCRIPT 15.
-- (If 15 was already run, just run this one on top — it replaces the same
--  procedure and rebuilds the data. Only the ALTER will error with
--  ORA-01430 "column being added already exists" — that is fine, skip it.)
--
-- INDIA rule (## INDSAT): weekly off = FRIDAY ONLY. Saturdays (including
-- 2nd/4th) and Sundays are WORKING days. Off days = Friday + real public
-- holidays from ADKIND_UAT.HDDETAIL. The weekend-type rows in HDDETAIL
-- ('weekend' incl. misspellings WEEKNED/WEKEND/WEEKNEND, bare
-- SUNDAY/SATURDAY/W, and every 2nd/4th Sat(/Sun) spelling like
-- 'SECOND SAT', '2 nd saturday', '4 th saturday') are data-entry noise and
-- are IGNORED — they are NOT holidays and NOT weekly offs. A genuine
-- holiday whose name contains SAT (e.g. SATYANARAYAN) still counts.
--
-- Oman profiles (OM 5-day, OM6 6-day) are unchanged.
------------------------------------------------------------------------------
ALTER TABLE TM_WORK_CALENDAR ADD (IS_WORK_OM6 NUMBER(1), CUM_OM6 NUMBER);

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
             -- ## INDSAT — India: weekly off = FRIDAY ONLY. Saturdays and
             -- Sundays are WORKING days (2nd/4th Saturday is NOT off).
             -- Off = Friday + real public holidays. The weekend-type rows in
             -- HDDETAIL are data-entry noise and must be IGNORED: 'weekend'
             -- (+ misspellings), bare SUNDAY/SATURDAY/W, and every
             -- 2nd/4th-Sat(/Sun) text ('2nd SATURDAY', '4 th saturday', ...).
             -- A real holiday containing SAT (e.g. SATYANARAYAN) still counts.
             CASE WHEN TO_CHAR(D.DT,'DY','NLS_DATE_LANGUAGE=ENGLISH') = 'FRI' THEN 0
                  WHEN EXISTS (SELECT 1 FROM ADKIND_UAT.HDDETAIL H
                               WHERE TRUNC(H.HDATE) = D.DT
                                 -- WEEKEND + misspellings (WEEKNED/WEKEND/WEEKNEND)
                                 AND NOT REGEXP_LIKE(UPPER(TRIM(H.HDESCRIPTION)), '^WE+K')
                                 AND UPPER(TRIM(H.HDESCRIPTION)) NOT IN ('SUNDAY','SATURDAY','W')
                                 -- 2nd/4th Sat(/Sun) texts in every spelling seen
                                 AND NOT REGEXP_LIKE(UPPER(TRIM(H.HDESCRIPTION)),
                                         '(2|4|SECOND|FOURTH).*(SAT|SUN)|(SAT|SUN).*(2|4|SECOND|FOURTH)')) THEN 0
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

BEGIN
  SP_BUILD_WORK_CALENDAR;
END;
/

------------------------------------------------------------------------------
-- VERIFY (July 1-28 2026): OM_5DAY=20, OM_6DAY=24,
-- IND=24 (28 - 4 Fridays; the '2ND SAT'/'4TH SAT' rows on 11 & 25 Jul are
-- ignored — those are working days; no real public holiday in the range)
--
-- SELECT SUM(IS_WORK_OM)  AS OM_5DAY,
--        SUM(IS_WORK_OM6) AS OM_6DAY,
--        SUM(IS_WORK_IND) AS IND
--   FROM TM_WORK_CALENDAR
--  WHERE DT BETWEEN DATE '2026-07-01' AND DATE '2026-07-28';
--
-- Spot-check: 11 & 25 Jul 2026 (2nd/4th Sat rows exist in HDDETAIL) must be
-- WORKING days now, and a real holiday (e.g. 26 Jan Republic Day) must be 0:
--
-- SELECT DT, TO_CHAR(DT,'DY') DY, IS_WORK_IND
--   FROM TM_WORK_CALENDAR
--  WHERE DT IN (DATE '2026-07-11', DATE '2026-07-25', DATE '2026-01-26')
--  ORDER BY DT;   -- expect 1, 1, 0
------------------------------------------------------------------------------
