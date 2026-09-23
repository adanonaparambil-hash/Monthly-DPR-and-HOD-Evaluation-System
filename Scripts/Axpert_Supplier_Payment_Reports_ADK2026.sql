================================================================================
  AXPERT — SUPPLIER PAYMENT REPORTS
  Schema-qualified for ADK2026 and reformatted.

  WHAT CHANGED
    * every base TABLE is now written as  adk2026.<TABLE> <ALIAS>
    * indentation, keyword case and alias alignment made consistent
    * two missing AS keywords added on column aliases (OUTSTAND, DEBIT_NOTE)

  ORA-01489 FIX (note 3)
    The SI sub-query built a comma-separated list of every supplier invoice
    number on a PO:

        LISTAGG (A.SUPINVNO, ', ') WITHIN GROUP (ORDER BY A.SUPINVDATE)

    LISTAGG returns a VARCHAR2, and this database runs max_string_size =
    STANDARD, so that is capped at 4000 BYTES. A PO with enough supplier
    invoices overflows the cap and the whole report dies with
    ORA-01489 "result of string concatenation is too long".

    It is removed, because the outer query never used it. Checked: the only
    columns read out of SI are CREDITDAYS and DUEDATE. SUPINVNO was built and
    thrown away, so removing it cannot change a single figure — it only stops
    the report failing once a PO collects enough invoices.

    (MIN (A.SUPINVDATE) AS SUPINVDATE is also unused, but it is cheap and
    cannot fail, so it is left alone.)

    If the invoice list is ever wanted for a drill-down, this database is 19c
    so the safe form is available:

        LISTAGG (A.SUPINVNO, ', ' ON OVERFLOW TRUNCATE '...' WITH COUNT)
            WITHIN GROUP (ORDER BY A.SUPINVDATE)

    which truncates and appends the number omitted instead of raising.

  WHAT DID NOT CHANGE
    * no join, filter, grouping, CASE branch or expression was touched
    * derived-table aliases (A, SI, PB, POA, X, P, DN) are NOT prefixed —
      they are inline views, not tables, and adk2026.X would not resolve
    * columns left unqualified in the original (VATAMOUNT, RCMVATAMT,
      B_ADJUSTED, RVOUCHER_NUMBER, SVOUCHER_NUMBER, LPURCHASEBILLHDRID in the
      DN group by) are STILL unqualified. They resolve correctly today; adding
      a guessed alias to them could silently point at a different table's
      column and change the numbers.
    * report 2 keeps its extra filter  b.pohdrid <> 10051000032382

  46 table references were prefixed in total, 23 in each report.
================================================================================


================================================================================
 1. SUPPLIER PAYMENT FORECAST REPORT
================================================================================

  SELECT :BNAME                                                AS BRANCHNAME,
         VENDORNAME,
         CURRENCY,
         :BRANCHID                                             AS BID,
         'ALL'                                                 AS PROJECTCODE,
         'OUTSTANDING'                                         AS OUTSTAND,
         SUM (CASE
                  WHEN DUEDATE < TRUNC (SYSDATE) THEN OUTSTANDING
                  ELSE 0
              END)                                             AS OVERDUE,
         SUM (CASE
                  WHEN     DUEDATE >  TRUNC (SYSDATE)
                       AND DUEDATE <= TRUNC (SYSDATE) + 30     THEN OUTSTANDING
                  ELSE 0
              END)                                             AS NEXT_30_DAYS,
         SUM (CASE
                  WHEN     DUEDATE >  TRUNC (SYSDATE) + 30
                       AND DUEDATE <= TRUNC (SYSDATE) + 60     THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_31_60,
         SUM (CASE
                  WHEN     DUEDATE >  TRUNC (SYSDATE) + 60
                       AND DUEDATE <= TRUNC (SYSDATE) + 90     THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_61_90,
         SUM (CASE
                  WHEN     DUEDATE >  TRUNC (SYSDATE) + 90
                       AND DUEDATE <= TRUNC (SYSDATE) + 120    THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_91_120,
         SUM (CASE
                  WHEN DUEDATE > TRUNC (SYSDATE) + 120         THEN OUTSTANDING
                  ELSE 0
              END)                                             AS ABOVE_120_DAYS,
         SUM (OUTSTANDING)                                     AS TOTAL_OUTSTANDING
    FROM (SELECT A.POHDRID,
                 A.DOCID                                       AS PONO,
                 A.DOCDT,
                 V.VENDORNAME,
                 A.CURRENCY,
                 :BRANCHID                                     AS BRNCHID,
                 PM.PROJECTCODE,
                 NVL (SI.CREDITDAYS, 30)                       AS CREDITDAYS,
                 SI.DUEDATE,
                 NVL (A.TOTPOVALUE, 0)                         AS TOTPOVALUE,
                 NVL (PB.TOTAL_PB_AMOUNT, 0)                   AS PBAMOUNT,
                 NVL (PB.TOTAL_PAID_AMOUNT, 0)                 AS PAIDAMOUNT,
                   NVL (PB.OUTSTANDING_AMOUNT, 0)
                 - NVL (POA.POADAMOUNT, 0)                     AS OUTSTANDING,
                 NVL (PB.TOTAL_DEBIT_NOTE, 0)                  AS DEBIT_NOTE,
                 CASE
                     WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                          - NVL (POA.POADAMOUNT, 0) <= 0
                     THEN   0
                     WHEN   TRUNC (SYSDATE) > TRUNC (SI.DUEDATE)
                     THEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE)
                     ELSE   0
                 END                                           AS DAYS_OVERDUE,
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
                 END                                           AS AGING,
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
                 END                                           AS PAYMENT_STATUS,
                 NVL (PB.PB_COUNT, 0)                          AS PBCOUNT,
                 NVL (POA.POADAMOUNT, 0)                       AS POADAMOUNT
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
                                + NVL (B.VATVALUE, 0))         AS TOTPOVALUE
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

                 ---------------------------------------------------------------
                 -- SI : supplier invoice -> due date, per PO
                 ---------------------------------------------------------------
                 LEFT JOIN
                 (  SELECT B.POHDRID,
                           -- LISTAGG (A.SUPINVNO, ', ') removed — see note 3 in
                           -- the header. It raised ORA-01489 on POs with many
                           -- supplier invoices, and the outer query never read
                           -- the column it produced.
                           MIN (A.SUPINVDATE)                               AS SUPINVDATE,
                           MAX (NVL (V.CREDITDAYS, 30))                     AS CREDITDAYS,
                           MAX (A.SUPINVDATE + NVL (V.CREDITDAYS, 30))      AS DUEDATE
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

                 ---------------------------------------------------------------
                 -- PB : purchase bills, payments and debit notes, per PO/project
                 ---------------------------------------------------------------
                 LEFT JOIN
                 (SELECT X.POHDRID,
                         X.PROJECTMASTERID,
                         X.PB_COUNT,
                         X.TOTAL_PB_AMOUNT,
                         X.TOTAL_PAID_AMOUNT,
                         X.TOTAL_DEBIT_NOTE,
                           X.TOTAL_PB_AMOUNT
                         - ABS (X.TOTAL_PAID_AMOUNT)
                         - X.TOTAL_DEBIT_NOTE                               AS OUTSTANDING_AMOUNT
                    FROM (  SELECT X.POHDRID,
                                   X.PROJECTMASTERID,
                                   COUNT (DISTINCT X.PBILL_ID)              AS PB_COUNT,
                                   SUM (X.PROJECT_PB_AMOUNT)                AS TOTAL_PB_AMOUNT,
                                   SUM (  NVL (P.PAYMENT_AMOUNT, 0)
                                        * X.PROJECT_PB_AMOUNT
                                        / NULLIF (X.FULL_PB_AMOUNT, 0))     AS TOTAL_PAID_AMOUNT,
                                   SUM (  NVL (DN.DEBIT_NOTE_AMOUNT, 0)
                                        * X.PROJECT_PB_AMOUNT
                                        / NULLIF (X.FULL_PB_AMOUNT, 0))     AS TOTAL_DEBIT_NOTE
                              FROM (  SELECT LD.LPURCHASEBILLHDRID          AS PBILL_ID,
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
                                             AND (   PM.PROJECTCODE = :PCODE
                                                  OR :PCODE = 'ALL')
                                    GROUP BY LD.LPURCHASEBILLHDRID,
                                             LG.POHDRID,
                                             PM.PROJECTMASTERID) X

                                   ------------------------------------------------
                                   -- P : payments settled against each bill
                                   ------------------------------------------------
                                   LEFT JOIN
                                   (  SELECT LH.LPURCHASEBILLHDRID          AS PBILL_ID,
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

                                   ------------------------------------------------
                                   -- DN : debit notes adjusted against each bill
                                   ------------------------------------------------
                                   LEFT JOIN
                                   (  SELECT B.LPURCHASEBILLHDRID           AS PB_VOUCHER,
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

                 ---------------------------------------------------------------
                 -- POA : PO advances already paid
                 ---------------------------------------------------------------
                 LEFT JOIN
                 (  SELECT AP.PONO,
                           SUM (NVL (AP.POADVANCEAMT, 0))                   AS POADAMOUNT
                      FROM adk2026.ARAPPAYHDR AA
                           JOIN adk2026.ARAPPAYHDR_POADV AP
                               ON AA.ARAPPAYHDRID = AP.ARAPPAYHDRID
                     WHERE     AA.CANCEL = 'F'
                           AND AA.BANKCASHACCOUNT <> 0
                           AND (AA.BRANCH = :BRANCHID OR :BRANCHID = 1)
                  GROUP BY AP.PONO) POA
                     ON A.POHDRID = POA.PONO

           WHERE     (BR.BRANCHNAME = :BNAME OR :BNAME = 'ALL')
                 AND (   TRIM (UPPER (V.VENDORNAME)) = TRIM (UPPER (:VNAME))
                      OR :VNAME = 'ALL')
                 AND (PM.PROJECTCODE = :PCODE OR :PCODE = 'ALL')
                 AND A.APPROVAL = 'Yes'
                 AND (   :OUTSTANDING_STATUS = 'ALL'
                      OR (    :OUTSTANDING_STATUS = 'OUTSTANDING'
                          AND   NVL (PB.OUTSTANDING_AMOUNT, 0)
                              - NVL (POA.POADAMOUNT, 0) > 0)))
GROUP BY VENDORNAME, CURRENCY
ORDER BY VENDORNAME;


================================================================================
 2. SUPPLIER OVERDUE AGING REPORT
================================================================================

  SELECT :BNAME                                                AS BRANCHNAME,
         VENDORNAME,
         CURRENCY,
         :BRANCHID                                             AS BID,
         'ALL'                                                 AS PROJECTCODE,
         'OUTSTANDING'                                         AS OUTSTAND,
         SUM (CASE
                  WHEN     DUEDATE < TRUNC (SYSDATE)
                       AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                             BETWEEN 1 AND 30                  THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_1_30,
         SUM (CASE
                  WHEN     DUEDATE < TRUNC (SYSDATE)
                       AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                             BETWEEN 31 AND 60                 THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_31_60,
         SUM (CASE
                  WHEN     DUEDATE < TRUNC (SYSDATE)
                       AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                             BETWEEN 61 AND 90                 THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_61_90,
         SUM (CASE
                  WHEN     DUEDATE < TRUNC (SYSDATE)
                       AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                             BETWEEN 91 AND 120                THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_91_120,
         SUM (CASE
                  WHEN     DUEDATE < TRUNC (SYSDATE)
                       AND TRUNC (SYSDATE) - TRUNC (DUEDATE)
                             BETWEEN 121 AND 180               THEN OUTSTANDING
                  ELSE 0
              END)                                             AS DAYS_121_180,
         SUM (CASE
                  WHEN     DUEDATE < TRUNC (SYSDATE)
                       AND TRUNC (SYSDATE) - TRUNC (DUEDATE) > 180
                                                               THEN OUTSTANDING
                  ELSE 0
              END)                                             AS ABOVE_180_DAYS,
         SUM (CASE
                  WHEN DUEDATE < TRUNC (SYSDATE) THEN OUTSTANDING
                  ELSE 0
              END)                                             AS TOTAL_OVERDUE,
         SUM (OUTSTANDING)                                     AS TOTAL_OUTSTANDING
    FROM (SELECT A.POHDRID,
                 A.DOCID                                       AS PONO,
                 A.DOCDT,
                 V.VENDORNAME,
                 A.CURRENCY,
                 :BRANCHID                                     AS BRNCHID,
                 PM.PROJECTCODE,
                 NVL (SI.CREDITDAYS, 30)                       AS CREDITDAYS,
                 SI.DUEDATE,
                 NVL (A.TOTPOVALUE, 0)                         AS TOTPOVALUE,
                 NVL (PB.TOTAL_PB_AMOUNT, 0)                   AS PBAMOUNT,
                 NVL (PB.TOTAL_PAID_AMOUNT, 0)                 AS PAIDAMOUNT,
                   NVL (PB.OUTSTANDING_AMOUNT, 0)
                 - NVL (POA.POADAMOUNT, 0)                     AS OUTSTANDING,
                 NVL (PB.TOTAL_DEBIT_NOTE, 0)                  AS DEBIT_NOTE,
                 CASE
                     WHEN   NVL (PB.OUTSTANDING_AMOUNT, 0)
                          - NVL (POA.POADAMOUNT, 0) <= 0
                     THEN   0
                     WHEN   TRUNC (SYSDATE) > TRUNC (SI.DUEDATE)
                     THEN   TRUNC (SYSDATE) - TRUNC (SI.DUEDATE)
                     ELSE   0
                 END                                           AS DAYS_OVERDUE,
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
                 END                                           AS AGING,
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
                 END                                           AS PAYMENT_STATUS,
                 NVL (PB.PB_COUNT, 0)                          AS PBCOUNT,
                 NVL (POA.POADAMOUNT, 0)                       AS POADAMOUNT
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
                                + NVL (B.VATVALUE, 0))         AS TOTPOVALUE
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

                 ---------------------------------------------------------------
                 -- SI : supplier invoice -> due date, per PO
                 --      (this report also excludes one specific PO)
                 ---------------------------------------------------------------
                 LEFT JOIN
                 (  SELECT B.POHDRID,
                           -- LISTAGG (A.SUPINVNO, ', ') removed — see note 3 in
                           -- the header. It raised ORA-01489 on POs with many
                           -- supplier invoices, and the outer query never read
                           -- the column it produced.
                           MIN (A.SUPINVDATE)                               AS SUPINVDATE,
                           MAX (NVL (V.CREDITDAYS, 30))                     AS CREDITDAYS,
                           MAX (A.SUPINVDATE + NVL (V.CREDITDAYS, 30))      AS DUEDATE
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

                 ---------------------------------------------------------------
                 -- PB : purchase bills, payments and debit notes, per PO/project
                 ---------------------------------------------------------------
                 LEFT JOIN
                 (SELECT X.POHDRID,
                         X.PROJECTMASTERID,
                         X.PB_COUNT,
                         X.TOTAL_PB_AMOUNT,
                         X.TOTAL_PAID_AMOUNT,
                         X.TOTAL_DEBIT_NOTE,
                           X.TOTAL_PB_AMOUNT
                         - ABS (X.TOTAL_PAID_AMOUNT)
                         - X.TOTAL_DEBIT_NOTE                               AS OUTSTANDING_AMOUNT
                    FROM (  SELECT X.POHDRID,
                                   X.PROJECTMASTERID,
                                   COUNT (DISTINCT X.PBILL_ID)              AS PB_COUNT,
                                   SUM (X.PROJECT_PB_AMOUNT)                AS TOTAL_PB_AMOUNT,
                                   SUM (  NVL (P.PAYMENT_AMOUNT, 0)
                                        * X.PROJECT_PB_AMOUNT
                                        / NULLIF (X.FULL_PB_AMOUNT, 0))     AS TOTAL_PAID_AMOUNT,
                                   SUM (  NVL (DN.DEBIT_NOTE_AMOUNT, 0)
                                        * X.PROJECT_PB_AMOUNT
                                        / NULLIF (X.FULL_PB_AMOUNT, 0))     AS TOTAL_DEBIT_NOTE
                              FROM (  SELECT LD.LPURCHASEBILLHDRID          AS PBILL_ID,
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
                                             AND (   PM.PROJECTCODE = :PCODE
                                                  OR :PCODE = 'ALL')
                                    GROUP BY LD.LPURCHASEBILLHDRID,
                                             LG.POHDRID,
                                             PM.PROJECTMASTERID) X

                                   ------------------------------------------------
                                   -- P : payments settled against each bill
                                   ------------------------------------------------
                                   LEFT JOIN
                                   (  SELECT LH.LPURCHASEBILLHDRID          AS PBILL_ID,
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

                                   ------------------------------------------------
                                   -- DN : debit notes adjusted against each bill
                                   ------------------------------------------------
                                   LEFT JOIN
                                   (  SELECT B.LPURCHASEBILLHDRID           AS PB_VOUCHER,
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

                 ---------------------------------------------------------------
                 -- POA : PO advances already paid
                 ---------------------------------------------------------------
                 LEFT JOIN
                 (  SELECT AP.PONO,
                           SUM (NVL (AP.POADVANCEAMT, 0))                   AS POADAMOUNT
                      FROM adk2026.ARAPPAYHDR AA
                           JOIN adk2026.ARAPPAYHDR_POADV AP
                               ON AA.ARAPPAYHDRID = AP.ARAPPAYHDRID
                     WHERE     AA.CANCEL = 'F'
                           AND AA.BANKCASHACCOUNT <> 0
                           AND (AA.BRANCH = :BRANCHID OR :BRANCHID = 1)
                  GROUP BY AP.PONO) POA
                     ON A.POHDRID = POA.PONO

           WHERE     (BR.BRANCHNAME = :BNAME OR :BNAME = 'ALL')
                 AND (   TRIM (UPPER (V.VENDORNAME)) = TRIM (UPPER (:VNAME))
                      OR :VNAME = 'ALL')
                 AND (PM.PROJECTCODE = :PCODE OR :PCODE = 'ALL')
                 AND A.APPROVAL = 'Yes'
                 AND (   :OUTSTANDING_STATUS = 'ALL'
                      OR (    :OUTSTANDING_STATUS = 'OUTSTANDING'
                          AND   NVL (PB.OUTSTANDING_AMOUNT, 0)
                              - NVL (POA.POADAMOUNT, 0) > 0)))
GROUP BY VENDORNAME, CURRENCY
ORDER BY VENDORNAME;
