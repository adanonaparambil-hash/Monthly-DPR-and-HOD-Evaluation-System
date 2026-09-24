-- ============================================================================
--  TWO QUERIES. Run both, paste both results back.
--  Nothing here changes anything - they only read.
-- ============================================================================


-- ##  QUERY 1  ##  ARE THE JOIN COLUMNS INDEXED?
--
--  This is the likeliest answer and it needs no query change at all. Every
--  column below is joined on, millions of rows at a time. Any one of them
--  MISSING an index means Oracle scans that whole table on every run - which
--  is exactly what 72 seconds for one branch looks like.

SELECT t.TABLE_NAME,
       t.COLUMN_NAME,
       NVL (MAX (i.INDEX_NAME), '*** NO INDEX ***') AS INDEX_FOUND
  FROM (SELECT 'LPURCHASEBILLDTL' AS TABLE_NAME, 'LPURCHASEBILLHDRID' AS COLUMN_NAME FROM DUAL
        UNION ALL SELECT 'LPURCHASEBILLDTL', 'GRNO'           FROM DUAL
        UNION ALL SELECT 'LPURCHASEBILLDTL', 'PROJECTCODE'    FROM DUAL
        UNION ALL SELECT 'LOCALGRNHDR',      'DOCID'          FROM DUAL
        UNION ALL SELECT 'LOCALGRNHDR',      'POHDRID'        FROM DUAL
        UNION ALL SELECT 'LPURCHASEBILLHDR', 'DOCID'          FROM DUAL
        UNION ALL SELECT 'ARAPDETAILS',      'VOUCHER_NUMBER' FROM DUAL
        UNION ALL SELECT 'ARAPPAYDTL',       'ARAPPAYHDRID'   FROM DUAL
        UNION ALL SELECT 'ARAPPAYDTL',       'SVOUCHER_NUMBER' FROM DUAL
        UNION ALL SELECT 'ARAPADJUSTMENTS',  'SVOUCHER_NUMBER' FROM DUAL
        UNION ALL SELECT 'SUPINVPO',         'POHDRID'        FROM DUAL
        UNION ALL SELECT 'SUPINVPO',         'SUPPINVBASICID' FROM DUAL
        UNION ALL SELECT 'PODTL',            'POHDRID'        FROM DUAL
        UNION ALL SELECT 'POHDR',            'BRANCHID'       FROM DUAL) t
  LEFT JOIN ALL_IND_COLUMNS i
         ON i.INDEX_OWNER    = 'ADK2026'
        AND i.TABLE_NAME     = t.TABLE_NAME
        AND i.COLUMN_NAME    = t.COLUMN_NAME
        AND i.COLUMN_POSITION = 1
 GROUP BY t.TABLE_NAME, t.COLUMN_NAME
 ORDER BY INDEX_FOUND, t.TABLE_NAME;


-- ##  QUERY 2  ##  WHERE THE TIME GOES
--
--  Run the report from the portal ONCE, wait for it to finish or time out,
--  then run these two straight away.

--  2a - find it
SELECT SQL_ID,
       ROUND (ELAPSED_TIME / GREATEST (EXECUTIONS, 1) / 1e6, 1) AS SECS_PER_RUN,
       BUFFER_GETS, DISK_READS, EXECUTIONS
  FROM V$SQL
 WHERE UPPER (SQL_TEXT) LIKE '%TOTAL_PB_AMOUNT%'
   AND UPPER (SQL_TEXT) NOT LIKE '%V$SQL%'
 ORDER BY ELAPSED_TIME DESC
 FETCH FIRST 3 ROWS ONLY;

--  2b - paste the SQL_ID from 2a in place of PUT_SQL_ID_HERE and run it.
--       The columns that matter are STARTS (how many times a step ran) and
--       A-Rows (what it really produced). One line will dominate. That line is
--       the problem, and I will fix that line.

-- SELECT * FROM TABLE (DBMS_XPLAN.DISPLAY_CURSOR ('PUT_SQL_ID_HERE', NULL, 'ALLSTATS LAST'));
