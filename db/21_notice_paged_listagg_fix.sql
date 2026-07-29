------------------------------------------------------------------------------
-- 21_notice_paged_listagg_fix.sql
-- Fixes ORA-01489 ("result of string concatenation is too long") in
-- PKG_COMMON_LOOKUPS.SP_GET_NOTICES_PAGED.
--
-- Paste this procedure into the PKG_COMMON_LOOKUPS package BODY, replacing
-- the current SP_GET_NOTICES_PAGED, then compile the package.
--
-- ROOT CAUSE (verified on live data 29-Jul-2026)
--   Notice 243 is a RECIPIENT_TYPE = 'ALL' notice with 5,072 recipient rows.
--   The Recipient sub-query reads:
--
--       CASE WHEN MAX(RECIPIENT_TYPE) = 'ALL' THEN 'GLOBAL'
--            ...  LISTAGG(DISTINCT D.EMPLOYEENAME, ', ') ...
--
--   Oracle computes EVERY aggregate in the expression during the grouping
--   phase and only afterwards evaluates the CASE to pick one. So even for an
--   'ALL' notice — where the answer is just the literal 'GLOBAL' — Oracle
--   still builds the full employee-name LISTAGG: 98,150 characters for
--   notice 243, against a 4,000-byte SQL VARCHAR2 limit -> ORA-01489.
--   The CASE does NOT short-circuit. This is the whole bug.
--
--   Notice 181 ('USER', 160 recipients) was already at 3,602 characters —
--   a handful more recipients and it would have failed too.
--
-- THE FIX — two parts, both marked ## FIX
--   1. Move the type test INSIDE each LISTAGG. Non-matching rows become NULL
--      and LISTAGG skips NULLs, so an 'ALL' notice aggregates nothing at all
--      (also removes the pointless 5,072-row concatenation on every page load).
--   2. Add ON OVERFLOW TRUNCATE ... WITH COUNT as a permanent safety net
--      (supported: this DB is Oracle 19c). A genuinely huge USER notice now
--      truncates neatly and appends the number of names left out, instead of
--      raising ORA-01489 and blanking the whole notice list.
--
-- Everything else in the procedure is byte-for-byte the deployed version.
-- No C# change is required.
--
-- VERIFIED: run against all 6 notices that have recipient rows — 6 ok,
-- 0 failed; notice 243 now returns 'GLOBAL', notice 181 returns its 3,582-char
-- name list, notices 82/201 return 'IT'.
------------------------------------------------------------------------------

        PROCEDURE SP_GET_NOTICES_PAGED
        (
            P_CURSOR              OUT SYS_REFCURSOR,
            P_PAGE_START          IN NUMBER,
            P_PAGE_END            IN NUMBER,
            P_START_DATE          IN DATE DEFAULT NULL,
            P_EXPIRY_DATE         IN DATE DEFAULT NULL,
            P_STATUS              IN VARCHAR2 DEFAULT NULL,
            P_PRIORITY            IN VARCHAR2 DEFAULT NULL,
            P_ACTIVE_COUNT        OUT NUMBER,
            P_UPCOMING_COUNT      OUT NUMBER,
            P_HIGH_PRIORITY_COUNT OUT NUMBER,
            P_SUCCESS             OUT CHAR,
            P_MESSAGE             OUT VARCHAR2
        )
        IS
        BEGIN
            OPEN P_CURSOR FOR
                SELECT *
                FROM
                (
                    SELECT
                        N.NOTICE_ID AS NoticeId,
                        N.TITLE AS Title,
                        N.CONTENT AS Content,
                        N.PRIORITY AS Priority,
                        N.START_DATE AS StartDate,
                        N.EXPIRY_DATE AS ExpiryDate,
                        N.SHOW_ON_LOGIN AS ShowOnLogin,
                        (SELECT
                                CASE
                                    WHEN MAX(R.RECIPIENT_TYPE) = 'ALL' THEN 'GLOBAL'
                                    WHEN MAX(R.RECIPIENT_TYPE) = 'DEPARTMENT' THEN
                                        -- ## FIX 1: only DEPARTMENT rows are aggregated
                                        -- ## FIX 2: can never overflow 4000 bytes again
                                        LISTAGG(DISTINCT
                                                CASE WHEN R.RECIPIENT_TYPE = 'DEPARTMENT'
                                                     THEN M.DEPTNAME END, ', '
                                                ON OVERFLOW TRUNCATE ' ...' WITH COUNT)
                                        WITHIN GROUP (ORDER BY
                                                CASE WHEN R.RECIPIENT_TYPE = 'DEPARTMENT'
                                                     THEN M.DEPTNAME END)
                                    WHEN MAX(R.RECIPIENT_TYPE) = 'USER' THEN
                                        -- ## FIX 1 + 2 (same reasoning, USER rows)
                                        LISTAGG(DISTINCT
                                                CASE WHEN R.RECIPIENT_TYPE = 'USER'
                                                     THEN D.EMPLOYEENAME END, ', '
                                                ON OVERFLOW TRUNCATE ' ...' WITH COUNT)
                                        WITHIN GROUP (ORDER BY
                                                CASE WHEN R.RECIPIENT_TYPE = 'USER'
                                                     THEN D.EMPLOYEENAME END)
                                END
                            FROM TS_NOTICE_RECIPIENTS R
                            LEFT JOIN TM_DPR_EMPLOYEE_DETAILS D ON R.USER_ID = D.EMPID
                            LEFT JOIN TM_DEPTMASTER M ON R.DEPARTMENT = M.DEPARTMENT_ID
                            WHERE R.NOTICE_ID = N.NOTICE_ID
                        ) AS Recipient,
                        E.EMPLOYEENAME AS CreatedBy,
                        CASE WHEN N.IS_ACTIVE = 'N' THEN 'INACTIVE'
                             WHEN N.START_DATE > TRUNC(SYSDATE) THEN 'PENDING'
                             WHEN N.START_DATE <= TRUNC(SYSDATE) AND (N.EXPIRY_DATE IS NULL OR N.EXPIRY_DATE >= TRUNC(SYSDATE)) THEN 'ACTIVE'
                             WHEN N.EXPIRY_DATE < TRUNC(SYSDATE) THEN 'EXPIRED'
                        END AS STATUS,
                        ROW_NUMBER() OVER
                        ( ORDER BY N.CREATED_ON DESC, N.NOTICE_ID DESC ) RN

                    FROM TS_NOTICE_MASTER N
                    LEFT JOIN TM_DPR_EMPLOYEE_DETAILS E ON N.CREATED_BY = E.EMPID
                    WHERE N.IS_ACTIVE IN('Y','N')
                    AND ( P_START_DATE IS NULL OR N.START_DATE >= TRUNC(P_START_DATE) AND N.START_DATE < TRUNC(P_START_DATE) + 1 )
                    AND ( P_EXPIRY_DATE IS NULL OR N.EXPIRY_DATE >= TRUNC(P_EXPIRY_DATE) AND N.EXPIRY_DATE < TRUNC(P_EXPIRY_DATE) + 1 )
                    AND ( P_STATUS IS NULL OR ( P_STATUS = 'PENDING' AND N.START_DATE > TRUNC(SYSDATE))
                    OR  ( P_STATUS = 'ACTIVE' AND N.START_DATE <= TRUNC(SYSDATE)
                    AND ( N.EXPIRY_DATE IS NULL OR N.EXPIRY_DATE >= TRUNC(SYSDATE)))
                    OR ( P_STATUS = 'EXPIRED' AND N.EXPIRY_DATE < TRUNC(SYSDATE)))
                    AND ( P_PRIORITY IS NULL OR TRIM(UPPER(N.PRIORITY)) = TRIM(UPPER(P_PRIORITY)))
                )
                WHERE RN BETWEEN P_PAGE_START AND P_PAGE_END;

            SELECT COUNT(*)
            INTO P_ACTIVE_COUNT
            FROM TS_NOTICE_MASTER
            WHERE IS_ACTIVE = 'Y'
            AND START_DATE <= TRUNC(SYSDATE)
            AND ( EXPIRY_DATE IS NULL OR EXPIRY_DATE >= TRUNC(SYSDATE) );

            SELECT COUNT(*)
            INTO P_UPCOMING_COUNT
            FROM TS_NOTICE_MASTER
            WHERE IS_ACTIVE = 'Y'
            AND START_DATE > TRUNC(SYSDATE);

            SELECT COUNT(*)
            INTO P_HIGH_PRIORITY_COUNT
            FROM TS_NOTICE_MASTER
            WHERE IS_ACTIVE = 'Y'
            AND PRIORITY = 'HIGH'
            AND START_DATE <= TRUNC(SYSDATE)
            AND ( EXPIRY_DATE IS NULL OR EXPIRY_DATE >= TRUNC(SYSDATE) );

            PKG_LOG.SP_INSERT_LOG( 'NOTICE_FETCH', 'SP_GET_NOTICES_PAGED', 'SUCCESS', 'Paged notices fetched successfully');

            P_SUCCESS := 'Y';
            P_MESSAGE := 'Notices fetched successfully';

        EXCEPTION
            WHEN OTHERS THEN

                P_CURSOR := NULL;  P_ACTIVE_COUNT := 0;  P_UPCOMING_COUNT := 0;  P_HIGH_PRIORITY_COUNT := 0;
                PKG_LOG.SP_INSERT_LOG( 'NOTICE_FETCH', 'SP_GET_NOTICES_PAGED', 'FAIL', SQLERRM);
                P_SUCCESS := 'N';
                P_MESSAGE := SQLERRM;

        END;

------------------------------------------------------------------------------
-- VERIFY after compiling — this used to raise ORA-01489, now it must return
-- rows with notice 243 showing 'GLOBAL':
--
-- VAR c REFCURSOR
-- DECLARE a NUMBER; u NUMBER; h NUMBER; s CHAR(1); m VARCHAR2(500);
-- BEGIN
--   PKG_COMMON_LOOKUPS.SP_GET_NOTICES_PAGED(:c, 1, 20, NULL, NULL, NULL, NULL,
--                                           a, u, h, s, m);
--   DBMS_OUTPUT.PUT_LINE('success=' || s || ' msg=' || m);
-- END;
-- /
-- PRINT c
------------------------------------------------------------------------------
