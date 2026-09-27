-- ============================================================================
--  GRANTS NEEDED BEFORE THE MIR MODULE CAN BE BUILT
--  ---------------------------------------------------------------------------
--  RUN THIS AS ADK2026 (or as a DBA), NOT as ADK_TIMESHEET.
--
--  Why this is a hard blocker
--  --------------------------
--  PKG_QAQC compiles with DEFINER'S RIGHTS. Oracle resolves every table at
--  COMPILE time, and for that the privilege must be granted DIRECTLY to
--  ADK_TIMESHEET - a role is NOT enough inside a package. Without these grants
--  the package will not compile at all: every adk2026.<TABLE> reference fails
--  with PLS-00201 / ORA-00942.
--
--  Checked against the live database just now. WIR already works because
--  ADK2026.INSPREQHDR is granted; the three MIR tables are not:
--
--      INSPREQHDR     GRANTED      <- this is why WIR works today
--      MATINSPREQHDR  NOT GRANTED  <- the MIR header table
--      NCRISSUEDHDR   NOT GRANTED  <- "against NCR" lookup on the MIR form
--      QSMIRATTACH    NOT GRANTED  <- MIR PDF attachments (legacy DBXQuery5)
--
--  Everything else the MIR report needs is ALREADY granted and needs nothing
--  here - PROJECTMASTER, BRANCH, EMPMAST, SIGNATUREHDR, SIGNMIMG1,
--  BRANCOMPLOGO, PROJCONSULTANTLOGO, PROJCLIENTLOGO.
--
--  SELECT only. The portal never writes to the Axpert schema; it reads the MIR
--  that Axpert already created and renders it.
-- ============================================================================

GRANT SELECT ON ADK2026.MATINSPREQHDR TO ADK_TIMESHEET;
GRANT SELECT ON ADK2026.NCRISSUEDHDR  TO ADK_TIMESHEET;
GRANT SELECT ON ADK2026.QSMIRATTACH   TO ADK_TIMESHEET;


-- ---------------------------------------------------------------------------
--  Verification - run this as ADK_TIMESHEET afterwards.
--  All four must come back GRANTED before PKG_QAQC will compile.
-- ---------------------------------------------------------------------------
--  SELECT t.tab,
--         CASE WHEN EXISTS (SELECT 1 FROM all_tables a
--                            WHERE a.owner = 'ADK2026' AND a.table_name = t.tab)
--              THEN 'GRANTED' ELSE 'NOT GRANTED' END AS status
--    FROM (SELECT 'MATINSPREQHDR' tab FROM dual
--          UNION ALL SELECT 'NCRISSUEDHDR' FROM dual
--          UNION ALL SELECT 'QSMIRATTACH'  FROM dual
--          UNION ALL SELECT 'INSPREQHDR'   FROM dual) t
--   ORDER BY 1;
