-- ============================================================================
--  ORA-01722 "invalid number" — SUPPLIER PAYMENT REPORTS
--  ---------------------------------------------------------------------------
--  ORA-01722 is never a syntax problem. It means Oracle was handed a piece of
--  TEXT where it needed a NUMBER and the text was not a valid numeric literal.
--  In this query there are only two places that can happen.
--
--  Work through STEP 1 first — it takes ten seconds and is the most likely
--  cause by a distance. Only go to STEP 2 if STEP 1 comes back clean.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  STEP 1 — THE BIND VARIABLE  :BRANCHID
--
--  Of the five binds, four are only ever compared against TEXT:
--      :BNAME               ... = :BNAME  OR :BNAME = 'ALL'
--      :VNAME               ... = :VNAME  OR :VNAME = 'ALL'
--      :PCODE               ... = :PCODE  OR :PCODE = 'ALL'
--      :OUTSTANDING_STATUS  ... = 'ALL' / 'OUTSTANDING'
--
--  :BRANCHID is the ONLY one compared against a number:
--
--      AND (AA.BRANCH = :BRANCHID OR :BRANCHID = 1)
--                                    ^^^^^^^^^^^^^^
--
--  SQL Developer types every bind you enter in its prompt dialog as a STRING.
--  So if you typed  ALL , or left it empty, or it picked up a stray space or
--  comma, Oracle must convert that text to a number for  :BRANCHID = 1  and
--  it cannot. The error is raised before a single table is read, which is why
--  it looks like the whole query is broken.
--
--  Run these two. The first shows what is actually being passed; the second
--  reproduces the failure on its own if the value is the problem.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT :BRANCHID                       AS WHAT_I_AM_PASSING,
       LENGTH (:BRANCHID)              AS ITS_LENGTH,
       DUMP (:BRANCHID)                AS ITS_BYTES
  FROM DUAL;

-- If this one raises ORA-01722, STEP 1 is your answer.
SELECT TO_NUMBER (:BRANCHID) AS BRANCHID_AS_A_NUMBER FROM DUAL;

--  FIX: pass a whole number. 1 means "every branch" — that is what the
--       OR :BRANCHID = 1 branch is for. Use the numeric BRANCHID otherwise:
--           SELECT BRANCHID, BRANCHNAME FROM ADK2026.BRANCH ORDER BY BRANCHNAME;
--       Note :BNAME is the branch NAME ('ALL' or a real name) and :BRANCHID is
--       the branch NUMBER. They are not interchangeable, and passing the name
--       into :BRANCHID is the single easiest way to produce this error.


-- ─────────────────────────────────────────────────────────────────────────────
--  STEP 2 — A JOIN THAT COMPARES TEXT TO A NUMBER
--
--  Only run this if STEP 1 was clean.
--
--  Several joins in this report pair a column from one table against a
--  differently-typed column in another. When one side is VARCHAR2 and the
--  other is NUMBER, Oracle silently applies TO_NUMBER() to the text side, and
--  any row whose text is not purely numeric raises ORA-01722.
--
--  The reason this can appear on ADK2026 having "always worked" before: whether
--  the conversion happens at all depends on the EXECUTION PLAN. A filter that
--  excludes the non-numeric rows may be applied before the join on one schema
--  and after it on another, purely because the data volumes and statistics
--  differ. Same SQL, different year's schema, different answer.
--
--  The prime suspect is the DN sub-query:
--
--      FROM adk2026.ARAPADJUSTMENTS A
--           JOIN adk2026.LPURCHASEBILLHDR B ON A.SVOUCHER_NUMBER = B.DOCID
--     WHERE RVOUCHER_NUMBER LIKE '%DN%'
--       AND SVOUCHER_NUMBER LIKE '%PB%'
--
--  SVOUCHER_NUMBER is matched with LIKE '%PB%', so it demonstrably holds text
--  such as 'PB/2026/00123'. If LPURCHASEBILLHDR.DOCID is a NUMBER, that join
--  is a text-to-number conversion on every row the filter has not yet removed.
--
--  RUN THIS AS ADK2026 (or after the grants land). It prints the datatype of
--  both sides of every join in the report and flags the mismatches.
-- ─────────────────────────────────────────────────────────────────────────────

SET DEFINE OFF
SET LINESIZE 200
SET PAGESIZE 200

WITH pairs AS (
    SELECT 'POHDR.POHDRID'                  L, 'PODTL.POHDRID'                  R FROM DUAL UNION ALL
    SELECT 'POHDR.CURRENCY',                   'CURRENCY.CURRENCYID'              FROM DUAL UNION ALL
    SELECT 'POHDR.SUPPLIER',                   'VENDOR.VENDORID'                  FROM DUAL UNION ALL
    SELECT 'POHDR.BRANCHID',                   'BRANCH.BRANCHID'                  FROM DUAL UNION ALL
    SELECT 'PODTL.PROJECTCODE',                'PROJECTMASTER.PROJECTMASTERID'    FROM DUAL UNION ALL
    SELECT 'SUPPINVBASIC.SUPPINVBASICID',      'SUPINVPO.SUPPINVBASICID'          FROM DUAL UNION ALL
    SELECT 'SUPPINVBASIC.SUPPLIERNAME',        'VENDOR.VENDORID'                  FROM DUAL UNION ALL
    SELECT 'SUPPINVBASIC.BRANCHNAME',          'BRANCH.BRANCHID'                  FROM DUAL UNION ALL
    SELECT 'SUPINVPO.POHDRID',                 'POHDR.POHDRID'                    FROM DUAL UNION ALL
    SELECT 'LPURCHASEBILLDTL.LPURCHASEBILLHDRID','LPURCHASEBILLHDR.LPURCHASEBILLHDRID' FROM DUAL UNION ALL
    SELECT 'LOCALGRNHDR.DOCID',                'LPURCHASEBILLDTL.GRNO'            FROM DUAL UNION ALL
    SELECT 'LPURCHASEBILLDTL.PROJECTCODE',     'PROJECTMASTER.PROJECTMASTERID'    FROM DUAL UNION ALL
    SELECT 'ARAPPAYDTL.ARAPPAYHDRID',          'ARAPPAYHDR.ARAPPAYHDRID'          FROM DUAL UNION ALL
    SELECT 'ARAPDETAILS.ARAPDETAILSID',        'ARAPPAYDTL.SVOUCHER_NUMBER'       FROM DUAL UNION ALL
    SELECT 'LPURCHASEBILLHDR.DOCID',           'ARAPDETAILS.VOUCHER_NUMBER'       FROM DUAL UNION ALL
    SELECT 'ARAPADJUSTMENTS.SVOUCHER_NUMBER',  'LPURCHASEBILLHDR.DOCID'           FROM DUAL UNION ALL
    SELECT 'ARAPPAYHDR_POADV.PONO',            'POHDR.POHDRID'                    FROM DUAL UNION ALL
    SELECT 'ARAPPAYHDR.BRANCH',                '(bind :BRANCHID)'                 FROM DUAL
),
typed AS (
    SELECT p.L, p.R,
           (SELECT c.DATA_TYPE FROM ALL_TAB_COLUMNS c
             WHERE c.OWNER = 'ADK2026'
               AND c.TABLE_NAME  = SUBSTR (p.L, 1, INSTR (p.L, '.') - 1)
               AND c.COLUMN_NAME = SUBSTR (p.L, INSTR (p.L, '.') + 1)) LT,
           (SELECT c.DATA_TYPE FROM ALL_TAB_COLUMNS c
             WHERE c.OWNER = 'ADK2026'
               AND c.TABLE_NAME  = SUBSTR (p.R, 1, INSTR (p.R, '.') - 1)
               AND c.COLUMN_NAME = SUBSTR (p.R, INSTR (p.R, '.') + 1)) RT
      FROM pairs p
)
SELECT RPAD (L, 40)                || ' '
    || RPAD (NVL (LT, '?'), 10)    || '  =  '
    || RPAD (R, 40)                || ' '
    || RPAD (NVL (RT, '?'), 10)
    || CASE
           WHEN LT IS NULL OR RT IS NULL              THEN '   (no access / column not found)'
           WHEN LT = RT                                THEN ''
           WHEN LT LIKE '%CHAR%' AND RT = 'NUMBER'     THEN '   <<<< TEXT vs NUMBER — CAN RAISE ORA-01722'
           WHEN RT LIKE '%CHAR%' AND LT = 'NUMBER'     THEN '   <<<< TEXT vs NUMBER — CAN RAISE ORA-01722'
           ELSE                                             '   <<<< type mismatch'
       END                                                          AS JOIN_TYPE_CHECK
  FROM typed;


-- ─────────────────────────────────────────────────────────────────────────────
--  STEP 3 — FIND THE OFFENDING ROWS
--
--  Once STEP 2 names a text-vs-number pair, list the values that cannot be
--  converted. Example for the prime suspect — adjust the table and column to
--  whatever STEP 2 flagged:
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT SVOUCHER_NUMBER, RVOUCHER_NUMBER, COUNT (*) AS N
--   FROM ADK2026.ARAPADJUSTMENTS
--  WHERE SVOUCHER_NUMBER LIKE '%PB%'
--    AND NOT REGEXP_LIKE (TRIM (SVOUCHER_NUMBER), '^-?[0-9]+$')   -- not a plain integer
--  GROUP BY SVOUCHER_NUMBER, RVOUCHER_NUMBER
--  ORDER BY N DESC
--  FETCH FIRST 30 ROWS ONLY;


-- ============================================================================
--  WHY I HAVE NOT SIMPLY WRAPPED THE JOINS IN TO_CHAR()
--
--  TO_CHAR (B.DOCID) = A.SVOUCHER_NUMBER  makes the error go away, and it also
--  silently changes which rows match: '00123' and '123' are equal as numbers
--  and different as text. On a payment report that shifts the totals without
--  anything looking wrong.
--
--  The right fix depends on what STEP 2 and STEP 3 actually show:
--    * if the text column always holds a clean integer ->  TO_NUMBER on it
--    * if it holds prefixed references ('PB/2026/001') ->  the join is wrong
--      and needs the real key, not a cast
--    * if it is just the bind                          ->  pass a number
--
--  Send me the output of STEP 2 and I will write the correct fix.
-- ============================================================================
