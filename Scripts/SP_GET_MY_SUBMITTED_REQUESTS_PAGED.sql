-- ============================================================================
--  SP_GET_MY_SUBMITTED_REQUESTS_ALL  —  "My Submitted Requests" listing
--  ---------------------------------------------------------------------------
--  TWO changes, nothing else:
--
--  1) CREATOR instead of SUBJECT.
--     Was:  WHERE EMPLOYEE_ID = P_EMPLOYEE_ID          (forms ABOUT me)
--     Now:  WHERE NVL(CREATED_BY, EMPLOYEE_ID) = P_EMPLOYEE_ID   (forms I FILED)
--
--     The NVL fallback is not optional. CREATED_BY was added later, so old
--     rows still have it NULL (in UAT: 3 of 28 exit rows are populated). A
--     plain CREATED_BY = P_EMPLOYEE_ID would make every legacy record vanish
--     from the user's list. NULL means "filed before the column existed", and
--     back then a form could only be filed by its own subject — so falling
--     back to EMPLOYEE_ID reproduces exactly what those rows used to show.
--
--     Consequence, by design: a form somebody ELSE filed on your behalf now
--     appears in THEIR list, not yours.
--
--  2) PAGINATION. P_PAGE_NO / P_PAGE_SIZE in, P_TOTAL_COUNT out. Defaults are
--     page 1 and 500 rows, so the first call fetches 500 and "next page"
--     fetches the following batch instead of everything.
--
--  The ORDER BY gained FormType and FormId as tie-breakers. SubmittedDate
--  alone is NOT unique — several forms are created the same second — and with
--  OFFSET/FETCH a non-deterministic sort silently repeats rows on one page and
--  drops them from another.
--
--  Oracle 19c, so OFFSET .. FETCH NEXT is available (verified on the UAT box).
--
--  APPLY BOTH PARTS: the signature changed, so the package SPEC must be
--  recompiled along with the body or the body will not compile.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  PART 1 — PACKAGE SPEC
--  In PKG_EXITFORM (spec), replace the existing declaration at ~line 279
--  with this one. Only the three new parameters are added.
-- ─────────────────────────────────────────────────────────────────────────────
/*
    PROCEDURE SP_GET_MY_SUBMITTED_REQUESTS_ALL
    (
        P_EMPLOYEE_ID IN VARCHAR2,
        P_STATUS      IN VARCHAR2,
        P_FORM_TYPE   IN VARCHAR2,   -- 'E','B','R' or NULL
        P_FROM_DATE   IN DATE,
        P_TO_DATE     IN DATE,
        P_PAGE_NO     IN NUMBER DEFAULT 1,
        P_PAGE_SIZE   IN NUMBER DEFAULT 500,

        P_CURSOR      OUT SYS_REFCURSOR,
        P_TOTAL_COUNT OUT NUMBER,
        P_SUCCESS     OUT CHAR,
        P_MESSAGE     OUT VARCHAR2
    );
*/


-- ─────────────────────────────────────────────────────────────────────────────
--  PART 2 — PACKAGE BODY
--  Replace the whole existing procedure in PKG_EXITFORM's body with this.
--  NOTE: the DEFAULT clauses must be written identically in the spec and the
--  body, otherwise Oracle raises PLS-00593.
-- ─────────────────────────────────────────────────────────────────────────────

    PROCEDURE SP_GET_MY_SUBMITTED_REQUESTS_ALL
    (
        P_EMPLOYEE_ID IN VARCHAR2,
        P_STATUS      IN VARCHAR2,
        P_FORM_TYPE   IN VARCHAR2,   -- 'E','B','R' or NULL
        P_FROM_DATE   IN DATE,
        P_TO_DATE     IN DATE,
        P_PAGE_NO     IN NUMBER DEFAULT 1,
        P_PAGE_SIZE   IN NUMBER DEFAULT 500,

        P_CURSOR      OUT SYS_REFCURSOR,
        P_TOTAL_COUNT OUT NUMBER,
        P_SUCCESS     OUT CHAR,
        P_MESSAGE     OUT VARCHAR2
    )
    IS
        L_PAGE_NO   NUMBER := NVL(P_PAGE_NO,   1);
        L_PAGE_SIZE NUMBER := NVL(P_PAGE_SIZE, 500);
        L_OFFSET    NUMBER;
    BEGIN

        -- Clamp before use: a 0 or negative page size makes FETCH NEXT return
        -- nothing at all, which would look like "no records" rather than a bad
        -- argument.
        IF L_PAGE_NO   < 1 THEN L_PAGE_NO   := 1;   END IF;
        IF L_PAGE_SIZE < 1 THEN L_PAGE_SIZE := 500; END IF;
        L_OFFSET := (L_PAGE_NO - 1) * L_PAGE_SIZE;

        -- Total across all three form types, BEFORE paging, so the UI can show
        -- "Showing 1–500 of N" and work out how many pages exist. Same three
        -- FROM/WHERE blocks as the cursor below — if a filter changes there it
        -- has to change here too, or the count and the rows disagree.
        SELECT COUNT(*)
          INTO P_TOTAL_COUNT
          FROM (
                SELECT 1
                  FROM TS_EMPLOYEE_EXIT EX
                  JOIN TM_DPR_EMPLOYEE_DETAILS EMP ON EMP.EMPID = EX.EMPLOYEE_ID
                 WHERE TRIM(NVL(EX.CREATED_BY, EX.EMPLOYEE_ID)) = TRIM(P_EMPLOYEE_ID)
                   AND (P_FORM_TYPE IS NULL OR P_FORM_TYPE = 'E')
                   AND (P_STATUS IS NULL OR TRIM(P_STATUS) = '' OR EX.APPROVAL_STATUS = P_STATUS)
                   AND (P_FROM_DATE IS NULL OR TRUNC(EX.CREATED_ON) >= TRUNC(P_FROM_DATE))
                   AND (P_TO_DATE   IS NULL OR TRUNC(EX.CREATED_ON) <= TRUNC(P_TO_DATE))

                UNION ALL

                SELECT 1
                  FROM TS_EMPLOYEE_BYOD B
                  JOIN TM_DPR_EMPLOYEE_DETAILS EMP ON EMP.EMPID = B.EMPLOYEE_ID
                 WHERE TRIM(NVL(B.CREATED_BY, B.EMPLOYEE_ID)) = TRIM(P_EMPLOYEE_ID)
                   AND (P_FORM_TYPE IS NULL OR P_FORM_TYPE = 'B')
                   AND (P_STATUS IS NULL OR TRIM(P_STATUS) = '' OR B.STATUS = P_STATUS)
                   AND (P_FROM_DATE IS NULL OR TRUNC(B.CREATED_ON) >= TRUNC(P_FROM_DATE))
                   AND (P_TO_DATE   IS NULL OR TRUNC(B.CREATED_ON) <= TRUNC(P_TO_DATE))

                UNION ALL

                SELECT 1
                  FROM TS_EMPLOYEE_REJOINING R
                  JOIN TM_DPR_EMPLOYEE_DETAILS EMP ON EMP.EMPID = R.EMPLOYEE_ID
                 WHERE TRIM(NVL(R.CREATED_BY, R.EMPLOYEE_ID)) = TRIM(P_EMPLOYEE_ID)
                   AND (P_FORM_TYPE IS NULL OR P_FORM_TYPE = 'R')
                   AND (P_STATUS IS NULL OR TRIM(P_STATUS) = '' OR R.STATUS = P_STATUS)
                   AND (P_FROM_DATE IS NULL OR TRUNC(R.CREATED_ON) >= TRUNC(P_FROM_DATE))
                   AND (P_TO_DATE   IS NULL OR TRUNC(R.CREATED_ON) <= TRUNC(P_TO_DATE))
               );

        OPEN P_CURSOR FOR
        SELECT *
        FROM (

            /* ================= EXIT ================= */
            SELECT
                'EXIT'                       AS FormType,
                EX.EXIT_ID                   AS FormId,
                EX.EMPLOYEE_ID               AS EmployeeId,
                EMP.EMPLOYEENAME             AS EmployeeName,
                EMP.DEPARTMENT               AS Department,
                EX.CREATED_ON                AS SubmittedDate,
                EX.DATE_OF_DEPARTURE         AS ActionDate,
                EX.NO_OF_DAYS_APPROVED       AS Duration,
                EX.REASON_FOR_PLANNED_LEAVE  AS Reason,
                EX.APPROVAL_STATUS           AS Status

            FROM TS_EMPLOYEE_EXIT EX
            JOIN TM_DPR_EMPLOYEE_DETAILS EMP ON EMP.EMPID = EX.EMPLOYEE_ID

            -- filed BY me (see the NVL note in the header)
            WHERE TRIM(NVL(EX.CREATED_BY, EX.EMPLOYEE_ID)) = TRIM(P_EMPLOYEE_ID)
              AND (P_FORM_TYPE IS NULL OR P_FORM_TYPE = 'E')
              AND (P_STATUS IS NULL OR TRIM(P_STATUS) = '' OR EX.APPROVAL_STATUS = P_STATUS)
              AND (P_FROM_DATE IS NULL OR TRUNC(EX.CREATED_ON) >= TRUNC(P_FROM_DATE))
              AND (P_TO_DATE   IS NULL OR TRUNC(EX.CREATED_ON) <= TRUNC(P_TO_DATE))

            UNION ALL

            /* ================= BYOD ================= */
            SELECT
                'BYOD'             AS FormType,
                B.BYOD_ID          AS FormId,
                B.EMPLOYEE_ID      AS EmployeeId,
                EMP.EMPLOYEENAME   AS EmployeeName,
                EMP.DEPARTMENT     AS Department,
                B.CREATED_ON       AS SubmittedDate,
                B.DATE_OF_PURCHASE AS ActionDate,
                NULL               AS Duration,
                B.ASSET_CODE       AS Reason,
                B.STATUS           AS Status

            FROM TS_EMPLOYEE_BYOD B
            JOIN TM_DPR_EMPLOYEE_DETAILS EMP ON EMP.EMPID = B.EMPLOYEE_ID

            WHERE TRIM(NVL(B.CREATED_BY, B.EMPLOYEE_ID)) = TRIM(P_EMPLOYEE_ID)
              AND (P_FORM_TYPE IS NULL OR P_FORM_TYPE = 'B')
              AND (P_STATUS IS NULL OR TRIM(P_STATUS) = '' OR B.STATUS = P_STATUS)
              AND (P_FROM_DATE IS NULL OR TRUNC(B.CREATED_ON) >= TRUNC(P_FROM_DATE))
              AND (P_TO_DATE   IS NULL OR TRUNC(B.CREATED_ON) <= TRUNC(P_TO_DATE))

            UNION ALL

            /* ================= REJOIN ================= */
            SELECT
                'REJOIN'         AS FormType,
                R.REJOIN_ID      AS FormId,
                R.EMPLOYEE_ID    AS EmployeeId,
                EMP.EMPLOYEENAME AS EmployeeName,
                EMP.DEPARTMENT   AS Department,
                R.CREATED_ON     AS SubmittedDate,
                R.JOINING_DATE   AS ActionDate,
                NULL             AS Duration,
                R.LEAVETYPE      AS Reason,
                R.STATUS         AS Status

            FROM TS_EMPLOYEE_REJOINING R
            JOIN TM_DPR_EMPLOYEE_DETAILS EMP ON EMP.EMPID = R.EMPLOYEE_ID

            WHERE TRIM(NVL(R.CREATED_BY, R.EMPLOYEE_ID)) = TRIM(P_EMPLOYEE_ID)
              AND (P_FORM_TYPE IS NULL OR P_FORM_TYPE = 'R')
              AND (P_STATUS IS NULL OR TRIM(P_STATUS) = '' OR R.STATUS = P_STATUS)
              AND (P_FROM_DATE IS NULL OR TRUNC(R.CREATED_ON) >= TRUNC(P_FROM_DATE))
              AND (P_TO_DATE   IS NULL OR TRUNC(R.CREATED_ON) <= TRUNC(P_TO_DATE))

        )
        -- FormType/FormId are the tie-breakers that make paging deterministic.
        ORDER BY SubmittedDate DESC, FormType ASC, FormId DESC
        OFFSET L_OFFSET ROWS FETCH NEXT L_PAGE_SIZE ROWS ONLY;

        P_SUCCESS := 'Y';
        P_MESSAGE := 'My submitted requests fetched successfully';

    EXCEPTION
        WHEN OTHERS THEN
            P_CURSOR      := NULL;
            P_TOTAL_COUNT := 0;
            P_SUCCESS     := 'N';
            P_MESSAGE     := SQLERRM;
    END;
