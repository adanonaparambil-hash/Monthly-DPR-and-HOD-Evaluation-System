-- ============================================================================
--  SP_GET_NEXT_PENDING_APPROVERS  —  complete procedure, ready to paste into
--  the PKG_EXITFORM body.
--
--  Everything that was there before is unchanged. The only addition is the
--  block marked "PROJECT-DEPARTMENT WATCH NOTIFICATION", placed after the
--  p_app_id block and BEFORE the cursor is opened.
--
--  Why there and not lower down: the existing
--      IF p_next_level IS NULL THEN ... RETURN; END IF;
--  leaves the procedure early once nothing is pending, and an HOD approval on
--  a short chain is exactly that case. Below that line the block would never
--  run for the forms that need it most.
--
--  Prerequisites (from PROJECT_DEPT_LEAVE_NOTIFY.sql):
--    * TM_EXIT_DEPT_NOTIFY   seeded, 27 rows
--    * TS_EXIT_NOTIFY_LOG    created, with the unique (EXIT_ID, NOTIFY_KEY)
--    * TM_EMAILTEMPLATES     row PROJECT_HEAD_LEAVE_NOTIFY
--    * package SPEC already carries the three p_notify_* parameters
-- ============================================================================

    PROCEDURE SP_GET_NEXT_PENDING_APPROVERS(
        p_exit_id              IN  NUMBER,
        p_app_id               IN  NUMBER,
        p_submitted_emp_id     OUT VARCHAR2,
        p_submitted_emp_name   OUT VARCHAR2,
        p_submitted_emp_email  OUT VARCHAR2,
        p_cursor               OUT SYS_REFCURSOR,
        p_success              OUT VARCHAR2,
        p_message              OUT VARCHAR2,
        p_next_level           OUT NUMBER,
        p_submitted_department OUT VARCHAR2,
        p_submitted_date       OUT VARCHAR2,
        p_submitted_leavetype  OUT VARCHAR2,
        p_approved_department  OUT VARCHAR2,
        p_approved_person      OUT VARCHAR2,
        p_apprroved_status     OUT VARCHAR2,
        p_leavetype            OUT VARCHAR2,
        p_ISFinalStage         OUT VARCHAR2,
        p_notify_empid         OUT VARCHAR2,
        p_notify_name          OUT VARCHAR2,
        p_notify_email         OUT VARCHAR2
    )
    IS
        v_created_by   VARCHAR2(200);
        v_act_role     VARCHAR2(50);
        v_act_status   VARCHAR2(10);
        v_act_approver VARCHAR2(50);
        v_watcher      VARCHAR2(50);
    BEGIN

        SELECT e.EMPLOYEE_ID,
               d.EMPLOYEENAME,
               d.DEPARTMENT,
               CASE e.FORM_TYPE
                WHEN 'E'  THEN 'Emergency Leave'
                WHEN 'P'       THEN 'Planned Leave'
                WHEN 'R'        THEN 'Resignation'
                ELSE e.FORM_TYPE
               END AS FORM_TYPE,
               e.CREATED_ON,
               TRIM(e.FORM_TYPE),
               e.CREATED_BY
        INTO   p_submitted_emp_id,
               p_submitted_emp_name,
               p_submitted_department,
               p_submitted_leavetype,
               p_submitted_date,
               p_leavetype,
               v_created_by
        FROM   TS_EMPLOYEE_EXIT e
        JOIN   TM_DPR_EMPLOYEE_DETAILS d
               ON d.EMPID = e.EMPLOYEE_ID
        WHERE  e.EXIT_ID = p_exit_id;



        BEGIN
            SELECT d2.EMAIL
            INTO   p_submitted_emp_email
            FROM   TM_DPR_EMPLOYEE_DETAILS d2
            WHERE  d2.EMPID = v_created_by;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                BEGIN
                    SELECT d3.EMAIL
                    INTO   p_submitted_emp_email
                    FROM   TM_DPR_EMPLOYEE_DETAILS d3
                    WHERE  d3.EMPID = p_submitted_emp_id;
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        p_submitted_emp_email := NULL;
                END;
        END;


        SELECT MIN(APPROVAL_LEVEL)
        INTO p_next_level
        FROM TS_EMP_EXIT_APPROVAL
        WHERE EXIT_ID = p_exit_id
          AND APPROVAL_STATUS = 'R';

        IF p_next_level IS NULL THEN
            SELECT MIN(APPROVAL_LEVEL)
            INTO p_next_level
            FROM TS_EMP_EXIT_APPROVAL
            WHERE EXIT_ID = p_exit_id
              AND APPROVAL_STATUS = 'P';
        END IF;


        BEGIN
            p_ISFinalStage := 'N';
            SELECT 'Y'
            INTO p_ISFinalStage
            FROM TS_EMP_EXIT_APPROVAL
            WHERE EXIT_ID = p_exit_id
              AND APPROVAL_STATUS = 'A'
              AND APPROVER_ROLE = 'ADMIN'
            FETCH FIRST ROW ONLY;

        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                p_ISFinalStage := 'N';
        END;



        IF p_app_id IS NOT NULL THEN
            BEGIN
                SELECT
                    d.EMPLOYEENAME,
                    CASE e.APPROVAL_STATUS
                        WHEN 'P' THEN 'Pending'
                        WHEN 'A' THEN 'Approved'
                        WHEN 'R' THEN 'Rejected'
                        ELSE e.APPROVAL_STATUS
                    END,
                    CASE e.APPROVER_ROLE
                        WHEN 'HANDOVER'  THEN 'Handing Over'
                        WHEN 'HOD'       THEN 'HOD'
                        WHEN 'IT'        THEN 'IT Department'
                        WHEN 'AUDIT'     THEN 'Audit Department'
                        WHEN 'FINANCE'   THEN 'Finance Department'
                        WHEN 'FACILITY'  THEN 'Facility Department'
                        WHEN 'TRANSPORT' THEN 'Transport Department'
                        WHEN 'HR'        THEN 'HR Department'
                        WHEN 'ADMIN'     THEN 'Admin Department'
                        ELSE e.APPROVER_ROLE
                    END
                INTO
                    p_approved_person,
                    p_apprroved_status,
                    p_approved_department
                FROM TS_EMP_EXIT_APPROVAL e
                JOIN TM_DPR_EMPLOYEE_DETAILS d
                    ON d.EMPID = e.APPROVER_ID
                WHERE e.APPROVAL_ID = p_app_id;

            EXCEPTION
                WHEN NO_DATA_FOUND THEN

                    p_approved_person     := NULL;
                    p_apprroved_status    := NULL;
                    p_approved_department := NULL;
            END;
        END IF;


        /* ================================================================
           PROJECT-DEPARTMENT WATCH NOTIFICATION                — NEW BLOCK
           ----------------------------------------------------------------
           One informational e-mail when an employee of a watched (project)
           department has their exit/leave form APPROVED BY THEIR HOD, sent
           to the watcher configured in TM_EXIT_DEPT_NOTIFY — unless the
           watcher IS that HOD, who already knows.

           Worker forms have no HOD step, so they never reach the inner IF.
           That is the agreed "send nothing" case, by construction.

           The whole block has its own handler. Anything that goes wrong in
           here must leave the three OUT params NULL and let the approval
           carry on: a notification is never worth failing an approval over.
           ================================================================ */
        BEGIN
            p_notify_empid := NULL;
            p_notify_name  := NULL;
            p_notify_email := NULL;

            IF p_app_id IS NOT NULL THEN

                -- what was just acted on
                SELECT TRIM(APPROVER_ROLE), TRIM(APPROVAL_STATUS), TRIM(APPROVER_ID)
                  INTO v_act_role, v_act_status, v_act_approver
                  FROM TS_EMP_EXIT_APPROVAL
                 WHERE APPROVAL_ID = p_app_id;

                -- only an HOD APPROVAL fires this
                IF v_act_role = 'HOD' AND v_act_status = 'A' THEN

                    -- Watched department? And is the watcher someone OTHER
                    -- than the HOD who just approved? If the watcher IS that
                    -- HOD no row comes back, NO_DATA_FOUND is raised, and the
                    -- handler below leaves everything NULL.
                    SELECT TRIM(r.NOTIFY_EMPID)
                      INTO v_watcher
                      FROM TM_EXIT_DEPT_NOTIFY r
                     WHERE r.IS_ACTIVE = 'Y'
                       AND TRIM(r.TRIGGER_ROLE) = 'HOD'
                       AND UPPER(TRIM(r.DEPARTMENT)) = UPPER(TRIM(p_submitted_department))
                       AND (r.FORM_TYPES IS NULL
                            OR INSTR(','||UPPER(REPLACE(r.FORM_TYPES,' ',''))||',',
                                     ','||UPPER(TRIM(p_leavetype))||',') > 0)
                       AND TRIM(r.NOTIFY_EMPID) <> v_act_approver
                     FETCH FIRST ROW ONLY;

                    -- address first: no point claiming a send we cannot make
                    SELECT d.EMPLOYEENAME, d.EMAIL
                      INTO p_notify_name, p_notify_email
                      FROM TM_DPR_EMPLOYEE_DETAILS d
                     WHERE d.EMPID = v_watcher;

                    IF p_notify_email IS NULL THEN
                        p_notify_name := NULL;
                    ELSE
                        -- Claim it. The unique key on (EXIT_ID, NOTIFY_KEY) is
                        -- what makes this once-only: a repeated call raises
                        -- DUP_VAL_ON_INDEX and falls into the handler with the
                        -- OUT params cleared, so no second mail goes out.
                        INSERT INTO TS_EXIT_NOTIFY_LOG (EXIT_ID, NOTIFY_KEY, NOTIFY_EMPID)
                        VALUES (p_exit_id, 'PROJECT_HEAD_LEAVE', v_watcher);

                        -- Committed here, not at the end of the procedure: the
                        -- early RETURN further down never reaches that COMMIT,
                        -- and an uncommitted claim would be rolled back when
                        -- the caller closes the connection — letting a retry
                        -- send a second mail.
                        COMMIT;

                        p_notify_empid := v_watcher;
                    END IF;

                END IF;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN        -- incl. NO_DATA_FOUND and DUP_VAL_ON_INDEX
                p_notify_empid := NULL;
                p_notify_name  := NULL;
                p_notify_email := NULL;
        END;
        /* ============ end of the new block ============================= */



        IF p_ISFinalStage = 'N' THEN
            OPEN p_cursor FOR
                SELECT e.APPROVAL_LEVEL AS ApprovalLevel,
                       e.APPROVER_ID AS ApproverId,
                       d.EMPLOYEENAME AS ApproverName,
                       d.EMAIL AS ApproverEmail,
                       e.APPROVAL_STATUS AS ApprovalStatus,
                       e.APPROVAL_ID AS ApprovalID,
                       e.ISHEAD AS IsHead
                FROM   TS_EMP_EXIT_APPROVAL e
                JOIN   TM_DPR_EMPLOYEE_DETAILS d
                       ON d.EMPID = e.APPROVER_ID
                WHERE  e.EXIT_ID = p_exit_id
                  AND  e.APPROVAL_LEVEL = p_next_level
                  AND  e.APPROVAL_STATUS = 'P'
                  AND  e.MAILSEND = 'N'
                  AND  (
                        (e.APPROVER_ROLE NOT IN ('IT', 'FINANCE', 'TRANSPORT') AND TRIM(e.ISHEAD) = 'Y')
                        OR e.APPROVER_ROLE IN ('IT', 'FINANCE', 'TRANSPORT')
                       )
                ORDER BY e.APPROVER_ID;
        ELSE
            OPEN p_cursor FOR
                SELECT 0 AS ApprovalLevel,
                       '' AS ApproverId,
                       '' AS ApprovalStatus,
                       0 AS ApprovalID,
                       dp.IS_HEAD AS IsHead,
                       d.EMPLOYEENAME AS ApproverName,
                       d.EMAIL AS ApproverEmail
                FROM   TM_EMP_EXIT_DEPARTMENT_PERSONS dp
                JOIN   TM_DPR_EMPLOYEE_DETAILS d
                       ON d.EMPID = dp.EMPLOYEE_ID
                WHERE  dp.IS_ACTIVE = 'Y' AND dp.FORM_TYPE = 'E'
                  AND  dp.IS_HEAD = 'Y' AND TRIM(dp.ROLE_CODE) = 'PASSPORT'
                ORDER BY dp.DEPT_PERSON_ID;
        END IF;


        IF p_next_level IS NULL THEN
            p_success := 'Y';
            p_message := 'No pending approval levels found.';
            RETURN;
        END IF;



        UPDATE TS_EMP_EXIT_APPROVAL
        SET    MAILSEND = 'Y'
        WHERE  EXIT_ID = p_exit_id
        AND    APPROVAL_LEVEL = p_next_level
        AND    APPROVAL_STATUS = 'P';

        COMMIT;

        p_success := 'Y';
        p_message := 'Next pending approver(s) and submitted employee retrieved successfully.';

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_cursor  := NULL;
            p_success := 'N';
            p_message := 'Invalid EXIT_ID or no data found.';
        WHEN OTHERS THEN
            p_cursor  := NULL;
            p_success := 'N';
            p_message := SQLERRM;
    END SP_GET_NEXT_PENDING_APPROVERS;
