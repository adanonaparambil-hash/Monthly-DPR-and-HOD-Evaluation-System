-- ============================================================================
--  MIR REPORT - MENU ENTRY AND ACCESS
--  ---------------------------------------------------------------------------
--  Adds "MIR Report" under the existing QAQC menu (124), beside WIR Report
--  (125), and grants it to exactly the people who can already see WIR.
--
--  Run as ADK_TIMESHEET (the portal's own schema - TM_MENU_MASTER and
--  TS_USER_MENU_ACCESS live here, not in ADK2026).
--
--  WHY ACCESS IS COPIED FROM WIR RATHER THAN GRANTED TO EVERYONE
--  -------------------------------------------------------------
--  MirReportGuard checks the user's menu list for a '/mir-reports' entry
--  before letting the route load, so without a row here the page is
--  unreachable no matter what is deployed. Copying WIR's audience keeps the
--  same QA/QC people in and everyone else out - granting it broadly would
--  quietly widen who can read inspection records.
--
--  Safe to re-run: both statements skip what already exists.
-- ============================================================================

-- ── 1. The menu item itself ────────────────────────────────────────────────
--  MENU_ORDER 20 puts MIR after WIR (10) inside QAQC.
INSERT INTO TM_MENU_MASTER (MENU_ID, MENU_NAME, MENU_URL, PARENT_ID, MENU_ORDER)
SELECT 126, 'MIR Report', '/mir-reports', 124, 20
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM TM_MENU_MASTER WHERE MENU_ID = 126);

-- ── 2. Give it to everyone who already has WIR ─────────────────────────────
INSERT INTO TS_USER_MENU_ACCESS (ACCESS_ID, USER_ID, MENU_ID, CAN_VIEW, CAN_ADD, CAN_EDIT, CAN_DELETE, CREATED_BY)
SELECT (SELECT NVL(MAX(ACCESS_ID), 0) FROM TS_USER_MENU_ACCESS) + ROWNUM,
       W.USER_ID,
       126,
       W.CAN_VIEW,
       W.CAN_ADD,
       W.CAN_EDIT,
       W.CAN_DELETE,
       'MIR_ROLLOUT'
  FROM TS_USER_MENU_ACCESS W
 WHERE W.MENU_ID = 125
   AND NOT EXISTS (SELECT 1
                     FROM TS_USER_MENU_ACCESS X
                    WHERE X.MENU_ID = 126
                      AND X.USER_ID = W.USER_ID);

COMMIT;


-- ---------------------------------------------------------------------------
--  Checks
-- ---------------------------------------------------------------------------
SET PAGESIZE 60
SET LINESIZE 150
COLUMN menu_name FORMAT A22
COLUMN menu_url  FORMAT A24

PROMPT ===== QAQC menu branch =====
SELECT MENU_ID, MENU_NAME, MENU_URL, PARENT_ID, MENU_ORDER
  FROM TM_MENU_MASTER
 WHERE MENU_ID = 124 OR PARENT_ID = 124
 ORDER BY PARENT_ID NULLS FIRST, MENU_ORDER;

PROMPT ===== audience: WIR vs MIR (these two numbers must match) =====
SELECT 'WIR (125) users = ' || COUNT(*) FROM TS_USER_MENU_ACCESS WHERE MENU_ID = 125;
SELECT 'MIR (126) users = ' || COUNT(*) FROM TS_USER_MENU_ACCESS WHERE MENU_ID = 126;
