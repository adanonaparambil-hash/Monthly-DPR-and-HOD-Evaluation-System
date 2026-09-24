-- ============================================================================
--  MAKING THE SUPPLIER REPORTS FASTER
--  ---------------------------------------------------------------------------
--  PART 1  measure - where the time actually goes
--  PART 2  fix A: stop re-reading every purchase bill once per project (SAFE,
--                 provably identical output)
--  PART 3  fix B: filter by branch EARLY instead of at the very end
--  PART 4  the structural answer, if A and B are not enough
--
--  Do PART 1 first. Everything below is an informed reading of the SQL, not a
--  measurement - the plan will say which of them is really costing you.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  PART 1 - MEASURE
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Run the report once from the portal, then find it and read its real plan.
--     This shows ACTUAL rows vs estimated, and where the time went - far more
--     use than EXPLAIN PLAN, which only guesses.
SELECT SQL_ID, CHILD_NUMBER,
       ROUND (ELAPSED_TIME / GREATEST (EXECUTIONS, 1) / 1e6, 2) AS SECS_PER_RUN,
       EXECUTIONS, BUFFER_GETS, DISK_READS,
       SUBSTR (SQL_TEXT, 1, 60) AS SQL_HEAD
  FROM V$SQL
 WHERE UPPER (SQL_TEXT) LIKE '%TOTAL_PB_AMOUNT%'
   AND UPPER (SQL_TEXT) NOT LIKE '%V$SQL%'
 ORDER BY ELAPSED_TIME DESC
 FETCH FIRST 5 ROWS ONLY;

-- 1b. Feed the SQL_ID from 1a into this. STARTS on a line is the number of
--     times that step RAN - a STARTS in the thousands on the
--     LPURCHASEBILLDTL scalar sub-query is the smoking gun for PART 2.
-- SELECT * FROM TABLE (DBMS_XPLAN.DISPLAY_CURSOR ('&sql_id', NULL, 'ALLSTATS LAST'));

-- 1c. How big is the driving set really?
SELECT (SELECT COUNT (*) FROM adk2026.POHDR            WHERE CANCEL = 'F') AS OPEN_POS,
       (SELECT COUNT (*) FROM adk2026.PODTL)                               AS PO_LINES,
       (SELECT COUNT (*) FROM adk2026.LPURCHASEBILLDTL)                    AS BILL_LINES,
       (SELECT COUNT (*) FROM adk2026.LPURCHASEBILLHDR WHERE CANCEL = 'F') AS BILLS,
       (SELECT COUNT (*) FROM adk2026.ARAPADJUSTMENTS)                     AS ADJUSTMENTS
  FROM DUAL;

-- 1d. Are the join columns indexed? Every one of these is joined on in the
--     report; an empty result for any of them is a full scan per execution.
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, COLUMN_POSITION
  FROM ALL_IND_COLUMNS
 WHERE INDEX_OWNER = 'ADK2026'
   AND (   (TABLE_NAME = 'LPURCHASEBILLDTL' AND COLUMN_NAME IN ('LPURCHASEBILLHDRID', 'GRNO', 'PROJECTCODE'))
        OR (TABLE_NAME = 'LOCALGRNHDR'      AND COLUMN_NAME IN ('DOCID', 'POHDRID'))
        OR (TABLE_NAME = 'ARAPDETAILS'      AND COLUMN_NAME = 'VOUCHER_NUMBER')
        OR (TABLE_NAME = 'ARAPPAYDTL'       AND COLUMN_NAME IN ('ARAPPAYHDRID', 'SVOUCHER_NUMBER'))
        OR (TABLE_NAME = 'SUPINVPO'         AND COLUMN_NAME IN ('POHDRID', 'SUPPINVBASICID'))
        OR (TABLE_NAME = 'PODTL'            AND COLUMN_NAME = 'POHDRID'))
 ORDER BY TABLE_NAME, INDEX_NAME, COLUMN_POSITION;


-- ============================================================================
--  PART 2 - FIX A:  the scalar sub-query  (the one I would do first)
--  ---------------------------------------------------------------------------
--  Today, for every (bill x PO x project) group, the report runs this AGAIN:
--
--      (SELECT SUM (NVL (LD1.GRAMT,0) + (NVL (LD1.VATAMOUNT,0) - NVL (LD1.RCMVATAMT,0)))
--         FROM LPURCHASEBILLDTL LD1
--        WHERE LD1.LPURCHASEBILLHDRID = LD.LPURCHASEBILLHDRID)  AS FULL_PB_AMOUNT
--
--  A bill split across 5 projects reads its own lines 5 times over. Across
--  thousands of bills that is the same table scanned again and again for an
--  answer that never changes per bill.
--
--  Compute it ONCE per bill and join to it. The sub-query has no WHERE clause
--  beyond the bill id, so a plain GROUP BY over the whole table is exactly the
--  same number - this is a rewrite, not a change of meaning.
--
--  IN BOTH REPORTS, replace:
--
--      SUM (  NVL (LD.GRAMT, 0)
--           + (  NVL (VATAMOUNT, 0)
--              - NVL (RCMVATAMT, 0)))                    AS PROJECT_PB_AMOUNT,
--      (SELECT SUM (  NVL (LD1.GRAMT, 0)
--                   + (  NVL (LD1.VATAMOUNT, 0)
--                      - NVL (LD1.RCMVATAMT, 0)))
--         FROM adk2026.LPURCHASEBILLDTL LD1
--        WHERE LD1.LPURCHASEBILLHDRID =
--              LD.LPURCHASEBILLHDRID)                    AS FULL_PB_AMOUNT
--
--  with:
--
--      SUM (  NVL (LD.GRAMT, 0)
--           + (  NVL (VATAMOUNT, 0)
--              - NVL (RCMVATAMT, 0)))                    AS PROJECT_PB_AMOUNT,
--      MAX (FB.FULL_PB_AMOUNT)                           AS FULL_PB_AMOUNT
--
--  ...and add this join beside the others in that same FROM clause:
--
--      JOIN (  SELECT LPURCHASEBILLHDRID,
--                     SUM (  NVL (GRAMT, 0)
--                          + (NVL (VATAMOUNT, 0) - NVL (RCMVATAMT, 0)))  AS FULL_PB_AMOUNT
--                FROM adk2026.LPURCHASEBILLDTL
--            GROUP BY LPURCHASEBILLHDRID) FB
--          ON FB.LPURCHASEBILLHDRID = LD.LPURCHASEBILLHDRID
--
--  MAX() is only there because FULL_PB_AMOUNT sits in a GROUP BY query and is
--  constant within the group - MAX of one repeated value is that value.
--
--  PROVE IT BEFORE TRUSTING IT. Same numbers, old way vs new:
--
--      SELECT COUNT (*) AS ROWS_THAT_DISAGREE
--        FROM (  SELECT LD.LPURCHASEBILLHDRID AS ID,
--                       (SELECT SUM (NVL (LD1.GRAMT,0) + (NVL (LD1.VATAMOUNT,0) - NVL (LD1.RCMVATAMT,0)))
--                          FROM adk2026.LPURCHASEBILLDTL LD1
--                         WHERE LD1.LPURCHASEBILLHDRID = LD.LPURCHASEBILLHDRID) AS OLD_WAY,
--                       MAX (FB.FULL_PB_AMOUNT) AS NEW_WAY
--                  FROM adk2026.LPURCHASEBILLDTL LD
--                  JOIN (  SELECT LPURCHASEBILLHDRID,
--                                 SUM (NVL (GRAMT,0) + (NVL (VATAMOUNT,0) - NVL (RCMVATAMT,0))) AS FULL_PB_AMOUNT
--                            FROM adk2026.LPURCHASEBILLDTL
--                        GROUP BY LPURCHASEBILLHDRID) FB
--                    ON FB.LPURCHASEBILLHDRID = LD.LPURCHASEBILLHDRID
--              GROUP BY LD.LPURCHASEBILLHDRID)
--       WHERE OLD_WAY <> NEW_WAY
--          OR (OLD_WAY IS NULL) <> (NEW_WAY IS NULL);
--
--  Expect 0. If it is 0, the rewrite is safe.
-- ============================================================================


-- ============================================================================
--  PART 3 - FIX B:  filter by branch EARLY
--  ---------------------------------------------------------------------------
--  Right now the branch filter is the LAST thing applied:
--
--      WHERE (BR.BRANCHNAME = P_BNAME OR P_BNAME = 'ALL')
--
--  Everything above it - every PO, every purchase bill, every payment, every
--  debit note, company-wide - is built first and then thrown away. Picking one
--  branch does almost nothing for the runtime, which matches what you are
--  seeing.
--
--  POHDR carries BRANCHID, so the driving set can be cut at the source. In the
--  innermost PO aggregate, change:
--
--      WHERE A.CANCEL = 'F'
--
--  to:
--
--      WHERE A.CANCEL = 'F'
--        AND (A.BRANCHID = P_BRANCHID OR P_BRANCHID = 1)
--
--  Safe because the UI always sends the id that goes with the name, and forces
--  1 when the name is 'ALL' (FinanceReportService.RunReport). The existing
--  BRANCHNAME filter stays as the backstop.
--
--  I have NOT applied this one, because it is only correct while that pairing
--  holds. Confirm no other caller invokes the procedure with a name and id that
--  disagree, and I will put it in.
-- ============================================================================


-- ============================================================================
--  PART 4 - IF A AND B ARE NOT ENOUGH
--
--  Two further things the plan may point at:
--
--  1) ARAPADJUSTMENTS is scanned in full every run:
--         WHERE RVOUCHER_NUMBER LIKE '%DN%' AND SVOUCHER_NUMBER LIKE '%PB%'
--     A leading % means no index can ever be used. If those references really
--     start with the code ('DN-2026-001'), changing to LIKE 'DN%' / 'PB%' makes
--     them indexable. Check first:
--         SELECT COUNT(*) AS NOT_AT_START FROM adk2026.ARAPADJUSTMENTS
--          WHERE RVOUCHER_NUMBER LIKE '%DN%' AND RVOUCHER_NUMBER NOT LIKE 'DN%';
--     Only worth it if that comes back 0.
--
--  2) A NIGHTLY SNAPSHOT. This report reads the whole purchase ledger to answer
--     a question whose answer changes once a day. A job that writes the result
--     into a table overnight turns every run into a sub-second SELECT from that
--     table, and the reports would page and sort instantly. The trade is that
--     figures are as of the last run - for a payment FORECAST, usually fine.
--     Say the word and I will write the table, the refresh job and the switch.
-- ============================================================================
