-- ============================================================================
--  FINANCE REPORT SNAPSHOT TABLES
--  ---------------------------------------------------------------------------
--  Why these exist
--  ---------------
--  The two supplier reports used to rebuild the WHOLE company's purchase
--  bills, payments, debit notes and advances on every single click. Measured
--  on live data that costs ~11 seconds at best, and the components alone sum
--  to ~9s, so no amount of SQL tuning was ever going to make it feel instant.
--  Picking one branch did not help either - measured at exactly zero
--  improvement - because the bill and payment aggregation is not branch
--  scoped at all.
--
--  So the expensive half is computed ONCE every 4 hours into these tables,
--  and the reports read from them. The arithmetic is not changed in any way:
--  the same expressions that used to run per request now run per refresh.
--
--  The trade-off, stated plainly: figures are as of the last refresh, not as
--  of this second. The screen shows that timestamp and offers Refresh Now.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  FIN_SNAP_PO : one row per (purchase order, project)
--
--  This is the grain the reports actually aggregate over. Everything that is
--  constant per request - the vendor, the branch, the currency, the due date
--  and the bill-side outstanding - is resolved here.
--
--  What is deliberately NOT resolved here: the PO ADVANCE. Advances are
--  filtered by the SELECTED BRANCH in the original query
--  (AA.BRANCH = P_BRANCHID OR P_BRANCHID = 1), so the amount subtracted
--  genuinely differs depending on which branch the user picked. Folding it in
--  here would silently change the numbers. It lives in FIN_SNAP_POADV instead,
--  still broken down by branch, and is applied at query time.
-- ----------------------------------------------------------------------------
CREATE TABLE FIN_SNAP_PO (
    POHDRID           NUMBER,
    PROJECTMASTERID   NUMBER,
    BRANCHID          NUMBER,
    BRANCHNAME        VARCHAR2(100),
    PROJECTCODE       VARCHAR2(20),
    VENDORNAME        VARCHAR2(100),
    -- TRIM(UPPER(vendorname)) stored once. The original compared
    -- TRIM(UPPER(V.VENDORNAME)) = TRIM(UPPER(P_VNAME)) on every row of every
    -- run, which no index can serve. Precomputing the left side makes the
    -- vendor filter a plain equality.
    VENDORNAME_KEY    VARCHAR2(100),
    CURRENCY          VARCHAR2(15),
    -- Two due dates, not one. The two reports' supplier-invoice sub-queries
    -- are identical EXCEPT that the aging report excludes POHDRID
    -- 10051000032382. Rather than re-apply that magic number at query time in
    -- one report and not the other, each report gets its own column.
    DUEDATE_FORECAST  DATE,
    DUEDATE_AGING     DATE,
    -- NVL(PB.OUTSTANDING_AMOUNT, 0) from the original - bills minus payments
    -- minus debit notes. Advances are NOT subtracted yet; see above.
    PB_OUTSTANDING    NUMBER
);

CREATE INDEX IX_FIN_SNAP_PO_BRANCH  ON FIN_SNAP_PO (BRANCHNAME);
CREATE INDEX IX_FIN_SNAP_PO_VENDOR  ON FIN_SNAP_PO (VENDORNAME_KEY);
CREATE INDEX IX_FIN_SNAP_PO_PROJECT ON FIN_SNAP_PO (PROJECTCODE);
CREATE INDEX IX_FIN_SNAP_PO_POHDRID ON FIN_SNAP_PO (POHDRID);

-- ----------------------------------------------------------------------------
--  FIN_SNAP_POADV : PO advances, kept BROKEN DOWN BY BRANCH on purpose.
--  Summed at query time over the branches the request asks for, which is what
--  reproduces (AA.BRANCH = P_BRANCHID OR P_BRANCHID = 1) exactly.
-- ----------------------------------------------------------------------------
CREATE TABLE FIN_SNAP_POADV (
    PONO        NUMBER,
    BRANCH      NUMBER(16),
    POADAMOUNT  NUMBER
);

CREATE INDEX IX_FIN_SNAP_POADV_PONO ON FIN_SNAP_POADV (PONO);

-- ----------------------------------------------------------------------------
--  FIN_SNAP_META : one row per snapshot, so the screen can say
--  "figures as of 11:45" and so a failed refresh is visible rather than
--  silently serving yesterday's numbers as though they were current.
-- ----------------------------------------------------------------------------
CREATE TABLE FIN_SNAP_META (
    SNAP_NAME     VARCHAR2(30) PRIMARY KEY,
    REFRESHED_AT  DATE,
    DURATION_SEC  NUMBER,
    ROW_COUNT     NUMBER,
    STATUS        VARCHAR2(10),
    MESSAGE       VARCHAR2(4000)
);
