-- ============================================================================
--  FINANCE MENU — two corrections to the rows you inserted, plus the access
--  rows that actually make the menu appear.
--
--  Column order confirmed against TM_MENU_MASTER:
--      1 MENU_ID   2 MENU_NAME  3 MENU_URL     4 PARENT_ID  5 MENU_ORDER
--      6 ICON      7 IS_ACTIVE  8 CREATED_BY   9 CREATED_DATE
--     10 UPDATED_BY 11 UPDATED_DATE           12 IS_EXTERNAL
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  FIX 1 — IS_EXTERNAL must be 'N' on 122 and 123
--
--  Your rows have 'Y' in the IS_EXTERNAL column. That flag is what the sidebar
--  uses to decide HOW to open a menu, and 'Y' is wrong for these two:
--
--      handleMenuClick():
--          isExternal === 'Y'  ->  openExternalMenu()  : asks the backend for
--                                  an AES-tokenised URL and opens it as an
--                                  outside site
--          isExternal === 'N'  ->  router.navigate()   : an Angular route
--
--  /supplier-payment-forecast and /supplier-overdue-aging are Angular routes
--  INSIDE this app, so with 'Y' they will not open — the click goes off to the
--  external-link handler instead of the page.
--
--  The convention is visible in the rows that already work:
--      app-purchase-dashboard          -> IS_EXTERNAL = 'N'   (internal page)
--      http://172.16.1.53:8765/        -> IS_EXTERNAL = 'Y'   (outside site)
--
--  IS_EXTERNAL is CHAR(2), so it stores blank-padded ('N '). The procedure
--  TRIMs it on the way out, so 'N' is fine to write.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE TM_MENU_MASTER
   SET IS_EXTERNAL = 'N'
 WHERE MENU_ID IN (122, 123);

COMMIT;

-- expect both to read N
-- SELECT MENU_ID, MENU_NAME, MENU_URL, TRIM(IS_EXTERNAL) AS IS_EXTERNAL
--   FROM TM_MENU_MASTER WHERE MENU_ID IN (121, 122, 123) ORDER BY MENU_ID;


-- ─────────────────────────────────────────────────────────────────────────────
--  FIX 2 — grant the PARENT (121) as well, not just the two children
--
--  This is the one that catches people out. SP_GET_USER_MENUS is:
--
--      FROM TM_MENU_MASTER M
--      INNER JOIN TS_USER_MENU_ACCESS A
--              ON M.MENU_ID = A.MENU_ID AND A.USER_ID = P_USER_ID
--      WHERE M.IS_ACTIVE = 'Y'
--      START WITH M.PARENT_ID IS NULL
--      CONNECT BY PRIOR M.MENU_ID = M.PARENT_ID
--
--  The access join happens FIRST, and the walk can only START at a row whose
--  PARENT_ID is NULL. 122 and 123 both hang off 121, so they are reachable
--  only THROUGH 121. Grant only the two children and the user gets nothing at
--  all — not even a stray child — because the walk never has a root to start
--  from.
--
--  So every user needs THREE rows: 121, 122 and 123.
--
--  USER_ID is the employee code, as stored on the existing rows
--  (ITS41, ITS48, AIS557, ADS4874 ...).
-- ─────────────────────────────────────────────────────────────────────────────

-- Put the employee codes here, one per line. Re-runnable: rows that already
-- exist are skipped rather than duplicated.
INSERT INTO TS_USER_MENU_ACCESS
       (USER_ID, MENU_ID, CAN_VIEW, CAN_ADD, CAN_EDIT, CAN_DELETE, CREATED_BY, CREATED_DATE)
SELECT u.uid, m.mid, 'Y', 'N', 'N', 'N', 'SYSTEM', SYSDATE
  FROM (SELECT COLUMN_VALUE AS uid
          FROM TABLE (SYS.ODCIVARCHAR2LIST (
                'ITS48'            -- <<< add the finance / management codes here
                ))) u
 CROSS JOIN (SELECT COLUMN_VALUE AS mid
               FROM TABLE (SYS.ODCINUMBERLIST (121, 122, 123))) m
 WHERE NOT EXISTS (SELECT 1
                     FROM TS_USER_MENU_ACCESS a
                    WHERE a.USER_ID = u.uid
                      AND a.MENU_ID = m.mid);

COMMIT;

-- who can see it now — expect 3 rows per person
-- SELECT a.USER_ID, a.MENU_ID, m.MENU_NAME, a.CAN_VIEW
--   FROM TS_USER_MENU_ACCESS a
--   JOIN TM_MENU_MASTER m ON m.MENU_ID = a.MENU_ID
--  WHERE a.MENU_ID IN (121, 122, 123)
--  ORDER BY a.USER_ID, a.MENU_ID;


-- ─────────────────────────────────────────────────────────────────────────────
--  TO REMOVE SOMEONE'S ACCESS
--      DELETE FROM TS_USER_MENU_ACCESS
--       WHERE USER_ID = 'XXX' AND MENU_ID IN (121, 122, 123);
--      COMMIT;
--
--  TO HIDE THE WHOLE MENU FROM EVERYONE, without touching access rows:
--      UPDATE TM_MENU_MASTER SET IS_ACTIVE = 'N' WHERE MENU_ID IN (121, 122, 123);
--      COMMIT;
--  (the procedure filters on M.IS_ACTIVE = 'Y')
-- ============================================================================
