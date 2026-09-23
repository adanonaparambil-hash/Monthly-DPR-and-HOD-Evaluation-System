-- ============================================================================
--  WHAT IS ACTUALLY DEPLOYED?
--  ---------------------------------------------------------------------------
--  Run this in the environment the portal talks to. It answers, in one go,
--  whether the package in the database is the one in PKG_FINANCE_REPORTS.sql.
--
--  We have now seen three different symptoms from the same root cause:
--      Error parsing column 6 (OVERDUE=OUTSTANDING - String)
--      Error parsing column 2 (OVERDUE=RIAL OMANI  - String)
--  In both, a TEXT value arrived in a column named OVERDUE - which only happens
--  when the deployed SELECT list is not the one in the script.
-- ============================================================================

SET DEFINE OFF
SET PAGESIZE 200
SET LINESIZE 200

-- 1) Is it even valid?
SELECT OBJECT_TYPE, STATUS, TO_CHAR (LAST_DDL_TIME, 'DD-MON-YY HH24:MI') AS LAST_DEPLOYED
  FROM USER_OBJECTS
 WHERE OBJECT_NAME = 'PKG_FINANCE_REPORTS'
 ORDER BY OBJECT_TYPE;

-- 2) Any compilation errors outstanding?
SELECT LINE, POSITION, TEXT
  FROM USER_ERRORS
 WHERE NAME = 'PKG_FINANCE_REPORTS'
 ORDER BY SEQUENCE;

-- 3) THE IMPORTANT ONE - the deployed SELECT lists.
--    Correct output has NO rows mentioning BRANCHNAME, BID, PROJECTCODE or
--    OUTSTAND, and every "AS OVERDUE" sits on an END) of a SUM(CASE ...).
SELECT LINE, RTRIM (TEXT) AS SOURCE_LINE
  FROM USER_SOURCE
 WHERE NAME = 'PKG_FINANCE_REPORTS'
   AND TYPE = 'PACKAGE BODY'
   AND (   UPPER (TEXT) LIKE '%SELECT VENDORNAME%'
        OR UPPER (TEXT) LIKE '%AS BRANCHNAME%'
        OR UPPER (TEXT) LIKE '%AS BID%'
        OR UPPER (TEXT) LIKE '%AS PROJECTCODE%'
        OR UPPER (TEXT) LIKE '%AS OUTSTAND,%'
        OR UPPER (TEXT) LIKE '%AS OVERDUE%'
        OR UPPER (TEXT) LIKE '%AS TOTAL_ROWS%'
        OR UPPER (TEXT) LIKE '%OFFSET L_OFFSET%')
 ORDER BY LINE;

-- 4) Does it have the paging parameters?
--    Expect P_PAGE_NO and P_PAGE_SIZE on both report procedures.
SELECT OBJECT_NAME, ARGUMENT_NAME, DATA_TYPE, IN_OUT, POSITION
  FROM USER_ARGUMENTS
 WHERE PACKAGE_NAME = 'PKG_FINANCE_REPORTS'
   AND OBJECT_NAME IN ('SP_GET_SUPPLIER_PAYMENT_FORECAST', 'SP_GET_SUPPLIER_OVERDUE_AGING')
 ORDER BY OBJECT_NAME, POSITION;


-- ============================================================================
--  WHAT A CORRECT DEPLOYMENT LOOKS LIKE
--
--  Step 3 should show, for EACH of the two report procedures:
--      SELECT VENDORNAME,
--      END)                    AS OVERDUE,          (forecast only)
--      COUNT (*) OVER ()       AS TOTAL_ROWS
--      OFFSET L_OFFSET ROWS FETCH NEXT L_LIMIT ROWS ONLY;
--
--  and NOTHING at all for BRANCHNAME / BID / PROJECTCODE / OUTSTAND.
--
--  If BRANCHNAME or OUTSTAND appear, an older body is still in the database:
--  re-run PKG_FINANCE_REPORTS.sql in THIS environment. Running it elsewhere,
--  or compiling only the spec, leaves the old body in place and every symptom
--  above comes straight back.
-- ============================================================================
