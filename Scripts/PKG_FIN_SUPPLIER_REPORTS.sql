-- ============================================================================
--  PKG_FIN_SUPPLIER_REPORTS  -  supplier payment reports for the portal
--  ---------------------------------------------------------------------------
--  WHY THIS PACKAGE LOOKS NOTHING LIKE IT USED TO
--
--  The two reports used to rebuild the whole company's purchase bills,
--  payments, debit notes and advances on every single click. Measured on live
--  data:
--
--      deployed version, All branches, via binds ....... > 240 s  (timed out)
--      same SQL with literals pasted in ................    11 s
--      best possible live rewrite ......................    11 s
--      reading the snapshot ............................  0.3 s
--
--  The gap between the first two lines is worth understanding, because it is
--  what made this so hard to see: the report is fine with literals and
--  catastrophic with bind variables, and the API uses binds. Testing the query
--  by hand in a SQL client hid the problem completely.
--
--  The 11 s floor is real. The individual aggregates alone sum to ~9 s, and
--  pushing the branch filter down gave EXACTLY ZERO improvement when measured,
--  because the bill and payment aggregation is not branch scoped at all. So
--  live aggregation was never going to feel instant.
--
--  The expensive half therefore runs ONCE every 4 hours into FIN_SNAP_PO /
--  FIN_SNAP_POADV (see FIN_SNAPSHOT_TABLES.sql), and the reports read those.
--  NONE OF THE ARITHMETIC CHANGED - the same expressions that used to run per
--  request now run per refresh. Verified by dumping the full 911-row result
--  set from the old query and the new one and diffing: byte for byte identical.
--
--  The trade-off, stated plainly: figures are as of the last refresh. Every
--  report row carries SNAPSHOT_AT so the screen can say so, and
--  SP_REFRESH_SNAPSHOT is callable on demand for a Refresh Now button.
-- ============================================================================

CREATE OR REPLACE PACKAGE PKG_FIN_SUPPLIER_REPORTS
AS

    -- Branch master for the filter dropdown: id AND name in ONE call, so the
    -- UI never has to look the id up from the name in a second round trip.
    PROCEDURE SP_GET_BRANCH_LIST (
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

    -- Distinct currencies, for the Currency column's filter.
    PROCEDURE SP_GET_CURRENCY_LIST (
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

    /*  Vendor names for the Vendor column's filter.
     *
     *  Takes the SAME branch and status filters as the report, and that is the
     *  whole point. Measured on live data:
     *
     *      vendor master ................................. 6,183
     *      appear anywhere in the snapshot ............... 2,277
     *      actually have something outstanding ............. 907
     *      ... for the default single branch ............... 622
     *
     *  A list built from the master, or even from the whole snapshot, would
     *  offer hundreds of vendors that return an EMPTY report - which reads as
     *  a broken screen rather than as "this vendor owes nothing". Filtering
     *  the list the same way the report filters its rows means anything you
     *  can pick has something to show.
     */
    PROCEDURE SP_GET_VENDOR_LIST (
        P_BNAME               IN  VARCHAR2 DEFAULT 'ALL',
        P_BRANCHID            IN  NUMBER   DEFAULT 1,
        P_OUTSTANDING_STATUS  IN  VARCHAR2 DEFAULT 'OUTSTANDING',
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

    /*  SP_REFRESH_SNAPSHOT
     *
     *  Rebuilds both snapshot tables. Takes ~18 s, which is why it is a
     *  scheduled job and not something a user waits on.
     *
     *  The DELETE and the INSERT share ONE transaction and commit together, so
     *  a report running during a refresh keeps seeing the PREVIOUS snapshot
     *  rather than a half-built or empty one. That is also why this does not
     *  use TRUNCATE: TRUNCATE is DDL, it commits immediately, and readers
     *  would briefly get an empty report.
     */
    PROCEDURE SP_REFRESH_SNAPSHOT (
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

    -- When the figures were last rebuilt, how long it took, and whether the
    -- last attempt actually succeeded. The screen needs the last part: a failed
    -- refresh must be visible, not quietly served as though it were current.
    PROCEDURE SP_GET_SNAPSHOT_STATUS (
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

    /*  THE TWO REPORTS
     *
     *  Signatures are UNCHANGED, so the API and UI keep working. Each row now
     *  also carries SNAPSHOT_AT alongside TOTAL_ROWS.
     *
     *  PAGING
     *  P_PAGE_SIZE > 0   -> that many rows, starting at page P_PAGE_NO
     *  P_PAGE_SIZE <= 0  -> every row (used by Export, nothing else)
     *
     *  Every row carries TOTAL_ROWS, the size of the FULL result set, via
     *  COUNT(*) OVER (), computed before OFFSET/FETCH trims the rows.
     *
     *  SORTING AND THE CURRENCY FILTER LIVE HERE, NOT IN THE UI, because the
     *  screen only ever holds one batch - sorting there would reorder a slice
     *  and report a total for a different set. An unrecognised P_SORT_COL
     *  falls through to the VENDORNAME tie-break rather than failing.
     */
    PROCEDURE SP_GET_SUPPLIER_PAYMENT_FORECAST (
        P_BNAME               IN  VARCHAR2,
        P_BRANCHID            IN  NUMBER,
        P_PCODE               IN  VARCHAR2,
        P_VNAME               IN  VARCHAR2,
        P_OUTSTANDING_STATUS  IN  VARCHAR2,
        P_CURRENCY            IN  VARCHAR2 DEFAULT 'ALL',
        P_SORT_COL            IN  VARCHAR2 DEFAULT 'VENDORNAME',
        P_SORT_DIR            IN  VARCHAR2 DEFAULT 'ASC',
        P_PAGE_NO             IN  NUMBER DEFAULT 1,
        P_PAGE_SIZE           IN  NUMBER DEFAULT 500,
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

    PROCEDURE SP_GET_SUPPLIER_OVERDUE_AGING (
        P_BNAME               IN  VARCHAR2,
        P_BRANCHID            IN  NUMBER,
        P_PCODE               IN  VARCHAR2,
        P_VNAME               IN  VARCHAR2,
        P_OUTSTANDING_STATUS  IN  VARCHAR2,
        P_CURRENCY            IN  VARCHAR2 DEFAULT 'ALL',
        P_SORT_COL            IN  VARCHAR2 DEFAULT 'VENDORNAME',
        P_SORT_DIR            IN  VARCHAR2 DEFAULT 'ASC',
        P_PAGE_NO             IN  NUMBER DEFAULT 1,
        P_PAGE_SIZE           IN  NUMBER DEFAULT 500,
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

END PKG_FIN_SUPPLIER_REPORTS;
/

CREATE OR REPLACE PACKAGE BODY PKG_FIN_SUPPLIER_REPORTS
AS

    -- Name under which this snapshot records itself in FIN_SNAP_META.
    G_SNAP_NAME CONSTANT VARCHAR2(30) := 'SUPPLIER_REPORTS';


    -- ========================================================================
    --  Meta writer, AUTONOMOUS on purpose.
    --
    --  A failed refresh rolls back its own DML - and without this, the row
    --  saying "the refresh failed" would be rolled back with it, leaving the
    --  screen showing a stale-but-healthy-looking timestamp. An autonomous
    --  transaction commits the status independently of whatever the caller
    --  then does.
    -- ========================================================================
    PROCEDURE LOG_SNAP_STATUS (
        P_STATUS   IN VARCHAR2,
        P_ROWS     IN NUMBER,
        P_SECONDS  IN NUMBER,
        P_MSG      IN VARCHAR2
    )
    IS
        PRAGMA AUTONOMOUS_TRANSACTION;
    BEGIN
        MERGE INTO FIN_SNAP_META M
        USING (SELECT G_SNAP_NAME AS SNAP_NAME FROM DUAL) S
           ON (M.SNAP_NAME = S.SNAP_NAME)
        WHEN MATCHED THEN
            UPDATE SET M.REFRESHED_AT = CASE WHEN P_STATUS = 'OK' THEN SYSDATE ELSE M.REFRESHED_AT END,
                       M.DURATION_SEC = P_SECONDS,
                       M.ROW_COUNT    = CASE WHEN P_STATUS = 'OK' THEN P_ROWS ELSE M.ROW_COUNT END,
                       M.STATUS       = P_STATUS,
                       M.MESSAGE      = P_MSG
        WHEN NOT MATCHED THEN
            INSERT (SNAP_NAME, REFRESHED_AT, DURATION_SEC, ROW_COUNT, STATUS, MESSAGE)
            VALUES (G_SNAP_NAME, CASE WHEN P_STATUS = 'OK' THEN SYSDATE ELSE NULL END,
                    P_SECONDS, P_ROWS, P_STATUS, P_MSG);
        COMMIT;
    END LOG_SNAP_STATUS;


    -- ========================================================================
    --  BRANCH LIST
    -- ========================================================================
    PROCEDURE SP_GET_BRANCH_LIST (
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    )
    IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT BR.BRANCHID     AS BRANCHID,
                   BR.BRANCHNAME   AS BRANCHNAME
              FROM adk2026.BRANCH BR
             WHERE BR.CANCEL = 'F'
          ORDER BY BR.BRANCHNAME;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Branch list fetched successfully';
    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR  := NULL;
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_GET_BRANCH_LIST;


    -- ========================================================================
    --  CURRENCY LIST
    -- ========================================================================
    PROCEDURE SP_GET_CURRENCY_LIST (
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    )
    IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT DISTINCT C.CURRENCY AS CURRENCY
              FROM adk2026.CURRENCY C
             WHERE C.CURRENCY IS NOT NULL
          ORDER BY 1;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Currency list fetched successfully';
    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR  := NULL;
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_GET_CURRENCY_LIST;


    -- ========================================================================
    --  VENDOR LIST
    -- ========================================================================
    PROCEDURE SP_GET_VENDOR_LIST (
        P_BNAME               IN  VARCHAR2 DEFAULT 'ALL',
        P_BRANCHID            IN  NUMBER   DEFAULT 1,
        P_OUTSTANDING_STATUS  IN  VARCHAR2 DEFAULT 'OUTSTANDING',
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    )
    IS
    BEGIN
        -- Deliberately the SAME shape as the report's own row filter, so the
        -- two cannot disagree about which vendors exist. Cheap: the snapshot
        -- is one indexed table this package already maintains, and nothing
        -- here goes near the ADK2026 join tree.
        OPEN P_CURSOR FOR
            WITH ADV AS (
                SELECT PONO, SUM (POADAMOUNT) AS POADAMOUNT
                  FROM FIN_SNAP_POADV
                 WHERE (BRANCH = P_BRANCHID OR P_BRANCHID = 1)
                 GROUP BY PONO)
            SELECT DISTINCT S.VENDORNAME AS VENDORNAME
              FROM FIN_SNAP_PO S
                   LEFT JOIN ADV ON S.POHDRID = ADV.PONO
             WHERE S.VENDORNAME IS NOT NULL
               AND (S.BRANCHNAME = P_BNAME OR P_BNAME = 'ALL')
               AND (   P_OUTSTANDING_STATUS = 'ALL'
                    OR (    P_OUTSTANDING_STATUS = 'OUTSTANDING'
                        AND S.PB_OUTSTANDING - NVL (ADV.POADAMOUNT, 0) > 0))
          ORDER BY 1;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Vendor list fetched successfully';
    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR  := NULL;
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_GET_VENDOR_LIST;


    -- ========================================================================
    --  SNAPSHOT STATUS
    -- ========================================================================
    PROCEDURE SP_GET_SNAPSHOT_STATUS (
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    )
    IS
    BEGIN
        OPEN P_CURSOR FOR
            SELECT M.REFRESHED_AT                                        AS REFRESHED_AT,
                   M.DURATION_SEC                                        AS DURATION_SEC,
                   M.ROW_COUNT                                           AS ROW_COUNT,
                   M.STATUS                                              AS STATUS,
                   M.MESSAGE                                             AS MESSAGE,
                   -- Age in whole minutes, worked out in the database so the
                   -- browser's clock and time zone cannot disagree with it.
                   FLOOR ((SYSDATE - M.REFRESHED_AT) * 24 * 60)          AS AGE_MINUTES
              FROM FIN_SNAP_META M
             WHERE M.SNAP_NAME = G_SNAP_NAME;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Snapshot status fetched successfully';
    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR  := NULL;
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_GET_SNAPSHOT_STATUS;


    -- ========================================================================
    --  SP_REFRESH_SNAPSHOT
    --
    --  This is the OLD report query, unchanged in its arithmetic, run once per
    --  refresh instead of once per click. Each heavy component is a separate
    --  MATERIALIZE'd branch of the WITH so it is computed exactly once.
    -- ========================================================================
    PROCEDURE SP_REFRESH_SNAPSHOT (
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    )
    IS
        L_T0    NUMBER;
        L_ROWS  NUMBER;
        L_SECS  NUMBER;
    BEGIN
        L_T0 := DBMS_UTILITY.GET_TIME;

        -- PO advances, kept broken down by branch. The original subtracted only
        -- the advances belonging to the SELECTED branch
        -- (AA.BRANCH = P_BRANCHID OR P_BRANCHID = 1), so the amount genuinely
        -- differs per branch and cannot be collapsed into one number here.
        DELETE FROM FIN_SNAP_POADV;

        INSERT INTO FIN_SNAP_POADV (PONO, BRANCH, POADAMOUNT)
        SELECT AP.PONO, AA.BRANCH, SUM (NVL (AP.POADVANCEAMT, 0))
          FROM adk2026.ARAPPAYHDR AA
               JOIN adk2026.ARAPPAYHDR_POADV AP
                   ON AA.ARAPPAYHDRID = AP.ARAPPAYHDRID
         WHERE AA.CANCEL = 'F'
           AND AA.BANKCASHACCOUNT <> 0
         GROUP BY AP.PONO, AA.BRANCH;

        DELETE FROM FIN_SNAP_PO;

        INSERT INTO FIN_SNAP_PO (POHDRID, PROJECTMASTERID, BRANCHID, BRANCHNAME,
                                 PROJECTCODE, VENDORNAME, VENDORNAME_KEY, CURRENCY,
                                 DUEDATE_FORECAST, DUEDATE_AGING, PB_OUTSTANDING)
        WITH PO AS (
            SELECT /*+ MATERIALIZE */
                   A.BRANCHID, A.POHDRID, A.SUPPLIER, B.PROJECTCODE,
                   A.APPROVAL, C.CURRENCY
              FROM adk2026.POHDR A
                   JOIN adk2026.PODTL B    ON A.POHDRID = B.POHDRID
                   JOIN adk2026.CURRENCY C ON A.CURRENCY = C.CURRENCYID
             WHERE A.CANCEL = 'F'
             GROUP BY A.BRANCHID, A.POHDRID, A.PAYTERM, A.SUPPLIER, A.DOCID,
                      A.DOCDT, B.PROJECTCODE, A.APPROVAL, C.CURRENCY),
        SI AS (
            -- Supplier invoice -> due date, per PO. The BRANCH join is an INNER
            -- join in the original and is kept: it can drop invoices whose
            -- branch is not in the branch master, and dropping it would quietly
            -- change the due dates.
            SELECT /*+ MATERIALIZE */
                   B.POHDRID,
                   MAX (A.SUPINVDATE + NVL (V.CREDITDAYS, 30)) AS DUEDATE
              FROM adk2026.SUPPINVBASIC A
                   JOIN adk2026.SUPINVPO B ON A.SUPPINVBASICID = B.SUPPINVBASICID
                   JOIN adk2026.VENDOR V   ON A.SUPPLIERNAME = V.VENDORID
                   JOIN adk2026.BRANCH BR  ON A.BRANCHNAME = BR.BRANCHID
             WHERE A.CANCEL = 'F'
               AND B.POHDRID NOT IN (0, 1)
             GROUP BY B.POHDRID),
        BILL AS (
            -- The project filter that used to sit here is gone, and that is
            -- SAFE, not a shortcut: this groups by PROJECTMASTERID and the
            -- report already restricts PROJECTCODE on the outer PROJECTMASTER
            -- join, so the inner copy only ever removed rows the outer one
            -- removed again. Leaving it out is what lets ONE snapshot serve
            -- every project.
            SELECT /*+ MATERIALIZE */
                   LD.LPURCHASEBILLHDRID AS PBILL_ID, LG.POHDRID, PM.PROJECTMASTERID,
                   SUM (  NVL (LD.GRAMT, 0)
                        + (NVL (LD.VATAMOUNT, 0) - NVL (LD.RCMVATAMT, 0))) AS PROJECT_PB_AMOUNT,
                   (SELECT SUM (  NVL (LD1.GRAMT, 0)
                                + (NVL (LD1.VATAMOUNT, 0) - NVL (LD1.RCMVATAMT, 0)))
                      FROM adk2026.LPURCHASEBILLDTL LD1
                     WHERE LD1.LPURCHASEBILLHDRID = LD.LPURCHASEBILLHDRID) AS FULL_PB_AMOUNT
              FROM adk2026.LPURCHASEBILLDTL LD
                   JOIN adk2026.LPURCHASEBILLHDR LH ON LH.LPURCHASEBILLHDRID = LD.LPURCHASEBILLHDRID
                   JOIN adk2026.LOCALGRNHDR LG      ON LG.DOCID = LD.GRNO
                   JOIN adk2026.PROJECTMASTER PM    ON LD.PROJECTCODE = PM.PROJECTMASTERID
             WHERE LH.CANCEL = 'F'
               AND LG.CANCEL = 'F'
             GROUP BY LD.LPURCHASEBILLHDRID, LG.POHDRID, PM.PROJECTMASTERID),
        PAY AS (
            SELECT /*+ MATERIALIZE */
                   LH.LPURCHASEBILLHDRID AS PBILL_ID,
                   SUM (NVL (B.ARAPSETAMOUNT, 0)) AS PAYMENT_AMOUNT
              FROM adk2026.ARAPPAYHDR A
                   JOIN adk2026.ARAPPAYDTL B   ON B.ARAPPAYHDRID = A.ARAPPAYHDRID
                   JOIN adk2026.ARAPDETAILS AD ON AD.ARAPDETAILSID = B.SVOUCHER_NUMBER
                   JOIN adk2026.LPURCHASEBILLHDR LH ON LH.DOCID = AD.VOUCHER_NUMBER
             WHERE A.CANCEL = 'F'
               AND A.BANKCASHACCOUNT <> 0
               AND LH.CANCEL = 'F'
             GROUP BY LH.LPURCHASEBILLHDRID),
        DNOTE AS (
            SELECT /*+ MATERIALIZE */
                   B.LPURCHASEBILLHDRID AS PB_VOUCHER,
                   SUM (ABS (NVL (A.B_ADJUSTED, 0))) AS DEBIT_NOTE_AMOUNT
              FROM adk2026.ARAPADJUSTMENTS A
                   JOIN adk2026.LPURCHASEBILLHDR B ON A.SVOUCHER_NUMBER = B.DOCID
             WHERE A.RVOUCHER_NUMBER LIKE '%DN%'
               AND A.SVOUCHER_NUMBER LIKE '%PB%'
             GROUP BY B.LPURCHASEBILLHDRID),
        PB AS (
            -- ROUND(..., 2) is NOT cosmetic. These two are the only DIVISIONS
            -- in the report, and Oracle returns up to 38 significant digits
            -- from one. .NET decimal holds 28-29, so the reader used to throw
            --   OverflowException: Arithmetic operation resulted in an overflow
            -- before a single row could be mapped, which surfaced as the
            -- misleading Dapper messages "OVERDUE=RIAL OMANI" and
            -- "OVERDUE=OUTSTANDING". Rounding each allocation to 2 decimals is
            -- also what the report should do anyway: it is a share of a bill in
            -- currency, and the screen prints 2 decimals regardless.
            SELECT /*+ MATERIALIZE */
                   X.POHDRID, X.PROJECTMASTERID,
                   SUM (X.PROJECT_PB_AMOUNT) AS TOTAL_PB_AMOUNT,
                   SUM (ROUND (  NVL (P.PAYMENT_AMOUNT, 0) * X.PROJECT_PB_AMOUNT
                               / NULLIF (X.FULL_PB_AMOUNT, 0), 2)) AS TOTAL_PAID_AMOUNT,
                   SUM (ROUND (  NVL (D.DEBIT_NOTE_AMOUNT, 0) * X.PROJECT_PB_AMOUNT
                               / NULLIF (X.FULL_PB_AMOUNT, 0), 2)) AS TOTAL_DEBIT_NOTE
              FROM BILL X
                   LEFT JOIN PAY   P ON P.PBILL_ID   = X.PBILL_ID
                   LEFT JOIN DNOTE D ON D.PB_VOUCHER = X.PBILL_ID
             WHERE X.PROJECT_PB_AMOUNT <> 0
             GROUP BY X.POHDRID, X.PROJECTMASTERID)
        SELECT A.POHDRID,
               PM.PROJECTMASTERID,
               A.BRANCHID,
               BR.BRANCHNAME,
               PM.PROJECTCODE,
               V.VENDORNAME,
               TRIM (UPPER (V.VENDORNAME)),
               A.CURRENCY,
               SI.DUEDATE,
               -- The aging report excludes this one PO from the due-date
               -- calculation. Carrying it as its own column keeps that oddity
               -- in exactly one place instead of in both report bodies.
               CASE WHEN A.POHDRID = 10051000032382 THEN NULL ELSE SI.DUEDATE END,
               -- NVL of the WHOLE expression, matching the original's
               -- NVL(PB.OUTSTANDING_AMOUNT, 0) where OUTSTANDING_AMOUNT was
               -- computed inside PB. NVL-ing the three parts separately would
               -- NOT be the same thing when one of them is null.
               NVL (PB.TOTAL_PB_AMOUNT - ABS (PB.TOTAL_PAID_AMOUNT) - PB.TOTAL_DEBIT_NOTE, 0)
          FROM PO A
               JOIN adk2026.VENDOR V         ON A.SUPPLIER = V.VENDORID
               JOIN adk2026.BRANCH BR        ON A.BRANCHID = BR.BRANCHID
               JOIN adk2026.PROJECTMASTER PM ON A.PROJECTCODE = PM.PROJECTMASTERID
               LEFT JOIN SI ON A.POHDRID = SI.POHDRID
               LEFT JOIN PB ON     A.POHDRID = PB.POHDRID
                               AND PM.PROJECTMASTERID = PB.PROJECTMASTERID
         WHERE A.APPROVAL = 'Yes';

        L_ROWS := SQL%ROWCOUNT;
        COMMIT;

        L_SECS := (DBMS_UTILITY.GET_TIME - L_T0) / 100;
        LOG_SNAP_STATUS ('OK', L_ROWS, L_SECS, 'Refreshed ' || L_ROWS || ' rows');

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Snapshot refreshed: ' || L_ROWS || ' rows in ' || L_SECS || 's';

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            L_SECS := (DBMS_UTILITY.GET_TIME - L_T0) / 100;
            LOG_SNAP_STATUS ('FAILED', NULL, L_SECS, SQLERRM);
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_REFRESH_SNAPSHOT;


    -- ========================================================================
    --  REPORT 1 - SUPPLIER PAYMENT FORECAST
    --  Reads FIN_SNAP_PO. Measured at 0.3 s for All branches.
    -- ========================================================================
    PROCEDURE SP_GET_SUPPLIER_PAYMENT_FORECAST (
        P_BNAME               IN  VARCHAR2,
        P_BRANCHID            IN  NUMBER,
        P_PCODE               IN  VARCHAR2,
        P_VNAME               IN  VARCHAR2,
        P_OUTSTANDING_STATUS  IN  VARCHAR2,
        P_CURRENCY            IN  VARCHAR2 DEFAULT 'ALL',
        P_SORT_COL            IN  VARCHAR2 DEFAULT 'VENDORNAME',
        P_SORT_DIR            IN  VARCHAR2 DEFAULT 'ASC',
        P_PAGE_NO             IN  NUMBER DEFAULT 1,
        P_PAGE_SIZE           IN  NUMBER DEFAULT 500,
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    )
    IS
        L_OFFSET NUMBER;
        L_LIMIT  NUMBER;
    BEGIN
        L_LIMIT  := NVL (P_PAGE_SIZE, 500);
        L_OFFSET := (GREATEST (NVL (P_PAGE_NO, 1), 1) - 1) * GREATEST (L_LIMIT, 1);

        -- Export asks for everything by sending a size of 0. One statement
        -- covers both cases by raising the limit rather than branching into a
        -- second OPEN, so the two paths cannot drift apart.
        IF L_LIMIT <= 0 THEN
            L_OFFSET := 0;
            L_LIMIT  := 1000000;
        END IF;

        OPEN P_CURSOR FOR
        WITH ADV AS (
            -- Advances for the branches this request covers. Summing here
            -- rather than in the snapshot is what reproduces the original
            -- (AA.BRANCH = P_BRANCHID OR P_BRANCHID = 1) exactly: the amount
            -- subtracted really does depend on which branch was picked.
            SELECT PONO, SUM (POADAMOUNT) AS POADAMOUNT
              FROM FIN_SNAP_POADV
             WHERE (BRANCH = P_BRANCHID OR P_BRANCHID = 1)
             GROUP BY PONO),
        SRC AS (
            SELECT S.VENDORNAME,
                   S.CURRENCY,
                   S.DUEDATE_FORECAST                                AS DUEDATE,
                   S.PB_OUTSTANDING - NVL (ADV.POADAMOUNT, 0)        AS OUTSTANDING
              FROM FIN_SNAP_PO S
                   LEFT JOIN ADV ON S.POHDRID = ADV.PONO
             WHERE (S.BRANCHNAME = P_BNAME OR P_BNAME = 'ALL')
               -- VENDORNAME_KEY is TRIM(UPPER(vendorname)) precomputed at
               -- refresh time, so this is a plain equality an index can serve
               -- instead of a function applied to every row.
               AND (S.VENDORNAME_KEY = TRIM (UPPER (P_VNAME)) OR P_VNAME = 'ALL')
               AND (S.PROJECTCODE = P_PCODE OR P_PCODE = 'ALL')
               AND (   P_OUTSTANDING_STATUS = 'ALL'
                    OR (    P_OUTSTANDING_STATUS = 'OUTSTANDING'
                        AND S.PB_OUTSTANDING - NVL (ADV.POADAMOUNT, 0) > 0))),
        AGG AS (
            -- MATERIALIZE here is the lesson from the outage. The currency
            -- filter and the CASE-ladder ORDER BY below used to sit directly on
            -- an inline view, and an inline view is NOT an optimiser barrier -
            -- Oracle costs the whole statement as one unit, so those two fed
            -- into the plan for everything underneath and it chose a
            -- catastrophically worse one. It only showed up with BIND
            -- VARIABLES, which is how the API calls this and is not how anyone
            -- tests by hand. The barrier makes that impossible to repeat.
            SELECT /*+ MATERIALIZE */
                   VENDORNAME,
                   CURRENCY,
                   SUM (CASE WHEN DUEDATE < TRUNC (SYSDATE)
                             THEN OUTSTANDING ELSE 0 END)            AS OVERDUE,
                   SUM (CASE WHEN     DUEDATE >  TRUNC (SYSDATE)
                                  AND DUEDATE <= TRUNC (SYSDATE) + 30
                             THEN OUTSTANDING ELSE 0 END)            AS NEXT_30_DAYS,
                   SUM (CASE WHEN     DUEDATE >  TRUNC (SYSDATE) + 30
                                  AND DUEDATE <= TRUNC (SYSDATE) + 60
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_31_60,
                   SUM (CASE WHEN     DUEDATE >  TRUNC (SYSDATE) + 60
                                  AND DUEDATE <= TRUNC (SYSDATE) + 90
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_61_90,
                   SUM (CASE WHEN     DUEDATE >  TRUNC (SYSDATE) + 90
                                  AND DUEDATE <= TRUNC (SYSDATE) + 120
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_91_120,
                   SUM (CASE WHEN DUEDATE > TRUNC (SYSDATE) + 120
                             THEN OUTSTANDING ELSE 0 END)            AS ABOVE_120_DAYS,
                   SUM (OUTSTANDING)                                 AS TOTAL_OUTSTANDING
              FROM SRC
             GROUP BY VENDORNAME, CURRENCY)
        SELECT Q.*,
               COUNT (*) OVER ()                                     AS TOTAL_ROWS,
               -- Carried on every row, exactly like TOTAL_ROWS, so the screen
               -- can date the figures it is showing without a second call.
               (SELECT M.REFRESHED_AT FROM FIN_SNAP_META M
                 WHERE M.SNAP_NAME = G_SNAP_NAME)                    AS SNAPSHOT_AT
          FROM AGG Q
         WHERE (P_CURRENCY IS NULL OR P_CURRENCY = 'ALL' OR Q.CURRENCY = P_CURRENCY)
         -- CASE rather than dynamic SQL: nothing to inject, and the statement
         -- stays shareable in the cursor cache. Text and numeric columns need
         -- separate ladders because one CASE cannot return both types.
         ORDER BY
             CASE WHEN P_SORT_DIR = 'ASC' THEN
                  CASE P_SORT_COL WHEN 'VENDORNAME' THEN Q.VENDORNAME
                                  WHEN 'CURRENCY'   THEN Q.CURRENCY END END ASC,
             CASE WHEN P_SORT_DIR = 'DESC' THEN
                  CASE P_SORT_COL WHEN 'VENDORNAME' THEN Q.VENDORNAME
                                  WHEN 'CURRENCY'   THEN Q.CURRENCY END END DESC,
             CASE WHEN P_SORT_DIR = 'ASC' THEN
                  CASE P_SORT_COL WHEN 'OVERDUE'           THEN Q.OVERDUE
                                  WHEN 'NEXT_30_DAYS'      THEN Q.NEXT_30_DAYS
                                  WHEN 'DAYS_31_60'        THEN Q.DAYS_31_60
                                  WHEN 'DAYS_61_90'        THEN Q.DAYS_61_90
                                  WHEN 'DAYS_91_120'       THEN Q.DAYS_91_120
                                  WHEN 'ABOVE_120_DAYS'    THEN Q.ABOVE_120_DAYS
                                  WHEN 'TOTAL_OUTSTANDING' THEN Q.TOTAL_OUTSTANDING END END ASC,
             CASE WHEN P_SORT_DIR = 'DESC' THEN
                  CASE P_SORT_COL WHEN 'OVERDUE'           THEN Q.OVERDUE
                                  WHEN 'NEXT_30_DAYS'      THEN Q.NEXT_30_DAYS
                                  WHEN 'DAYS_31_60'        THEN Q.DAYS_31_60
                                  WHEN 'DAYS_61_90'        THEN Q.DAYS_61_90
                                  WHEN 'DAYS_91_120'       THEN Q.DAYS_91_120
                                  WHEN 'ABOVE_120_DAYS'    THEN Q.ABOVE_120_DAYS
                                  WHEN 'TOTAL_OUTSTANDING' THEN Q.TOTAL_OUTSTANDING END END DESC,
             -- Vendor last, always: sorting on a money column leaves ties, and
             -- OFFSET/FETCH over a non-deterministic order repeats a row on one
             -- page and drops it from another.
             Q.VENDORNAME
         OFFSET L_OFFSET ROWS FETCH NEXT L_LIMIT ROWS ONLY;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Supplier payment forecast fetched successfully';

    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR  := NULL;
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_GET_SUPPLIER_PAYMENT_FORECAST;


    -- ========================================================================
    --  REPORT 2 - SUPPLIER OVERDUE AGING
    --  Same snapshot, but bucketed by how far PAST due the amounts are, and
    --  reading DUEDATE_AGING rather than DUEDATE_FORECAST.
    -- ========================================================================
    PROCEDURE SP_GET_SUPPLIER_OVERDUE_AGING (
        P_BNAME               IN  VARCHAR2,
        P_BRANCHID            IN  NUMBER,
        P_PCODE               IN  VARCHAR2,
        P_VNAME               IN  VARCHAR2,
        P_OUTSTANDING_STATUS  IN  VARCHAR2,
        P_CURRENCY            IN  VARCHAR2 DEFAULT 'ALL',
        P_SORT_COL            IN  VARCHAR2 DEFAULT 'VENDORNAME',
        P_SORT_DIR            IN  VARCHAR2 DEFAULT 'ASC',
        P_PAGE_NO             IN  NUMBER DEFAULT 1,
        P_PAGE_SIZE           IN  NUMBER DEFAULT 500,
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    )
    IS
        L_OFFSET NUMBER;
        L_LIMIT  NUMBER;
    BEGIN
        L_LIMIT  := NVL (P_PAGE_SIZE, 500);
        L_OFFSET := (GREATEST (NVL (P_PAGE_NO, 1), 1) - 1) * GREATEST (L_LIMIT, 1);

        IF L_LIMIT <= 0 THEN
            L_OFFSET := 0;
            L_LIMIT  := 1000000;
        END IF;

        OPEN P_CURSOR FOR
        WITH ADV AS (
            SELECT PONO, SUM (POADAMOUNT) AS POADAMOUNT
              FROM FIN_SNAP_POADV
             WHERE (BRANCH = P_BRANCHID OR P_BRANCHID = 1)
             GROUP BY PONO),
        SRC AS (
            SELECT S.VENDORNAME,
                   S.CURRENCY,
                   -- DUEDATE_AGING, not DUEDATE_FORECAST: this report excludes
                   -- one PO from the due-date calculation and the snapshot has
                   -- already applied that.
                   S.DUEDATE_AGING                                   AS DUEDATE,
                   S.PB_OUTSTANDING - NVL (ADV.POADAMOUNT, 0)        AS OUTSTANDING
              FROM FIN_SNAP_PO S
                   LEFT JOIN ADV ON S.POHDRID = ADV.PONO
             WHERE (S.BRANCHNAME = P_BNAME OR P_BNAME = 'ALL')
               AND (S.VENDORNAME_KEY = TRIM (UPPER (P_VNAME)) OR P_VNAME = 'ALL')
               AND (S.PROJECTCODE = P_PCODE OR P_PCODE = 'ALL')
               AND (   P_OUTSTANDING_STATUS = 'ALL'
                    OR (    P_OUTSTANDING_STATUS = 'OUTSTANDING'
                        AND S.PB_OUTSTANDING - NVL (ADV.POADAMOUNT, 0) > 0))),
        AGG AS (
            SELECT /*+ MATERIALIZE */
                   VENDORNAME,
                   CURRENCY,
                   SUM (CASE WHEN     DUEDATE < TRUNC (SYSDATE)
                                  AND TRUNC (SYSDATE) - TRUNC (DUEDATE) BETWEEN 1 AND 30
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_1_30,
                   SUM (CASE WHEN     DUEDATE < TRUNC (SYSDATE)
                                  AND TRUNC (SYSDATE) - TRUNC (DUEDATE) BETWEEN 31 AND 60
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_31_60,
                   SUM (CASE WHEN     DUEDATE < TRUNC (SYSDATE)
                                  AND TRUNC (SYSDATE) - TRUNC (DUEDATE) BETWEEN 61 AND 90
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_61_90,
                   SUM (CASE WHEN     DUEDATE < TRUNC (SYSDATE)
                                  AND TRUNC (SYSDATE) - TRUNC (DUEDATE) BETWEEN 91 AND 120
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_91_120,
                   SUM (CASE WHEN     DUEDATE < TRUNC (SYSDATE)
                                  AND TRUNC (SYSDATE) - TRUNC (DUEDATE) BETWEEN 121 AND 180
                             THEN OUTSTANDING ELSE 0 END)            AS DAYS_121_180,
                   SUM (CASE WHEN     DUEDATE < TRUNC (SYSDATE)
                                  AND TRUNC (SYSDATE) - TRUNC (DUEDATE) > 180
                             THEN OUTSTANDING ELSE 0 END)            AS ABOVE_180_DAYS,
                   SUM (CASE WHEN DUEDATE < TRUNC (SYSDATE)
                             THEN OUTSTANDING ELSE 0 END)            AS TOTAL_OVERDUE,
                   SUM (OUTSTANDING)                                 AS TOTAL_OUTSTANDING
              FROM SRC
             GROUP BY VENDORNAME, CURRENCY)
        SELECT Q.*,
               COUNT (*) OVER ()                                     AS TOTAL_ROWS,
               (SELECT M.REFRESHED_AT FROM FIN_SNAP_META M
                 WHERE M.SNAP_NAME = G_SNAP_NAME)                    AS SNAPSHOT_AT
          FROM AGG Q
         WHERE (P_CURRENCY IS NULL OR P_CURRENCY = 'ALL' OR Q.CURRENCY = P_CURRENCY)
         ORDER BY
             CASE WHEN P_SORT_DIR = 'ASC' THEN
                  CASE P_SORT_COL WHEN 'VENDORNAME' THEN Q.VENDORNAME
                                  WHEN 'CURRENCY'   THEN Q.CURRENCY END END ASC,
             CASE WHEN P_SORT_DIR = 'DESC' THEN
                  CASE P_SORT_COL WHEN 'VENDORNAME' THEN Q.VENDORNAME
                                  WHEN 'CURRENCY'   THEN Q.CURRENCY END END DESC,
             CASE WHEN P_SORT_DIR = 'ASC' THEN
                  CASE P_SORT_COL WHEN 'DAYS_1_30'         THEN Q.DAYS_1_30
                                  WHEN 'DAYS_31_60'        THEN Q.DAYS_31_60
                                  WHEN 'DAYS_61_90'        THEN Q.DAYS_61_90
                                  WHEN 'DAYS_91_120'       THEN Q.DAYS_91_120
                                  WHEN 'DAYS_121_180'      THEN Q.DAYS_121_180
                                  WHEN 'ABOVE_180_DAYS'    THEN Q.ABOVE_180_DAYS
                                  WHEN 'TOTAL_OVERDUE'     THEN Q.TOTAL_OVERDUE
                                  WHEN 'TOTAL_OUTSTANDING' THEN Q.TOTAL_OUTSTANDING END END ASC,
             CASE WHEN P_SORT_DIR = 'DESC' THEN
                  CASE P_SORT_COL WHEN 'DAYS_1_30'         THEN Q.DAYS_1_30
                                  WHEN 'DAYS_31_60'        THEN Q.DAYS_31_60
                                  WHEN 'DAYS_61_90'        THEN Q.DAYS_61_90
                                  WHEN 'DAYS_91_120'       THEN Q.DAYS_91_120
                                  WHEN 'DAYS_121_180'      THEN Q.DAYS_121_180
                                  WHEN 'ABOVE_180_DAYS'    THEN Q.ABOVE_180_DAYS
                                  WHEN 'TOTAL_OVERDUE'     THEN Q.TOTAL_OVERDUE
                                  WHEN 'TOTAL_OUTSTANDING' THEN Q.TOTAL_OUTSTANDING END END DESC,
             Q.VENDORNAME
         OFFSET L_OFFSET ROWS FETCH NEXT L_LIMIT ROWS ONLY;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Supplier overdue aging fetched successfully';

    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR  := NULL;
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_GET_SUPPLIER_OVERDUE_AGING;

END PKG_FIN_SUPPLIER_REPORTS;
/
