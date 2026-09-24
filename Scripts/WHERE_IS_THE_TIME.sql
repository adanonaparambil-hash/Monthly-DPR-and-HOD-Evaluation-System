-- ============================================================================
--  WHERE IS THE TIME GOING?
--  ---------------------------------------------------------------------------
--  Run this in SQL Developer / SQL*Plus against the database the portal uses.
--  It takes about a minute and answers the question completely, with no API and
--  no browser in the picture.
--
--  I cannot run it myself: ADK2026 is not readable from the machine I have, so
--  every performance statement I have made so far has been read off the SQL
--  text rather than measured. This is the measurement.
-- ============================================================================

SET DEFINE OFF
SET TIMING ON
SET PAGESIZE 100
SET LINESIZE 200


-- ─────────────────────────────────────────────────────────────────────────────
--  STEP 1 - IS THE OPTIMISED PACKAGE ACTUALLY DEPLOYED?
--
--  Both of these must come back with rows. If either is 0, the database is
--  still running the OLD query and nothing I changed can have had any effect -
--  which would explain "nothing has changed" exactly.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'FIX A - bill total computed once per bill' AS FIX,
       COUNT (*) AS LINES_FOUND,
       CASE WHEN COUNT (*) >= 2 THEN 'DEPLOYED' ELSE '*** NOT DEPLOYED ***' END AS STATUS
  FROM USER_SOURCE
 WHERE NAME = 'PKG_FINANCE_REPORTS' AND TYPE = 'PACKAGE BODY'
   AND UPPER (TEXT) LIKE '%GROUP BY LPURCHASEBILLHDRID) FB%'
UNION ALL
SELECT 'FIX B - branch filtered at the source',
       COUNT (*),
       CASE WHEN COUNT (*) >= 2 THEN 'DEPLOYED' ELSE '*** NOT DEPLOYED ***' END
  FROM USER_SOURCE
 WHERE NAME = 'PKG_FINANCE_REPORTS' AND TYPE = 'PACKAGE BODY'
   AND UPPER (TEXT) LIKE '%A.BRANCHID = P_BRANCHID OR P_BRANCHID = 1%'
UNION ALL
SELECT 'old scalar sub-query still present (should be 0)',
       COUNT (*),
       CASE WHEN COUNT (*) = 0 THEN 'GOOD' ELSE '*** OLD BODY STILL LIVE ***' END
  FROM USER_SOURCE
 WHERE NAME = 'PKG_FINANCE_REPORTS' AND TYPE = 'PACKAGE BODY'
   AND UPPER (TEXT) LIKE '%LPURCHASEBILLDTL LD1%';


-- ─────────────────────────────────────────────────────────────────────────────
--  STEP 2 - TIME THE PROCEDURE ITSELF
--
--  SET TIMING ON prints the wall clock. Note that a ref cursor does no work
--  until it is fetched, so the DBMS_SQL loop below is what actually runs the
--  report - that elapsed time IS the report.
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE
    c        SYS_REFCURSOR;
    s        CHAR (1);
    m        VARCHAR2 (4000);
    v_cur    NUMBER;
    v_rows   NUMBER := 0;
    t0       NUMBER;
BEGIN
    t0 := DBMS_UTILITY.GET_TIME;

    PKG_FINANCE_REPORTS.SP_GET_SUPPLIER_PAYMENT_FORECAST (
        P_BNAME              => 'ALL',
        P_BRANCHID           => 1,
        P_PCODE              => 'ALL',
        P_VNAME              => 'ALL',
        P_OUTSTANDING_STATUS => 'OUTSTANDING',
        P_CURRENCY           => 'ALL',
        P_SORT_COL           => 'VENDORNAME',
        P_SORT_DIR           => 'ASC',
        P_PAGE_NO            => 1,
        P_PAGE_SIZE          => 500,
        P_CURSOR             => c,
        P_SUCCESS            => s,
        P_MESSAGE            => m);

    DBMS_OUTPUT.PUT_LINE ('open cursor        : '
        || ROUND ((DBMS_UTILITY.GET_TIME - t0) / 100, 2) || ' s   (expect ~0)');

    t0 := DBMS_UTILITY.GET_TIME;
    v_cur := DBMS_SQL.TO_CURSOR_NUMBER (c);
    WHILE DBMS_SQL.FETCH_ROWS (v_cur) > 0 LOOP
        v_rows := v_rows + 1;
    END LOOP;
    DBMS_SQL.CLOSE_CURSOR (v_cur);

    DBMS_OUTPUT.PUT_LINE ('FETCH (the report) : '
        || ROUND ((DBMS_UTILITY.GET_TIME - t0) / 100, 2) || ' s');
    DBMS_OUTPUT.PUT_LINE ('rows               : ' || v_rows);
    DBMS_OUTPUT.PUT_LINE ('success / message  : ' || s || ' / ' || m);
END;
/


-- ─────────────────────────────────────────────────────────────────────────────
--  STEP 3 - WHERE INSIDE THE QUERY
--  Read the plan of what just ran. STARTS is the number of times a step
--  EXECUTED; A-Rows is what it really produced. A STARTS in the thousands on
--  LPURCHASEBILLDTL means FIX A is not in effect.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT SQL_ID, ROUND (ELAPSED_TIME / GREATEST (EXECUTIONS, 1) / 1e6, 1) AS SECS,
       BUFFER_GETS, DISK_READS
  FROM V$SQL
 WHERE UPPER (SQL_TEXT) LIKE '%TOTAL_PB_AMOUNT%'
   AND UPPER (SQL_TEXT) NOT LIKE '%V$SQL%'
 ORDER BY ELAPSED_TIME DESC
 FETCH FIRST 3 ROWS ONLY;

-- then, with the SQL_ID from above:
-- SELECT * FROM TABLE (DBMS_XPLAN.DISPLAY_CURSOR ('&sql_id', NULL, 'ALLSTATS LAST'));


-- ============================================================================
--  WHAT THE ANSWER MEANS
--
--  STEP 1 says NOT DEPLOYED
--      That is the whole explanation. Run PKG_FINANCE_REPORTS.sql in THIS
--      database and re-test. Nothing else needs discussing.
--
--  DEPLOYED, and STEP 2 FETCH is a few seconds
--      The database is fine and the delay is elsewhere - send me the API log
--      line beginning "supplier payment forecast timings:".
--
--  DEPLOYED, and STEP 2 FETCH is still 60s+
--      The query is structurally expensive and tuning will not rescue it. Send
--      me STEP 3's plan and I will build the nightly snapshot table instead,
--      which makes every run a sub-second read.
-- ============================================================================
