-- ============================================================================
--  DPR PUNCH SNAPSHOT  —  makes the HOD and employee DPR dashboards fast
--  Run as ADK_TIMESHEET.   Deploy STEP 1–5 first, then PKG_DPR_DASH_PUNCH_SNAPSHOT.sql
-- ----------------------------------------------------------------------------
--  WHY (measured 27-Sep-2026 against the live database, read-only):
--
--    ADRAKLIVE.ALLPUNCHDATA_NEW_01 is a VIEW over two raw punch tables. In its
--    first branch the date is stored as TEXT and converted row by row
--    (TO_DATE(hm.accessdate,'dd/MM/yyyy')), so no date or employee filter can
--    use an index. EVERY read of it costs ~9 s, whatever the filter:
--
--        whole company, today ............ 9.4 s
--        one HOD's team (7 people), today  9.0 s
--        team, last 14 days .............. 9.2 s
--
--    SP_GET_HOD_DASHBOARD reads it 4 times (TREND, TEAM, ATTENDANCE, NOT_DONE),
--    which is the ~40 s the API logs show for every HOD load. The employee
--    dashboard reads it once more (~9 s of every employee load).
--
--  FIX: read the view ONCE every 15 minutes into a small indexed table, and have
--  the dashboards read that table instead. Dashboards then take ~1 s.
--
--  TRADE-OFF: a punch can take up to 15 minutes to appear on the dashboards
--  (punch in/out times, "punched in but no DPR"). Hours, DPRs, approvals and
--  leave do not come from punches and stay live.
--
--  DB LOAD: one ~9 s read of the view every 15 minutes (96 a day) plus one
--  nightly — less than today, where every dashboard open does 1–4 such reads.
--
--  The view itself belongs to ADRAKLIVE and is NOT changed. Other readers of it
--  (PKG_TMST_TASK, PKG_DPR_REMINDER, SP_AUTO_PAUSE_FROM_PUNCH_JOB) are untouched.
--
--  Needs: CREATE TABLE, CREATE PROCEDURE, CREATE JOB for ADK_TIMESHEET, and the
--  SELECT on ADRAKLIVE.ALLPUNCHDATA_NEW_01 that PKG_DPR_DASH already uses.
-- ============================================================================


-- ── STEP 1 — the snapshot table (columns and types copied from the view) ─────
--  Only EMPID, PUNCHDATE and PUNCHTIME: those are the only three columns any
--  PKG_DPR_DASH query reads from the view. Runs once.
CREATE TABLE TM_DPR_PUNCH_SNAPSHOT AS
SELECT EMPID, PUNCHDATE, PUNCHTIME
  FROM ADRAKLIVE.ALLPUNCHDATA_NEW_01
 WHERE 1 = 0;

CREATE INDEX IX_DPR_PUNCH_SNAP_DT_EMP ON TM_DPR_PUNCH_SNAPSHOT (PUNCHDATE, EMPID);


-- ── STEP 2 — the refresh procedure ──────────────────────────────────────────
--  P_DAYS = how many days back to reload. The 15-minute job reloads the last 2
--  days (late-approved mobile punches land on recent days); the nightly job
--  reloads the whole 15-day window the dashboards use (TREND looks back 14).
--
--  LOCK TABLE ... EXCLUSIVE: if the nightly and the 15-minute job ever start at
--  the same moment, the second waits for the first to finish instead of both
--  inserting the same day twice. Dashboards can still READ the table while it
--  is locked — Oracle never blocks queries.
--
--  DELETE + INSERT in ONE transaction: readers keep seeing the previous rows
--  until the COMMIT, so a dashboard never catches the table half-empty.
CREATE OR REPLACE PROCEDURE SP_REFRESH_DPR_PUNCH_SNAPSHOT (P_DAYS IN NUMBER DEFAULT 2) AS
    v_from  DATE := TRUNC(SYSDATE) - GREATEST(NVL(P_DAYS, 2), 1);
    v_keep  DATE := TRUNC(SYSDATE) - 16;
BEGIN
    LOCK TABLE TM_DPR_PUNCH_SNAPSHOT IN EXCLUSIVE MODE;

    DELETE FROM TM_DPR_PUNCH_SNAPSHOT WHERE PUNCHDATE >= v_from;

    INSERT INTO TM_DPR_PUNCH_SNAPSHOT (EMPID, PUNCHDATE, PUNCHTIME)
    SELECT EMPID, PUNCHDATE, PUNCHTIME
      FROM ADRAKLIVE.ALLPUNCHDATA_NEW_01
     WHERE PUNCHDATE >= v_from
       AND PUNCHDATE <  TRUNC(SYSDATE) + 2;   -- +2 covers sites ahead of server time

    DELETE FROM TM_DPR_PUNCH_SNAPSHOT WHERE PUNCHDATE < v_keep;
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;   -- keep the previous snapshot rather than an empty one
        RAISE;
END SP_REFRESH_DPR_PUNCH_SNAPSHOT;
/


-- ── STEP 3 — first load (the whole window, ~10 s) ───────────────────────────
--  STEP 1 leaves the table empty and the 15-minute job only reloads 2 days, so
--  fill all 15 days once now. Safe to re-run any time: it deletes before it
--  inserts, so it never duplicates.
BEGIN
    SP_REFRESH_DPR_PUNCH_SNAPSHOT(15);
END;
/


-- ── STEP 4 — schedule it ────────────────────────────────────────────────────
--  Oracle's scheduler runs these on the DB server; no API or user involved.
--  A job never starts a new run while its previous run is still going.
--  Nightly runs at 02:07 so it never lands on a 15-minute slot (00/15/30/45).
BEGIN
    DBMS_SCHEDULER.CREATE_JOB(
        job_name        => 'JOB_DPR_PUNCH_SNAPSHOT_15MIN',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN SP_REFRESH_DPR_PUNCH_SNAPSHOT(2); END;',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY;INTERVAL=15',
        enabled         => TRUE,
        comments        => 'Recent punches for the DPR dashboards (see DPR_PUNCH_SNAPSHOT.sql)');

    DBMS_SCHEDULER.CREATE_JOB(
        job_name        => 'JOB_DPR_PUNCH_SNAPSHOT_NIGHTLY',
        job_type        => 'PLSQL_BLOCK',
        job_action      => 'BEGIN SP_REFRESH_DPR_PUNCH_SNAPSHOT(15); END;',
        start_date      => SYSTIMESTAMP,
        repeat_interval => 'FREQ=DAILY;BYHOUR=2;BYMINUTE=7',
        enabled         => TRUE,
        comments        => 'Full 15-day reload for the DPR dashboards');
END;
/


-- ── STEP 5 — check before deploying the package ─────────────────────────────
--  Both counts must match (a few punches may differ if someone punched in the
--  seconds between the two counts). If they match, run PKG_DPR_DASH_PUNCH_SNAPSHOT.sql.
SELECT (SELECT COUNT(*) FROM TM_DPR_PUNCH_SNAPSHOT
         WHERE PUNCHDATE >= TRUNC(SYSDATE) AND PUNCHDATE < TRUNC(SYSDATE) + 1) AS SNAPSHOT_TODAY,
       (SELECT COUNT(*) FROM ADRAKLIVE.ALLPUNCHDATA_NEW_01
         WHERE PUNCHDATE >= TRUNC(SYSDATE) AND PUNCHDATE < TRUNC(SYSDATE) + 1) AS VIEW_TODAY
  FROM DUAL;

--  Both jobs should be SCHEDULED with FAILURE_COUNT 0.
SELECT job_name, state, last_start_date, last_run_duration, next_run_date, failure_count
  FROM user_scheduler_jobs WHERE job_name LIKE 'JOB_DPR_PUNCH_SNAPSHOT%';


-- ── LATER: change the interval without redeploying ──────────────────────────
--  BEGIN DBMS_SCHEDULER.SET_ATTRIBUTE('JOB_DPR_PUNCH_SNAPSHOT_15MIN', 'repeat_interval', 'FREQ=MINUTELY;INTERVAL=30'); END;
--  /
--  If a run ever fails, the reason is here:
--  SELECT log_date, status, error#, additional_info FROM user_scheduler_job_run_details
--   WHERE job_name LIKE 'JOB_DPR_PUNCH_SNAPSHOT%' ORDER BY log_date DESC FETCH FIRST 10 ROWS ONLY;


-- ── ROLLBACK (only if needed) ───────────────────────────────────────────────
--  1. Re-deploy PKG_DPR_DASH_BACKUP_20260927.sql  (the package as it is today)
--  2. Then, optionally:
--       BEGIN DBMS_SCHEDULER.DROP_JOB('JOB_DPR_PUNCH_SNAPSHOT_15MIN');   END;
--       BEGIN DBMS_SCHEDULER.DROP_JOB('JOB_DPR_PUNCH_SNAPSHOT_NIGHTLY'); END;
--       DROP PROCEDURE SP_REFRESH_DPR_PUNCH_SNAPSHOT;
--       DROP TABLE TM_DPR_PUNCH_SNAPSHOT;
