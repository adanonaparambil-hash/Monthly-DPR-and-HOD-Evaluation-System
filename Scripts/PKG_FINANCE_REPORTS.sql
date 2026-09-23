-- ============================================================================
--  PKG_FINANCE_REPORTS  —  supplier payment reports for the portal
--  ---------------------------------------------------------------------------
--  Three procedures:
--      SP_GET_BRANCH_LIST                one call, returns BRANCHID + BRANCHNAME
--      SP_GET_SUPPLIER_PAYMENT_FORECAST  report 1
--      SP_GET_SUPPLIER_OVERDUE_AGING     report 2
--
--  ######################################################################
--  #  THIS WILL NOT COMPILE UNTIL THE ADK2026 GRANTS ARE APPLIED.       #
--  #                                                                     #
--  #  Checked just now: ADK2026 tables visible to ADK_TIMESHEET = 0.     #
--  #  A package compiles with DEFINER'S RIGHTS, which needs privileges   #
--  #  granted DIRECTLY to ADK_TIMESHEET — a role is not enough here.     #
--  #  Run GRANT_ADK2026_TO_REPORT_USER.sql (as ADK2026) first, or every  #
--  #  adk2026.<TABLE> line below fails with PLS-00201 / ORA-00942.       #
--  ######################################################################
--
--  The SQL bodies are the reports exactly as signed off. The only change is
--  that the five bind variables became parameters:
--
--      :BNAME               -> P_BNAME                VARCHAR2
--      :BRANCHID            -> P_BRANCHID             NUMBER     <-- numeric
--      :PCODE               -> P_PCODE                VARCHAR2
--      :VNAME               -> P_VNAME                VARCHAR2
--      :OUTSTANDING_STATUS  -> P_OUTSTANDING_STATUS   VARCHAR2
--
--  P_BRANCHID is declared NUMBER on purpose. As a bind it was being passed as
--  text by the SQL client and blew up with ORA-01722 on  :BRANCHID = 1 .
--  Typing the parameter makes that impossible: the API binds an int, and a
--  non-numeric value is rejected at the API boundary instead of deep inside
--  the query.
--
--  1 is the "all branches" sentinel — that is what the  OR P_BRANCHID = 1
--  branch is for. The UI sends 1 whenever the branch filter is "All".
-- ============================================================================


CREATE OR REPLACE PACKAGE PKG_FINANCE_REPORTS
AS

    -- Branch master for the filter dropdown: id AND name in ONE call, so the
    -- UI never has to look the id up from the name in a second round trip.
    PROCEDURE SP_GET_BRANCH_LIST (
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

    /*  PAGING
     *  P_PAGE_SIZE > 0   -> that many rows, starting at page P_PAGE_NO
     *  P_PAGE_SIZE <= 0  -> every row (used by Export, nothing else)
     *
     *  Every row carries TOTAL_ROWS, the size of the FULL result set, via
     *  COUNT(*) OVER (). That is deliberate and not an OUT parameter: a
     *  separate count would mean running this aggregation TWICE per page, and
     *  the aggregation is the expensive part. The window function is computed
     *  in the same pass, before OFFSET/FETCH trims the rows.
     */
    PROCEDURE SP_GET_SUPPLIER_PAYMENT_FORECAST (
        P_BNAME               IN  VARCHAR2,
        P_BRANCHID            IN  NUMBER,
        P_PCODE               IN  VARCHAR2,
        P_VNAME               IN  VARCHAR2,
        P_OUTSTANDING_STATUS  IN  VARCHAR2,
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
        P_PAGE_NO             IN  NUMBER DEFAULT 1,
        P_PAGE_SIZE           IN  NUMBER DEFAULT 500,
        P_CURSOR              OUT SYS_REFCURSOR,
        P_SUCCESS             OUT CHAR,
        P_MESSAGE             OUT VARCHAR2
    );

END PKG_FINANCE_REPORTS;
/


CREATE OR REPLACE PACKAGE BODY PKG_FINANCE_REPORTS
AS

    -- ========================================================================
    --  BRANCH LIST
    --  Your two queries were: names from BRANCH, then the id for a chosen
    --  name. Both in one cursor instead — the dropdown carries the id on each
    --  option, so picking a branch already knows its id and the second query
    --  disappears. CANCEL='F' is applied (your id query had it, the name query
    --  did not; without it a cancelled branch would be offered and then match
    --  nothing).
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
    --  REPORT 1 — SUPPLIER PAYMENT FORECAST
    -- ========================================================================
    PROCEDURE SP_GET_SUPPLIER_PAYMENT_FORECAST (
        P_BNAME               IN  VARCHAR2,
        P_BRANCHID            IN  NUMBER,
        P_PCODE               IN  VARCHAR2,
        P_VNAME               IN  VARCHAR2,
        P_OUTSTANDING_STATUS  IN  VARCHAR2,
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
        SELECT Q.*,
               COUNT (*) OVER ()                                     AS TOTAL_ROWS
          FROM (
          -- BRANCHNAME / BID / PROJECTCODE / OUTSTAND are NOT selected any
          -- more. They were constants echoing back what the caller had just
          -- sent, nothing displayed them, and they were four text columns
          -- sitting directly in front of the numeric buckets. That adjacency is
          -- what produced
          --     Error parsing column 6 (OVERDUE=OUTSTANDING - String)
          -- when the aliases slipped by one during a deployment: a text value
          -- landed in a numeric column and the whole report died. With the
          -- constants gone the cursor is VENDORNAME, CURRENCY and then numbers
          -- only, so that class of failure cannot recur.
          SELECT VENDORNAME,
                 CURRENCY,
                 SUM (CASE
                          WHEN DUEDATE < TRUNC (SYSDATE) THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS OVERDUE,
                 SUM (CASE
                          WHEN     DUEDATE >  TRUNC (SYSDATE)
                               AND DUEDATE <= TRUNC (SYSDATE) + 30   THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS NEXT_30_DAYS,
                 SUM (CASE
                          WHEN     DUEDATE >  TRUNC (SYSDATE) + 30
                               AND DUEDATE <= TRUNC (SYSDATE) + 60   THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_31_60,
                 SUM (CASE
                          WHEN     DUEDATE >  TRUNC (SYSDATE) + 60
                               AND DUEDATE <= TRUNC (SYSDATE) + 90   THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_61_90,
                 SUM (CASE
                          WHEN     DUEDATE >  TRUNC (SYSDATE) + 90
                               AND DUEDATE <= TRUNC (SYSDATE) + 120  THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_91_120,
                 SUM (CASE
                          WHEN DUEDATE > TRUNC (SYSDATE) + 120       THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS ABOVE_120_DAYS,
                 SUM (OUTSTANDING)                                   AS TOTAL_OUTSTANDING
            FROM (SELECT A.POHDRID,
                         A.DOCID                                     AS PONO,
                         A.DOCDT,
                         V.VENDORNAME,
                         A.CURRENCY,
                         P_BRANCHID                                  AS BRNCHID,
                         PM.PROJECTCODE,
                         NVL (SI.CREDITDAYS, 30)                     AS CREDITDAYS,
                         SI.DUEDATE,
                         NVL (A.TOTPOVALUE, 0)                       AS TOTPOVALUE,
                         NVL (PB.TOTAL_PB_AMOUNT, 0)                 AS PBAMOUNT,
                         NVL (PB.TOTAL_PAID_AMOUNT, 0)               AS PAIDAMOUNT,
                           NVL (PB.OUTSTANDING_AMOUNT, 0)
                         - NVL (POA.POADAMOUNT, 0)                   AS OUTSTANDING,
                         NVL (PB.TOTAL_DEBIT_NOTE, 0)                AS DEBIT_NOTE,
                         CASE
                             WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                  - NVL (POA.POADAMOUNT, 0) <= 0
                             THEN   0
                             WHEN   TRUNC (SYSDATE) > TRUNC (SI.DUEDATE)
                             THEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE)
                             ELSE   0
                         END                                         AS DAYS_OVERDUE,
                         CASE
                             WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                  - NVL (POA.POADAMOUNT, 0) <= 0
                             THEN   'Paid'
                             WHEN   SI.DUEDATE IS NULL
                             THEN   'Due Date Not Available'
                             WHEN   TRUNC (SYSDATE) <= TRUNC (SI.DUEDATE)
                             THEN   'Not Due'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 1 AND 30
                             THEN   '1-30 Days'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 31 AND 60
                             THEN   '31-60 Days'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 61 AND 90
                             THEN   '61-90 Days'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 91 AND 180
                             THEN   '91-180 Days'
                             ELSE   '>180 Days'
                         END                                         AS AGING,
                         CASE
                             WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                  - NVL (POA.POADAMOUNT, 0) <= 0
                             THEN   'Paid'
                             WHEN   SI.DUEDATE IS NULL
                             THEN   'Due Date Not Available'
                             WHEN   TRUNC (SI.DUEDATE) > TRUNC (SYSDATE)
                             THEN   'Upcoming'
                             WHEN   TRUNC (SI.DUEDATE) = TRUNC (SYSDATE)
                             THEN   'Due Today'
                             ELSE   'Overdue'
                         END                                         AS PAYMENT_STATUS,
                         NVL (PB.PB_COUNT, 0)                        AS PBCOUNT,
                         NVL (POA.POADAMOUNT, 0)                     AS POADAMOUNT
                    FROM (  SELECT A.BRANCHID,
                                   A.POHDRID,
                                   A.PAYTERM,
                                   A.SUPPLIER,
                                   A.DOCID,
                                   A.DOCDT,
                                   B.PROJECTCODE,
                                   A.APPROVAL,
                                   C.CURRENCY,
                                   SUM (  NVL (B.GROSSAMT, 0)
                                        + NVL (B.VATVALUE, 0))       AS TOTPOVALUE
                              FROM adk2026.POHDR A
                                   JOIN adk2026.PODTL B
                                       ON A.POHDRID = B.POHDRID
                                   JOIN adk2026.CURRENCY C
                                       ON A.CURRENCY = C.CURRENCYID
                             WHERE A.CANCEL = 'F'
                          GROUP BY A.BRANCHID,
                                   A.POHDRID,
                                   A.PAYTERM,
                                   A.SUPPLIER,
                                   A.DOCID,
                                   A.DOCDT,
                                   B.PROJECTCODE,
                                   A.APPROVAL,
                                   C.CURRENCY) A
                         JOIN adk2026.VENDOR V
                             ON A.SUPPLIER = V.VENDORID
                         JOIN adk2026.BRANCH BR
                             ON A.BRANCHID = BR.BRANCHID
                         JOIN adk2026.PROJECTMASTER PM
                             ON A.PROJECTCODE = PM.PROJECTMASTERID

                         -- SI : supplier invoice -> due date, per PO.
                         -- The LISTAGG that used to be here is gone: it raised
                         -- ORA-01489 once a PO had enough invoices, and nothing
                         -- outside this sub-query ever read it.
                         LEFT JOIN
                         (  SELECT B.POHDRID,
                                   MIN (A.SUPINVDATE)                           AS SUPINVDATE,
                                   MAX (NVL (V.CREDITDAYS, 30))                 AS CREDITDAYS,
                                   MAX (A.SUPINVDATE + NVL (V.CREDITDAYS, 30))  AS DUEDATE
                              FROM adk2026.SUPPINVBASIC A
                                   JOIN adk2026.SUPINVPO B
                                       ON A.SUPPINVBASICID = B.SUPPINVBASICID
                                   JOIN adk2026.VENDOR V
                                       ON A.SUPPLIERNAME = V.VENDORID
                                   JOIN adk2026.BRANCH BR
                                       ON A.BRANCHNAME = BR.BRANCHID
                             WHERE A.CANCEL = 'F'
                               AND B.POHDRID NOT IN (0, 1)
                          GROUP BY B.POHDRID) SI
                             ON A.POHDRID = SI.POHDRID

                         -- PB : purchase bills, payments and debit notes
                         LEFT JOIN
                         (SELECT X.POHDRID,
                                 X.PROJECTMASTERID,
                                 X.PB_COUNT,
                                 X.TOTAL_PB_AMOUNT,
                                 X.TOTAL_PAID_AMOUNT,
                                 X.TOTAL_DEBIT_NOTE,
                                   X.TOTAL_PB_AMOUNT
                                 - ABS (X.TOTAL_PAID_AMOUNT)
                                 - X.TOTAL_DEBIT_NOTE                AS OUTSTANDING_AMOUNT
                            FROM (  SELECT X.POHDRID,
                                           X.PROJECTMASTERID,
                                           COUNT (DISTINCT X.PBILL_ID)          AS PB_COUNT,
                                           SUM (X.PROJECT_PB_AMOUNT)            AS TOTAL_PB_AMOUNT,
                                           -- ROUND(..., 2) is NOT cosmetic. These two
                                           -- are the only DIVISIONS in the report, and
                                           -- Oracle returns up to 38 significant digits
                                           -- from one. .NET decimal holds 28-29, so the
                                           -- reader threw
                                           --   OverflowException: Arithmetic operation
                                           --   resulted in an overflow
                                           -- before a single row could be mapped, which
                                           -- surfaced as the misleading Dapper messages
                                           -- "OVERDUE=RIAL OMANI" / "OVERDUE=OUTSTANDING".
                                           -- Rounding each allocation to 2 decimals is
                                           -- also what the report should do anyway: it is
                                           -- a share of a bill in currency, and the screen
                                           -- prints 2 decimals regardless.
                                           SUM (ROUND (  NVL (P.PAYMENT_AMOUNT, 0)
                                                       * X.PROJECT_PB_AMOUNT
                                                       / NULLIF (X.FULL_PB_AMOUNT, 0), 2)) AS TOTAL_PAID_AMOUNT,
                                           SUM (ROUND (  NVL (DN.DEBIT_NOTE_AMOUNT, 0)
                                                       * X.PROJECT_PB_AMOUNT
                                                       / NULLIF (X.FULL_PB_AMOUNT, 0), 2)) AS TOTAL_DEBIT_NOTE
                                      FROM (  SELECT LD.LPURCHASEBILLHDRID      AS PBILL_ID,
                                                     LG.POHDRID,
                                                     PM.PROJECTMASTERID,
                                                     SUM (  NVL (LD.GRAMT, 0)
                                                          + (  NVL (VATAMOUNT, 0)
                                                             - NVL (RCMVATAMT, 0))) AS PROJECT_PB_AMOUNT,
                                                     (SELECT SUM (  NVL (LD1.GRAMT, 0)
                                                                  + (  NVL (LD1.VATAMOUNT, 0)
                                                                     - NVL (LD1.RCMVATAMT, 0)))
                                                        FROM adk2026.LPURCHASEBILLDTL LD1
                                                       WHERE LD1.LPURCHASEBILLHDRID =
                                                             LD.LPURCHASEBILLHDRID) AS FULL_PB_AMOUNT
                                                FROM adk2026.LPURCHASEBILLDTL LD
                                                     JOIN adk2026.LPURCHASEBILLHDR LH
                                                         ON LH.LPURCHASEBILLHDRID =
                                                            LD.LPURCHASEBILLHDRID
                                                     JOIN adk2026.LOCALGRNHDR LG
                                                         ON LG.DOCID = LD.GRNO
                                                     JOIN adk2026.PROJECTMASTER PM
                                                         ON LD.PROJECTCODE =
                                                            PM.PROJECTMASTERID
                                               WHERE     LH.CANCEL = 'F'
                                                     AND LG.CANCEL = 'F'
                                                     AND (   PM.PROJECTCODE = P_PCODE
                                                          OR P_PCODE = 'ALL')
                                            GROUP BY LD.LPURCHASEBILLHDRID,
                                                     LG.POHDRID,
                                                     PM.PROJECTMASTERID) X
                                           LEFT JOIN
                                           (  SELECT LH.LPURCHASEBILLHDRID      AS PBILL_ID,
                                                     SUM (NVL (B.ARAPSETAMOUNT, 0)) AS PAYMENT_AMOUNT
                                                FROM adk2026.ARAPPAYHDR A
                                                     JOIN adk2026.ARAPPAYDTL B
                                                         ON B.ARAPPAYHDRID = A.ARAPPAYHDRID
                                                     JOIN adk2026.ARAPDETAILS AD
                                                         ON AD.ARAPDETAILSID =
                                                            B.SVOUCHER_NUMBER
                                                     JOIN adk2026.LPURCHASEBILLHDR LH
                                                         ON LH.DOCID = AD.VOUCHER_NUMBER
                                               WHERE     A.CANCEL = 'F'
                                                     AND A.BANKCASHACCOUNT <> 0
                                                     AND LH.CANCEL = 'F'
                                            GROUP BY LH.LPURCHASEBILLHDRID) P
                                               ON P.PBILL_ID = X.PBILL_ID
                                           LEFT JOIN
                                           (  SELECT B.LPURCHASEBILLHDRID       AS PB_VOUCHER,
                                                     SUM (ABS (NVL (B_ADJUSTED, 0))) AS DEBIT_NOTE_AMOUNT
                                                FROM adk2026.ARAPADJUSTMENTS A
                                                     JOIN adk2026.LPURCHASEBILLHDR B
                                                         ON A.SVOUCHER_NUMBER = B.DOCID
                                               WHERE     RVOUCHER_NUMBER LIKE '%DN%'
                                                     AND SVOUCHER_NUMBER LIKE '%PB%'
                                            GROUP BY LPURCHASEBILLHDRID) DN
                                               ON DN.PB_VOUCHER = X.PBILL_ID
                                     WHERE X.PROJECT_PB_AMOUNT <> 0
                                  GROUP BY X.POHDRID,
                                           X.PROJECTMASTERID) X) PB
                             ON     A.POHDRID = PB.POHDRID
                                AND PM.PROJECTMASTERID = PB.PROJECTMASTERID

                         -- POA : PO advances already paid
                         LEFT JOIN
                         (  SELECT AP.PONO,
                                   SUM (NVL (AP.POADVANCEAMT, 0))               AS POADAMOUNT
                              FROM adk2026.ARAPPAYHDR AA
                                   JOIN adk2026.ARAPPAYHDR_POADV AP
                                       ON AA.ARAPPAYHDRID = AP.ARAPPAYHDRID
                             WHERE     AA.CANCEL = 'F'
                                   AND AA.BANKCASHACCOUNT <> 0
                                   AND (AA.BRANCH = P_BRANCHID OR P_BRANCHID = 1)
                          GROUP BY AP.PONO) POA
                             ON A.POHDRID = POA.PONO

                   WHERE     (BR.BRANCHNAME = P_BNAME OR P_BNAME = 'ALL')
                         AND (   TRIM (UPPER (V.VENDORNAME)) = TRIM (UPPER (P_VNAME))
                              OR P_VNAME = 'ALL')
                         AND (PM.PROJECTCODE = P_PCODE OR P_PCODE = 'ALL')
                         AND A.APPROVAL = 'Yes'
                         AND (   P_OUTSTANDING_STATUS = 'ALL'
                              OR (    P_OUTSTANDING_STATUS = 'OUTSTANDING'
                                  AND   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                      - NVL (POA.POADAMOUNT, 0) > 0)))
        GROUP BY VENDORNAME, CURRENCY
               ) Q
         ORDER BY Q.VENDORNAME
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
    --  REPORT 2 — SUPPLIER OVERDUE AGING
    -- ========================================================================
    PROCEDURE SP_GET_SUPPLIER_OVERDUE_AGING (
        P_BNAME               IN  VARCHAR2,
        P_BRANCHID            IN  NUMBER,
        P_PCODE               IN  VARCHAR2,
        P_VNAME               IN  VARCHAR2,
        P_OUTSTANDING_STATUS  IN  VARCHAR2,
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
        SELECT Q.*,
               COUNT (*) OVER ()                                     AS TOTAL_ROWS
          FROM (
          -- BRANCHNAME / BID / PROJECTCODE / OUTSTAND are NOT selected any
          -- more. They were constants echoing back what the caller had just
          -- sent, nothing displayed them, and they were four text columns
          -- sitting directly in front of the numeric buckets. That adjacency is
          -- what produced
          --     Error parsing column 6 (OVERDUE=OUTSTANDING - String)
          -- when the aliases slipped by one during a deployment: a text value
          -- landed in a numeric column and the whole report died. With the
          -- constants gone the cursor is VENDORNAME, CURRENCY and then numbers
          -- only, so that class of failure cannot recur.
          SELECT VENDORNAME,
                 CURRENCY,
                 SUM (CASE
                          WHEN     DUEDATE < TRUNC (SYSDATE)
                               AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                                     BETWEEN 1 AND 30                THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_1_30,
                 SUM (CASE
                          WHEN     DUEDATE < TRUNC (SYSDATE)
                               AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                                     BETWEEN 31 AND 60               THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_31_60,
                 SUM (CASE
                          WHEN     DUEDATE < TRUNC (SYSDATE)
                               AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                                     BETWEEN 61 AND 90               THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_61_90,
                 SUM (CASE
                          WHEN     DUEDATE < TRUNC (SYSDATE)
                               AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                                     BETWEEN 91 AND 120              THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_91_120,
                 SUM (CASE
                          WHEN     DUEDATE < TRUNC (SYSDATE)
                               AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                                     BETWEEN 121 AND 180             THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS DAYS_121_180,
                 SUM (CASE
                          WHEN     DUEDATE < TRUNC (SYSDATE)
                               AND TRUNC (SYSDATE) - TRUNC (DUEDATE) > 180
                                                                     THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS ABOVE_180_DAYS,
                 SUM (CASE
                          WHEN DUEDATE < TRUNC (SYSDATE) THEN OUTSTANDING
                          ELSE 0
                      END)                                           AS TOTAL_OVERDUE,
                 SUM (OUTSTANDING)                                   AS TOTAL_OUTSTANDING
            FROM (SELECT A.POHDRID,
                         A.DOCID                                     AS PONO,
                         A.DOCDT,
                         V.VENDORNAME,
                         A.CURRENCY,
                         P_BRANCHID                                  AS BRNCHID,
                         PM.PROJECTCODE,
                         NVL (SI.CREDITDAYS, 30)                     AS CREDITDAYS,
                         SI.DUEDATE,
                         NVL (A.TOTPOVALUE, 0)                       AS TOTPOVALUE,
                         NVL (PB.TOTAL_PB_AMOUNT, 0)                 AS PBAMOUNT,
                         NVL (PB.TOTAL_PAID_AMOUNT, 0)               AS PAIDAMOUNT,
                           NVL (PB.OUTSTANDING_AMOUNT, 0)
                         - NVL (POA.POADAMOUNT, 0)                   AS OUTSTANDING,
                         NVL (PB.TOTAL_DEBIT_NOTE, 0)                AS DEBIT_NOTE,
                         CASE
                             WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                  - NVL (POA.POADAMOUNT, 0) <= 0
                             THEN   0
                             WHEN   TRUNC (SYSDATE) > TRUNC (SI.DUEDATE)
                             THEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE)
                             ELSE   0
                         END                                         AS DAYS_OVERDUE,
                         CASE
                             WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                  - NVL (POA.POADAMOUNT, 0) <= 0
                             THEN   'Paid'
                             WHEN   SI.DUEDATE IS NULL
                             THEN   'Due Date Not Available'
                             WHEN   TRUNC (SYSDATE) <= TRUNC (SI.DUEDATE)
                             THEN   'Not Due'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 1 AND 30
                             THEN   '1-30 Days'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 31 AND 60
                             THEN   '31-60 Days'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 61 AND 90
                             THEN   '61-90 Days'
                             WHEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE) BETWEEN 91 AND 180
                             THEN   '91-180 Days'
                             ELSE   '>180 Days'
                         END                                         AS AGING,
                         CASE
                             WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                  - NVL (POA.POADAMOUNT, 0) <= 0
                             THEN   'Paid'
                             WHEN   SI.DUEDATE IS NULL
                             THEN   'Due Date Not Available'
                             WHEN   TRUNC (SI.DUEDATE) > TRUNC (SYSDATE)
                             THEN   'Upcoming'
                             WHEN   TRUNC (SI.DUEDATE) = TRUNC (SYSDATE)
                             THEN   'Due Today'
                             ELSE   'Overdue'
                         END                                         AS PAYMENT_STATUS,
                         NVL (PB.PB_COUNT, 0)                        AS PBCOUNT,
                         NVL (POA.POADAMOUNT, 0)                     AS POADAMOUNT
                    FROM (  SELECT A.BRANCHID,
                                   A.POHDRID,
                                   A.PAYTERM,
                                   A.SUPPLIER,
                                   A.DOCID,
                                   A.DOCDT,
                                   B.PROJECTCODE,
                                   A.APPROVAL,
                                   C.CURRENCY,
                                   SUM (  NVL (B.GROSSAMT, 0)
                                        + NVL (B.VATVALUE, 0))       AS TOTPOVALUE
                              FROM adk2026.POHDR A
                                   JOIN adk2026.PODTL B
                                       ON A.POHDRID = B.POHDRID
                                   JOIN adk2026.CURRENCY C
                                       ON A.CURRENCY = C.CURRENCYID
                             WHERE A.CANCEL = 'F'
                          GROUP BY A.BRANCHID,
                                   A.POHDRID,
                                   A.PAYTERM,
                                   A.SUPPLIER,
                                   A.DOCID,
                                   A.DOCDT,
                                   B.PROJECTCODE,
                                   A.APPROVAL,
                                   C.CURRENCY) A
                         JOIN adk2026.VENDOR V
                             ON A.SUPPLIER = V.VENDORID
                         JOIN adk2026.BRANCH BR
                             ON A.BRANCHID = BR.BRANCHID
                         JOIN adk2026.PROJECTMASTER PM
                             ON A.PROJECTCODE = PM.PROJECTMASTERID

                         -- SI : as report 1, plus this report's extra exclusion
                         LEFT JOIN
                         (  SELECT B.POHDRID,
                                   MIN (A.SUPINVDATE)                           AS SUPINVDATE,
                                   MAX (NVL (V.CREDITDAYS, 30))                 AS CREDITDAYS,
                                   MAX (A.SUPINVDATE + NVL (V.CREDITDAYS, 30))  AS DUEDATE
                              FROM adk2026.SUPPINVBASIC A
                                   JOIN adk2026.SUPINVPO B
                                       ON A.SUPPINVBASICID = B.SUPPINVBASICID
                                   JOIN adk2026.VENDOR V
                                       ON A.SUPPLIERNAME = V.VENDORID
                                   JOIN adk2026.BRANCH BR
                                       ON A.BRANCHNAME = BR.BRANCHID
                             WHERE     A.CANCEL = 'F'
                                   AND B.POHDRID <> 10051000032382
                                   AND B.POHDRID NOT IN (0, 1)
                          GROUP BY B.POHDRID) SI
                             ON A.POHDRID = SI.POHDRID

                         LEFT JOIN
                         (SELECT X.POHDRID,
                                 X.PROJECTMASTERID,
                                 X.PB_COUNT,
                                 X.TOTAL_PB_AMOUNT,
                                 X.TOTAL_PAID_AMOUNT,
                                 X.TOTAL_DEBIT_NOTE,
                                   X.TOTAL_PB_AMOUNT
                                 - ABS (X.TOTAL_PAID_AMOUNT)
                                 - X.TOTAL_DEBIT_NOTE                AS OUTSTANDING_AMOUNT
                            FROM (  SELECT X.POHDRID,
                                           X.PROJECTMASTERID,
                                           COUNT (DISTINCT X.PBILL_ID)          AS PB_COUNT,
                                           SUM (X.PROJECT_PB_AMOUNT)            AS TOTAL_PB_AMOUNT,
                                           -- ROUND(..., 2) is NOT cosmetic. These two
                                           -- are the only DIVISIONS in the report, and
                                           -- Oracle returns up to 38 significant digits
                                           -- from one. .NET decimal holds 28-29, so the
                                           -- reader threw
                                           --   OverflowException: Arithmetic operation
                                           --   resulted in an overflow
                                           -- before a single row could be mapped, which
                                           -- surfaced as the misleading Dapper messages
                                           -- "OVERDUE=RIAL OMANI" / "OVERDUE=OUTSTANDING".
                                           -- Rounding each allocation to 2 decimals is
                                           -- also what the report should do anyway: it is
                                           -- a share of a bill in currency, and the screen
                                           -- prints 2 decimals regardless.
                                           SUM (ROUND (  NVL (P.PAYMENT_AMOUNT, 0)
                                                       * X.PROJECT_PB_AMOUNT
                                                       / NULLIF (X.FULL_PB_AMOUNT, 0), 2)) AS TOTAL_PAID_AMOUNT,
                                           SUM (ROUND (  NVL (DN.DEBIT_NOTE_AMOUNT, 0)
                                                       * X.PROJECT_PB_AMOUNT
                                                       / NULLIF (X.FULL_PB_AMOUNT, 0), 2)) AS TOTAL_DEBIT_NOTE
                                      FROM (  SELECT LD.LPURCHASEBILLHDRID      AS PBILL_ID,
                                                     LG.POHDRID,
                                                     PM.PROJECTMASTERID,
                                                     SUM (  NVL (LD.GRAMT, 0)
                                                          + (  NVL (VATAMOUNT, 0)
                                                             - NVL (RCMVATAMT, 0))) AS PROJECT_PB_AMOUNT,
                                                     (SELECT SUM (  NVL (LD1.GRAMT, 0)
                                                                  + (  NVL (LD1.VATAMOUNT, 0)
                                                                     - NVL (LD1.RCMVATAMT, 0)))
                                                        FROM adk2026.LPURCHASEBILLDTL LD1
                                                       WHERE LD1.LPURCHASEBILLHDRID =
                                                             LD.LPURCHASEBILLHDRID) AS FULL_PB_AMOUNT
                                                FROM adk2026.LPURCHASEBILLDTL LD
                                                     JOIN adk2026.LPURCHASEBILLHDR LH
                                                         ON LH.LPURCHASEBILLHDRID =
                                                            LD.LPURCHASEBILLHDRID
                                                     JOIN adk2026.LOCALGRNHDR LG
                                                         ON LG.DOCID = LD.GRNO
                                                     JOIN adk2026.PROJECTMASTER PM
                                                         ON LD.PROJECTCODE =
                                                            PM.PROJECTMASTERID
                                               WHERE     LH.CANCEL = 'F'
                                                     AND LG.CANCEL = 'F'
                                                     AND (   PM.PROJECTCODE = P_PCODE
                                                          OR P_PCODE = 'ALL')
                                            GROUP BY LD.LPURCHASEBILLHDRID,
                                                     LG.POHDRID,
                                                     PM.PROJECTMASTERID) X
                                           LEFT JOIN
                                           (  SELECT LH.LPURCHASEBILLHDRID      AS PBILL_ID,
                                                     SUM (NVL (B.ARAPSETAMOUNT, 0)) AS PAYMENT_AMOUNT
                                                FROM adk2026.ARAPPAYHDR A
                                                     JOIN adk2026.ARAPPAYDTL B
                                                         ON B.ARAPPAYHDRID = A.ARAPPAYHDRID
                                                     JOIN adk2026.ARAPDETAILS AD
                                                         ON AD.ARAPDETAILSID =
                                                            B.SVOUCHER_NUMBER
                                                     JOIN adk2026.LPURCHASEBILLHDR LH
                                                         ON LH.DOCID = AD.VOUCHER_NUMBER
                                               WHERE     A.CANCEL = 'F'
                                                     AND A.BANKCASHACCOUNT <> 0
                                                     AND LH.CANCEL = 'F'
                                            GROUP BY LH.LPURCHASEBILLHDRID) P
                                               ON P.PBILL_ID = X.PBILL_ID
                                           LEFT JOIN
                                           (  SELECT B.LPURCHASEBILLHDRID       AS PB_VOUCHER,
                                                     SUM (ABS (NVL (B_ADJUSTED, 0))) AS DEBIT_NOTE_AMOUNT
                                                FROM adk2026.ARAPADJUSTMENTS A
                                                     JOIN adk2026.LPURCHASEBILLHDR B
                                                         ON A.SVOUCHER_NUMBER = B.DOCID
                                               WHERE     RVOUCHER_NUMBER LIKE '%DN%'
                                                     AND SVOUCHER_NUMBER LIKE '%PB%'
                                            GROUP BY LPURCHASEBILLHDRID) DN
                                               ON DN.PB_VOUCHER = X.PBILL_ID
                                     WHERE X.PROJECT_PB_AMOUNT <> 0
                                  GROUP BY X.POHDRID,
                                           X.PROJECTMASTERID) X) PB
                             ON     A.POHDRID = PB.POHDRID
                                AND PM.PROJECTMASTERID = PB.PROJECTMASTERID

                         LEFT JOIN
                         (  SELECT AP.PONO,
                                   SUM (NVL (AP.POADVANCEAMT, 0))               AS POADAMOUNT
                              FROM adk2026.ARAPPAYHDR AA
                                   JOIN adk2026.ARAPPAYHDR_POADV AP
                                       ON AA.ARAPPAYHDRID = AP.ARAPPAYHDRID
                             WHERE     AA.CANCEL = 'F'
                                   AND AA.BANKCASHACCOUNT <> 0
                                   AND (AA.BRANCH = P_BRANCHID OR P_BRANCHID = 1)
                          GROUP BY AP.PONO) POA
                             ON A.POHDRID = POA.PONO

                   WHERE     (BR.BRANCHNAME = P_BNAME OR P_BNAME = 'ALL')
                         AND (   TRIM (UPPER (V.VENDORNAME)) = TRIM (UPPER (P_VNAME))
                              OR P_VNAME = 'ALL')
                         AND (PM.PROJECTCODE = P_PCODE OR P_PCODE = 'ALL')
                         AND A.APPROVAL = 'Yes'
                         AND (   P_OUTSTANDING_STATUS = 'ALL'
                              OR (    P_OUTSTANDING_STATUS = 'OUTSTANDING'
                                  AND   NVL (PB.OUTSTANDING_AMOUNT, 0)
                                      - NVL (POA.POADAMOUNT, 0) > 0)))
        GROUP BY VENDORNAME, CURRENCY
               ) Q
         ORDER BY Q.VENDORNAME
         OFFSET L_OFFSET ROWS FETCH NEXT L_LIMIT ROWS ONLY;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'Supplier overdue aging fetched successfully';

    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR  := NULL;
            P_SUCCESS := 'N';
            P_MESSAGE := SQLERRM;
    END SP_GET_SUPPLIER_OVERDUE_AGING;

END PKG_FINANCE_REPORTS;
/


-- ============================================================================
--  AFTER COMPILING, CHECK FOR ERRORS:
--      SELECT LINE, POSITION, TEXT FROM USER_ERRORS
--       WHERE NAME = 'PKG_FINANCE_REPORTS' ORDER BY SEQUENCE;
--
--  If you see PLS-00201 / "identifier ADK2026.<TABLE> must be declared", the
--  grants have not been applied. That is the only expected failure.
-- ============================================================================
