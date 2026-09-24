-- ============================================================================
--  FIN_SNAPSHOT_JOB  -  keeps the supplier report figures current
--  ---------------------------------------------------------------------------
--  Runs PKG_FIN_SUPPLIER_REPORTS.SP_REFRESH_SNAPSHOT every 4 HOURS.
--
--  The refresh takes ~18 s. That is the work the two supplier reports used to
--  do on EVERY click, which is what pushed them past the API's 100 s timeout.
--  Doing it here instead is the whole point: the reports then read the result
--  in about 0.3 s.
--
--  Four hours means the figures can be up to four hours behind. That is a
--  deliberate choice, not an oversight - whoever is looking at this report to
--  decide what to pay today needs to know that a bill entered this morning may
--  not be in it yet. The screen shows the timestamp, and Refresh Now rebuilds
--  on demand when someone needs the current position.
--
--  Failure is recorded, not swallowed. SP_REFRESH_SNAPSHOT writes its outcome
--  to FIN_SNAP_META from an autonomous transaction, so a failed run leaves
--  STATUS='FAILED' behind even though its own DML rolled back. The screen
--  reads that and can say the figures are stale instead of showing the
--  previous numbers as though nothing had happened.
-- ============================================================================

BEGIN
    -- Drop first so this script can be re-run safely. FORCE => TRUE so a
    -- currently-executing run does not block the rebuild.
    BEGIN
        DBMS_SCHEDULER.DROP_JOB (job_name => 'JOB_FIN_SNAPSHOT_REFRESH', force => TRUE);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE != -27475 THEN   -- ORA-27475: "unknown job", i.e. first install
                RAISE;
            END IF;
    END;

    DBMS_SCHEDULER.CREATE_JOB (
        job_name        => 'JOB_FIN_SNAPSHOT_REFRESH',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'DECLARE'
                        || '  L_SUCCESS CHAR(1);'
                        || '  L_MESSAGE VARCHAR2(4000);'
                        || 'BEGIN'
                        || '  PKG_FIN_SUPPLIER_REPORTS.SP_REFRESH_SNAPSHOT (L_SUCCESS, L_MESSAGE);'
                        || 'END;',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=HOURLY;INTERVAL=4',
        enabled         => TRUE,
        comments        => 'Rebuilds FIN_SNAP_PO / FIN_SNAP_POADV for the supplier payment reports.'
    );
END;
/

-- Kick one off immediately so the tables are populated the moment this is
-- installed, rather than the reports showing nothing for up to four hours.
BEGIN
    DBMS_SCHEDULER.RUN_JOB (job_name => 'JOB_FIN_SNAPSHOT_REFRESH', use_current_session => FALSE);
END;
/

-- ---------------------------------------------------------------------------
--  Checks
-- ---------------------------------------------------------------------------
SET PAGESIZE 100
SET LINESIZE 160
COLUMN job_name        FORMAT A28
COLUMN state           FORMAT A12
COLUMN repeat_interval FORMAT A28
COLUMN next_run        FORMAT A20

PROMPT ===== JOB =====
SELECT job_name,
       state,
       repeat_interval,
       TO_CHAR (next_run_date, 'YYYY-MM-DD HH24:MI:SS') AS next_run
  FROM user_scheduler_jobs
 WHERE job_name = 'JOB_FIN_SNAPSHOT_REFRESH';

PROMPT ===== LAST RUNS =====
SELECT TO_CHAR (log_date, 'YYYY-MM-DD HH24:MI:SS') AS run_at,
       status,
       additional_info
  FROM user_scheduler_job_run_details
 WHERE job_name = 'JOB_FIN_SNAPSHOT_REFRESH'
 ORDER BY log_date DESC
 FETCH FIRST 5 ROWS ONLY;

PROMPT ===== SNAPSHOT STATE =====
SELECT snap_name,
       TO_CHAR (refreshed_at, 'YYYY-MM-DD HH24:MI:SS') AS refreshed_at,
       duration_sec,
       row_count,
       status
  FROM FIN_SNAP_META;
