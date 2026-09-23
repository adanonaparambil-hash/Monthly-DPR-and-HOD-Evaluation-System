-- ============================================================================
--  GRANT READ ACCESS ON THE ADK2026 REPORT TABLES
--  ---------------------------------------------------------------------------
--  Fixes ORA-00942 on the two Axpert supplier payment reports.
--
--  WHO RUNS THIS
--      PART 1 must be run while CONNECTED AS ADK2026 (the table owner), or as
--      a DBA. It CANNOT be run from the reporting schema: in Oracle only the
--      owner of an object, or a user holding GRANT ANY OBJECT PRIVILEGE, can
--      hand out access to it. Running it as ADK_TIMESHEET fails with
--      ORA-01031 (insufficient privileges), not with a clearer message.
--
--  WHAT IT GRANTS
--      SELECT only, on the 16 tables the two reports read. Nothing else —
--      the reports never insert, update or delete, so nothing else is needed.
--      Verified against the database: ADK2026 exists on 172.16.1.86/orcl and
--      ADK_TIMESHEET currently has 0 of the 16.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  Which schema is asking? Run this in the window where the report failed.
--  If it does NOT print ADK_TIMESHEET, change the DEFINE below to match.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT USER FROM DUAL;


-- ─────────────────────────────────────────────────────────────────────────────
--  PART 1 — RUN AS  ADK2026
-- ─────────────────────────────────────────────────────────────────────────────

DEFINE report_user = ADK_TIMESHEET

GRANT SELECT ON ADK2026.POHDR             TO &report_user;
GRANT SELECT ON ADK2026.PODTL             TO &report_user;
GRANT SELECT ON ADK2026.CURRENCY          TO &report_user;
GRANT SELECT ON ADK2026.VENDOR            TO &report_user;
GRANT SELECT ON ADK2026.BRANCH            TO &report_user;
GRANT SELECT ON ADK2026.PROJECTMASTER     TO &report_user;
GRANT SELECT ON ADK2026.SUPPINVBASIC      TO &report_user;
GRANT SELECT ON ADK2026.SUPINVPO          TO &report_user;
GRANT SELECT ON ADK2026.LPURCHASEBILLHDR  TO &report_user;
GRANT SELECT ON ADK2026.LPURCHASEBILLDTL  TO &report_user;
GRANT SELECT ON ADK2026.LOCALGRNHDR       TO &report_user;
GRANT SELECT ON ADK2026.ARAPPAYHDR        TO &report_user;
GRANT SELECT ON ADK2026.ARAPPAYDTL        TO &report_user;
GRANT SELECT ON ADK2026.ARAPDETAILS       TO &report_user;
GRANT SELECT ON ADK2026.ARAPADJUSTMENTS   TO &report_user;
GRANT SELECT ON ADK2026.ARAPPAYHDR_POADV  TO &report_user;


-- ─────────────────────────────────────────────────────────────────────────────
--  PART 2 — VERIFY. Run this AS THE REPORT USER (ADK_TIMESHEET).
--  Every row must say visible=1. Any 0 is a grant that did not land.
-- ─────────────────────────────────────────────────────────────────────────────

SET DEFINE OFF
SELECT RPAD (t.nm, 26) || ' visible=' ||
       (SELECT COUNT (*)
          FROM ALL_TABLES a
         WHERE a.OWNER = 'ADK2026' AND a.TABLE_NAME = t.nm)    AS CHECK_RESULT
  FROM (SELECT COLUMN_VALUE nm
          FROM TABLE (SYS.ODCIVARCHAR2LIST (
                'POHDR', 'PODTL', 'CURRENCY', 'VENDOR', 'BRANCH',
                'PROJECTMASTER', 'SUPPINVBASIC', 'SUPINVPO',
                'LPURCHASEBILLDTL', 'LPURCHASEBILLHDR', 'LOCALGRNHDR',
                'ARAPPAYHDR', 'ARAPPAYDTL', 'ARAPDETAILS',
                'ARAPADJUSTMENTS', 'ARAPPAYHDR_POADV'))) t
 ORDER BY 1;


-- ============================================================================
--  NOTES
--
--  1) OPTIONAL — private synonyms.
--     Only needed if you later want to drop the adk2026. prefix from the
--     reports. With the prefix in place they are unnecessary. Run AS THE
--     REPORT USER, after the grants:
--
--         CREATE OR REPLACE SYNONYM POHDR FOR ADK2026.POHDR;
--         ... one per table ...
--
--     Careful: a synonym that shadows a table of the same name in your own
--     schema silently redirects every existing query that uses that name.
--     Check first with
--         SELECT TABLE_NAME FROM USER_TABLES
--          WHERE TABLE_NAME IN ('POHDR','PODTL','CURRENCY','VENDOR','BRANCH', ...);
--
--  2) IF MORE REPORTS FOLLOW, a role is easier to live with than 16 grants
--     repeated per user. Run the first two AS A DBA, the third AS ADK2026:
--
--         CREATE ROLE ADK2026_REPORT_READ;
--         GRANT ADK2026_REPORT_READ TO ADK_TIMESHEET;
--         -- as ADK2026, for each table:
--         GRANT SELECT ON ADK2026.POHDR TO ADK2026_REPORT_READ;
--
--     One caveat that catches people out: privileges received through a ROLE
--     are NOT visible inside a PL/SQL package, procedure or view compiled with
--     definer's rights. If these reports are ever wrapped in a package or a
--     view, the grants must be made DIRECTLY to the user as in PART 1, not
--     through a role.
--
--  3) DO NOT use GRANT SELECT ANY TABLE. It would work, and it would also
--     hand the reporting user read access to every table in the database.
-- ============================================================================
