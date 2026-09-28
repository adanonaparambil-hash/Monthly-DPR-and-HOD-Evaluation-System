-- ============================================================================
--  SP_GET_HOD_LEAVE_STATUS  —  who in a HOD's team is on leave, and when they
--  are due back.   Run as ADK_TIMESHEET.   Independent of the snapshot scripts.
-- ----------------------------------------------------------------------------
--  WHY: the HOD dashboard's "on leave" count only asked the HR leave function,
--  which answered 0 for people whose employee master already says Leave
--  (found 27-Sep-2026: ITS8 and ITS16 — approved Planned Leave from 12/14 Aug,
--  due back 11/12 Sep, no rejoining form, still marked Leave). This procedure
--  joins the three places leave actually lives:
--
--     TM_DPR_EMPLOYEE_DETAILS.CURRENTSTATUS = 'Leave'      — the master flag
--     TS_EMPLOYEE_EXIT (FORM_TYPE E/P, APPROVAL_STATUS A)  — the approved leave form:
--                                                            departure, planned return
--     TS_EMPLOYEE_REJOINING                                — extension / actual return
--
--  One row per team member who is on leave, overdue to return, or rejoined in
--  the last 7 days. Read-only; creates one standalone procedure.
--
--  LeaveStatus values the dashboard understands:
--     ON_LEAVE   away, due back on DueBack (or DueBack unknown)
--     DUE_TODAY  due back today
--     OVERDUE    DueBack has passed and no rejoining form marks them back
--     REJOINED   back within the last 7 days (shown for context)
-- ============================================================================
CREATE OR REPLACE PROCEDURE SP_GET_HOD_LEAVE_STATUS (
    P_HODID       IN  VARCHAR2,
    P_DEPARTMENT  IN  VARCHAR2 DEFAULT NULL,
    P_CURSOR      OUT SYS_REFCURSOR,
    P_SUCCESS     OUT VARCHAR2,
    P_MESSAGE     OUT VARCHAR2
) AS
    v_today DATE := TRUNC(SYSDATE);
BEGIN
    OPEN P_CURSOR FOR
        WITH TEAM AS (
            -- same membership rule as PKG_DPR_DASH.SP_GET_HOD_DASHBOARD
            SELECT e.EMPID, e.EMPLOYEENAME, e.DESIGNATION, TRIM(UPPER(e.CURRENTSTATUS)) AS CURRENTSTATUS
              FROM TM_DPR_EMPLOYEE_DETAILS e
             WHERE TRIM(UPPER(e.CURRENTSTATUS)) IN ('ACTIVE', 'LEAVE')
               AND TRIM(UPPER(NVL(e.IS_DPR, 'N'))) = 'Y'
               AND e.EMPLOYEENAME IS NOT NULL
               AND e.EMPID <> P_HODID
               AND EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER h
                            WHERE h.EMP_ID = P_HODID AND h.IS_ACTIVE = 'Y'
                              AND TRIM(UPPER(h.DEPARTMENT)) = TRIM(UPPER(e.DEPARTMENT)))
               AND NOT EXISTS (SELECT 1 FROM TM_DPR_HOD_MASTER x
                                WHERE x.EMP_ID = e.EMPID AND x.IS_ACTIVE = 'Y')
               AND (P_DEPARTMENT IS NULL OR TRIM(UPPER(e.DEPARTMENT)) = TRIM(UPPER(P_DEPARTMENT)))
        ),
        FORM AS (
            -- latest APPROVED leave form (E / P — resignations are not leave) that has started
            SELECT x.EMPLOYEE_ID, x.EXIT_ID, TRIM(x.FORM_TYPE) AS FORM_TYPE,
                   x.DATE_OF_DEPARTURE, x.DATE_ARRIVAL, x.NO_OF_DAYS_APPROVED, x.REASON_FOR_PLANNED_LEAVE,
                   ROW_NUMBER() OVER (PARTITION BY x.EMPLOYEE_ID
                                          ORDER BY x.DATE_OF_DEPARTURE DESC, x.EXIT_ID DESC) AS RN
              FROM TS_EMPLOYEE_EXIT x
             WHERE TRIM(x.APPROVAL_STATUS) = 'A'
               AND TRIM(x.FORM_TYPE) IN ('E', 'P')
               AND x.DATE_OF_DEPARTURE <= v_today
               AND x.DATE_OF_DEPARTURE >= v_today - 365
               AND x.EMPLOYEE_ID IN (SELECT EMPID FROM TEAM)
        ),
        J AS (
            SELECT t.EMPID, t.EMPLOYEENAME, t.DESIGNATION, t.CURRENTSTATUS,
                   f.EXIT_ID, f.FORM_TYPE, f.DATE_OF_DEPARTURE, f.DATE_ARRIVAL,
                   f.NO_OF_DAYS_APPROVED, f.REASON_FOR_PLANNED_LEAVE,
                   r.LEAVETYPE, r.APPROVED_LEAVE_ARRIVAL_DATE, r.EXTENSION_DATE, r.RJ_STATUS,
                   r.JOINING_DATE, r.ARRIVED_ON
              FROM TEAM t
              LEFT JOIN FORM f ON f.EMPLOYEE_ID = t.EMPID AND f.RN = 1
              -- the rejoining form for THIS leave: filed for a departure on or after the form's
              OUTER APPLY (SELECT rr.LEAVETYPE, rr.APPROVED_LEAVE_ARRIVAL_DATE, rr.EXTENSION_DATE,
                                  TRIM(rr.STATUS) AS RJ_STATUS, rr.JOINING_DATE, CAST(rr.ARRIVED_ON AS DATE) AS ARRIVED_ON
                             FROM TS_EMPLOYEE_REJOINING rr
                            WHERE rr.EMPLOYEE_ID = t.EMPID
                              AND (f.DATE_OF_DEPARTURE IS NULL
                                   OR rr.DATEOF_DEPARTURE >= f.DATE_OF_DEPARTURE - 3)
                            ORDER BY rr.CREATED_ON DESC, rr.REJOIN_ID DESC
                            FETCH FIRST 1 ROW ONLY) r
        ),
        C AS (
            SELECT j.*,
                   NVL(j.EXTENSION_DATE, NVL(j.APPROVED_LEAVE_ARRIVAL_DATE, j.DATE_ARRIVAL))  AS DUE_BACK,
                   CASE WHEN j.RJ_STATUS = 'A' THEN NVL(j.JOINING_DATE, j.ARRIVED_ON) END        AS REJOINED_ON
              FROM J j
        )
        SELECT c.EMPID                                                   AS EmpId,
               c.EMPLOYEENAME                                            AS EmployeeName,
               c.DESIGNATION                                             AS Designation,
               c.CURRENTSTATUS                                           AS CurrentStatus,
               NVL(c.LEAVETYPE,
                   CASE c.FORM_TYPE WHEN 'E' THEN 'Emergency Leave'
                                    WHEN 'P' THEN 'Planned Leave' END)   AS LeaveType,
               c.REASON_FOR_PLANNED_LEAVE                                AS Reason,
               TO_CHAR(c.DATE_OF_DEPARTURE, 'YYYY-MM-DD')                AS DepartedOn,
               TO_CHAR(c.DATE_ARRIVAL, 'YYYY-MM-DD')                     AS PlannedReturn,
               TO_CHAR(c.EXTENSION_DATE, 'YYYY-MM-DD')                   AS ExtendedTo,
               TO_CHAR(c.DUE_BACK, 'YYYY-MM-DD')                         AS DueBack,
               TO_CHAR(c.REJOINED_ON, 'YYYY-MM-DD')                      AS RejoinedOn,
               c.NO_OF_DAYS_APPROVED                                     AS DaysApproved,
               CASE WHEN c.REJOINED_ON IS NULL AND c.DUE_BACK < v_today
                    THEN v_today - c.DUE_BACK ELSE 0 END                 AS OverdueDays,
               CASE WHEN c.REJOINED_ON IS NULL AND c.DUE_BACK >= v_today
                    THEN c.DUE_BACK - v_today END                        AS DaysUntilBack,
               CASE WHEN c.REJOINED_ON IS NOT NULL AND c.REJOINED_ON <= v_today THEN 'REJOINED'
                    WHEN c.DUE_BACK IS NULL                                 THEN 'ON_LEAVE'
                    WHEN c.DUE_BACK <  v_today                              THEN 'OVERDUE'
                    WHEN c.DUE_BACK =  v_today                              THEN 'DUE_TODAY'
                    ELSE 'ON_LEAVE' END                                  AS LeaveStatus
          FROM C c
         WHERE c.CURRENTSTATUS = 'LEAVE'
            OR (c.DATE_OF_DEPARTURE IS NOT NULL
                AND (c.REJOINED_ON IS NULL OR c.REJOINED_ON > v_today)
                AND NVL(c.DUE_BACK, v_today) >= v_today - 60)          -- overdue kept for 60 days
            OR (c.REJOINED_ON IS NOT NULL AND c.REJOINED_ON >= v_today - 7)
         ORDER BY CASE WHEN c.REJOINED_ON IS NOT NULL AND c.REJOINED_ON <= v_today THEN 3
                       WHEN c.DUE_BACK < v_today THEN 0
                       WHEN c.DUE_BACK = v_today THEN 1 ELSE 2 END,
                  c.DUE_BACK, c.EMPLOYEENAME;

    P_SUCCESS := 'Y';
    P_MESSAGE := 'OK';
EXCEPTION
    WHEN OTHERS THEN
        P_SUCCESS := 'N';
        P_MESSAGE := 'Error fetching leave status: ' || SQLERRM;
        OPEN P_CURSOR FOR SELECT NULL AS Dummy FROM DUAL WHERE 1 = 0;
END SP_GET_HOD_LEAVE_STATUS;
/

-- ── check ───────────────────────────────────────────────────────────────────
--  For ITS41 this should list ITS8 and ITS16 as OVERDUE (due back 11 / 12 Sep).
VAR c REFCURSOR
VAR s VARCHAR2(10)
VAR m VARCHAR2(4000)
EXEC SP_GET_HOD_LEAVE_STATUS('ITS41', NULL, :c, :s, :m);
PRINT s
PRINT m
PRINT c
