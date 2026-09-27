-- ============================================================================
--  PKG_QAQC  -  QA/QC module reports for the portal
--  ---------------------------------------------------------------------------
--  This package is the new home for the QA/QC reports. It starts with MIR
--  (Material Inspection Request); WIR already lives in PKG_ADK_WIR.
--
--  WHY PKG_ADK_WIR IS NOT TOUCHED
--  ------------------------------
--  The obvious reading of "one QAQC package holding WIR and MIR" is to move
--  the WIR procedures in here too. That is deliberately NOT done yet, for one
--  reason: WIR is live and working, and a package is replaced as a WHOLE. If
--  WIR and MIR shared a package body, every MIR change would recompile WIR,
--  and a single compile error in new MIR code would take the working WIR
--  screen down with it. Worse, replacing a package needs a library-cache lock
--  that a running report holds - which is exactly what blocked the finance
--  deployment for over an hour.
--
--  So: MIR ships here and proves itself, and WIR moves in as its own step once
--  it does. Nothing is deleted either way - PKG_ADK_WIR stays exactly as it is
--  and the WIR screen keeps calling it.
--
--  REQUIRES THESE GRANTS (see GRANT_MIR_TO_REPORT_USER.sql):
--      ADK2026.MATINSPREQHDR, ADK2026.NCRISSUEDHDR, ADK2026.QSMIRATTACH
--  A package compiles with DEFINER'S RIGHTS, so these must be granted DIRECTLY
--  to ADK_TIMESHEET - a role is not enough. Verified present before this was
--  written.
-- ============================================================================

CREATE OR REPLACE PACKAGE PKG_QAQC AS

  /*  MIR LISTING
   *
   *  Deliberately the same shape as PKG_ADK_WIR.SP_GET_WIR_LIST: every filter
   *  optional, NULL meaning "not applied", server-side paging, and TOTALROWS
   *  carried on each row by COUNT(*) OVER () so the grid can show "x of y"
   *  without a second round trip. The MIR screen is a copy of the WIR screen,
   *  so the contract it calls should be a copy too.
   */
  PROCEDURE SP_GET_MIR_LIST (
    P_DOCID        IN  VARCHAR2 DEFAULT NULL,
    P_REVNO        IN  VARCHAR2 DEFAULT NULL,
    P_FROM_DATE    IN  VARCHAR2 DEFAULT NULL,
    P_TO_DATE      IN  VARCHAR2 DEFAULT NULL,
    P_PROJECT_CODE IN  VARCHAR2 DEFAULT NULL,
    P_SUBJECT      IN  VARCHAR2 DEFAULT NULL,
    P_MATERIAL     IN  VARCHAR2 DEFAULT NULL,
    P_SUPPLIER     IN  VARCHAR2 DEFAULT NULL,
    P_MANUFACTURER IN  VARCHAR2 DEFAULT NULL,
    P_LOCATION     IN  VARCHAR2 DEFAULT NULL,
    P_ZONE         IN  VARCHAR2 DEFAULT NULL,
    P_LLEVEL       IN  VARCHAR2 DEFAULT NULL,
    P_CONTRACTOR   IN  VARCHAR2 DEFAULT NULL,
    P_INSPECTED_BY IN  VARCHAR2 DEFAULT NULL,
    P_RECEIVED_BY  IN  VARCHAR2 DEFAULT NULL,
    P_STATUS       IN  VARCHAR2 DEFAULT NULL,
    P_QAQC_STATUS  IN  VARCHAR2 DEFAULT NULL,
    P_SEARCH       IN  VARCHAR2 DEFAULT NULL,
    P_OFFSET       IN  NUMBER   DEFAULT 0,
    P_LIMIT        IN  NUMBER   DEFAULT NULL,
    P_CURSOR       OUT SYS_REFCURSOR,
    P_SUCCESS      OUT VARCHAR2,
    P_MESSAGE      OUT VARCHAR2
  );

  /*  MIR PDF DATA
   *
   *  One cursor per dataset of the legacy FastReport form (prv_frx_mir), in
   *  the same order the form declares them, so the C# builder reads them
   *  straight through:
   *
   *      P_HEADER      <- DBXQuery1      the whole MIR form
   *      P_BRANCH_LOGO <- Companylogo
   *      P_CLIENT_LOGO <- clientlogo
   *      P_CONS_LOGO   <- consultantlogo
   *      P_SIG_OPM     <- DBXQuery2      contractor project manager / engineer
   *      P_SIG_CON     <- DBXQuery3      contractor's QA/QC
   *      P_SIG_REC     <- DBXQuery4      received by
   *
   *  DBXQuery5 (QSMIRATTACH) is NOT here. It fetches previously attached PDF
   *  files to append to the printout, which is a PDF-merge concern rather than
   *  a rendering one, and nothing on the visible form binds to it. Left out
   *  on purpose so the cursor list matches what actually gets drawn.
   */
  PROCEDURE SP_GET_MIR_PDF_DATA (
    P_DOCID        IN  VARCHAR2,
    P_HEADER       OUT SYS_REFCURSOR,
    P_BRANCH_LOGO  OUT SYS_REFCURSOR,
    P_CLIENT_LOGO  OUT SYS_REFCURSOR,
    P_CONS_LOGO    OUT SYS_REFCURSOR,
    P_SIG_OPM      OUT SYS_REFCURSOR,
    P_SIG_CON      OUT SYS_REFCURSOR,
    P_SIG_REC      OUT SYS_REFCURSOR
  );

END PKG_QAQC;
/

CREATE OR REPLACE PACKAGE BODY PKG_QAQC AS

  -- ==========================================================================
  --  MIR LISTING
  -- ==========================================================================
  PROCEDURE SP_GET_MIR_LIST (
    P_DOCID        IN  VARCHAR2 DEFAULT NULL,
    P_REVNO        IN  VARCHAR2 DEFAULT NULL,
    P_FROM_DATE    IN  VARCHAR2 DEFAULT NULL,
    P_TO_DATE      IN  VARCHAR2 DEFAULT NULL,
    P_PROJECT_CODE IN  VARCHAR2 DEFAULT NULL,
    P_SUBJECT      IN  VARCHAR2 DEFAULT NULL,
    P_MATERIAL     IN  VARCHAR2 DEFAULT NULL,
    P_SUPPLIER     IN  VARCHAR2 DEFAULT NULL,
    P_MANUFACTURER IN  VARCHAR2 DEFAULT NULL,
    P_LOCATION     IN  VARCHAR2 DEFAULT NULL,
    P_ZONE         IN  VARCHAR2 DEFAULT NULL,
    P_LLEVEL       IN  VARCHAR2 DEFAULT NULL,
    P_CONTRACTOR   IN  VARCHAR2 DEFAULT NULL,
    P_INSPECTED_BY IN  VARCHAR2 DEFAULT NULL,
    P_RECEIVED_BY  IN  VARCHAR2 DEFAULT NULL,
    P_STATUS       IN  VARCHAR2 DEFAULT NULL,
    P_QAQC_STATUS  IN  VARCHAR2 DEFAULT NULL,
    P_SEARCH       IN  VARCHAR2 DEFAULT NULL,
    P_OFFSET       IN  NUMBER   DEFAULT 0,
    P_LIMIT        IN  NUMBER   DEFAULT NULL,
    P_CURSOR       OUT SYS_REFCURSOR,
    P_SUCCESS      OUT VARCHAR2,
    P_MESSAGE      OUT VARCHAR2
  ) IS
  BEGIN

    OPEN P_CURSOR FOR
      WITH MIR AS (
        SELECT
               -- A revised MIR keeps its ORIGINAL doc id and carries the
               -- revision beside it, exactly as the printed form does
               -- (oldmirdocid || '/' || revno). Showing A.DOCID raw would list
               -- the internal id of the revision instead of the document
               -- people actually refer to.
               CASE WHEN A.OLDMIRDOCID IS NULL
                    THEN A.DOCID
                    ELSE A.OLDMIRDOCID || '/' || A.REVNO
               END                               AS DOCID,
               A.REVNO,
               A.DOCDATE,
               TO_CHAR(A.DOCDATE, 'DD/MM/YYYY')  AS DOCDATESTR,
               PM.PROJECTCODE,
               PM.PROJECTNAME,
               A.SUBJECT,
               A.MATERIALDESC,
               A.MANUFACTURE                     AS MANUFACTURER,
               A.NAMEOFSUPPLIER                  AS SUPPLIER,
               A.MARREFNO,
               A.LOACTION                        AS LOCATION,   -- column really is spelt LOACTION
               A.ZONE,
               A.BLEVEL                          AS LLEVEL,
               BR.BRANCHNAME                     AS CONTRACTOR,
               A.INSPECTEDNAME                   AS INSPECTEDBY,
               A.RECEIVEDBY,
               NCR.DOCID                         AS AGAINSTNCR,
               -- Same four codes the form prints, and the same fall-through to
               -- PENDING when none has been set yet.
               CASE
                 WHEN A.STATUSCOMMENTS LIKE 'Code 1%' THEN 'CODE 1 - APPROVED'
                 WHEN A.STATUSCOMMENTS LIKE 'Code 2%' THEN 'CODE 2 - APPROVED W/ COMMENTS'
                 WHEN A.STATUSCOMMENTS LIKE 'Code 3%' THEN 'CODE 3 - REVISE & RESUBMIT'
                 WHEN A.STATUSCOMMENTS LIKE 'Code R%' THEN 'CODE R - NOT APPROVED'
                 ELSE 'PENDING'
               END                               AS STATUS,
               CASE
                 WHEN UPPER(A.QAQCAPP) = 'YES' THEN 'ACCEPTED'
                 WHEN UPPER(A.QAQCAPP) = 'NO'  THEN 'NO'
                 ELSE 'REJECTED'
               END                               AS QAQCSTATUS
          FROM ADK2026.MATINSPREQHDR A
          JOIN ADK2026.PROJECTMASTER PM
            ON PM.PROJECTMASTERID = A.PROJECTCODE
          JOIN ADK2026.BRANCH BR
            ON BR.BRANCHID = PM.BRANCHNAME
          -- OUTER: most MIRs are not raised against an NCR, and an inner join
          -- here would silently drop all of them.
          LEFT JOIN ADK2026.NCRISSUEDHDR NCR
            ON NCR.NCRISSUEDHDRID = A.AGAINSTNCR
         WHERE A.CANCEL = 'F'
      )
      SELECT DOCID,
             TO_CHAR(REVNO)     AS REVNO,
             DOCDATESTR         AS DOCDATE,
             PROJECTCODE,
             PROJECTNAME,
             SUBJECT,
             MATERIALDESC,
             MANUFACTURER,
             SUPPLIER,
             MARREFNO,
             LOCATION,
             ZONE,
             LLEVEL,
             CONTRACTOR,
             INSPECTEDBY,
             RECEIVEDBY,
             AGAINSTNCR,
             STATUS,
             QAQCSTATUS,
             COUNT(*) OVER ()   AS TOTALROWS
        FROM MIR
       WHERE (P_DOCID        IS NULL OR UPPER(DOCID)        LIKE '%' || UPPER(P_DOCID)        || '%')
         AND (P_REVNO        IS NULL OR TO_CHAR(REVNO)      =  P_REVNO)
         AND (P_FROM_DATE    IS NULL OR DOCDATE             >= TO_DATE(P_FROM_DATE, 'DD/MM/YYYY'))
         AND (P_TO_DATE      IS NULL OR DOCDATE             <  TO_DATE(P_TO_DATE,   'DD/MM/YYYY') + 1)
         AND (P_PROJECT_CODE IS NULL OR PROJECTCODE         =  P_PROJECT_CODE)
         AND (P_SUBJECT      IS NULL OR UPPER(SUBJECT)      LIKE '%' || UPPER(P_SUBJECT)      || '%')
         AND (P_MATERIAL     IS NULL OR UPPER(MATERIALDESC) LIKE '%' || UPPER(P_MATERIAL)     || '%')
         AND (P_SUPPLIER     IS NULL OR UPPER(SUPPLIER)     LIKE '%' || UPPER(P_SUPPLIER)     || '%')
         AND (P_MANUFACTURER IS NULL OR UPPER(MANUFACTURER) LIKE '%' || UPPER(P_MANUFACTURER) || '%')
         AND (P_LOCATION     IS NULL OR UPPER(LOCATION)     LIKE '%' || UPPER(P_LOCATION)     || '%')
         AND (P_ZONE         IS NULL OR ZONE                =  P_ZONE)
         AND (P_LLEVEL       IS NULL OR LLEVEL              =  P_LLEVEL)
         AND (P_CONTRACTOR   IS NULL OR CONTRACTOR          =  P_CONTRACTOR)
         AND (P_INSPECTED_BY IS NULL OR UPPER(INSPECTEDBY)  LIKE '%' || UPPER(P_INSPECTED_BY) || '%')
         AND (P_RECEIVED_BY  IS NULL OR UPPER(RECEIVEDBY)   LIKE '%' || UPPER(P_RECEIVED_BY)  || '%')
         AND (P_STATUS       IS NULL OR STATUS              =  P_STATUS)
         AND (P_QAQC_STATUS  IS NULL OR QAQCSTATUS          =  P_QAQC_STATUS)
         AND (P_SEARCH       IS NULL OR
              UPPER(DOCID || ' ' || PROJECTCODE || ' ' || PROJECTNAME || ' ' ||
                    NVL(SUBJECT, '')      || ' ' || NVL(MATERIALDESC, '') || ' ' ||
                    NVL(SUPPLIER, '')     || ' ' || NVL(MANUFACTURER, '') || ' ' ||
                    NVL(LOCATION, '')     || ' ' || NVL(CONTRACTOR, '')   || ' ' ||
                    NVL(MARREFNO, '')
              ) LIKE '%' || UPPER(P_SEARCH) || '%')
       ORDER BY DOCDATE DESC, DOCID DESC
      OFFSET NVL(P_OFFSET, 0) ROWS
       FETCH NEXT NVL(P_LIMIT, 2147483647) ROWS ONLY;

    P_SUCCESS := 'Y';
    P_MESSAGE := 'OK';

  EXCEPTION
    WHEN OTHERS THEN
      P_SUCCESS := 'N';
      P_MESSAGE := SUBSTR(SQLERRM, 1, 500);
      -- An empty cursor rather than a null one: the caller always reads it,
      -- and a null ref cursor would turn a reportable error into a crash.
      OPEN P_CURSOR FOR SELECT * FROM DUAL WHERE 1 = 0;
  END SP_GET_MIR_LIST;


  -- ==========================================================================
  --  MIR PDF DATA
  --  A faithful port of the legacy report's datasets. The bind :docid becomes
  --  P_DOCID; nothing else about the SQL changed.
  -- ==========================================================================
  PROCEDURE SP_GET_MIR_PDF_DATA (
    P_DOCID        IN  VARCHAR2,
    P_HEADER       OUT SYS_REFCURSOR,
    P_BRANCH_LOGO  OUT SYS_REFCURSOR,
    P_CLIENT_LOGO  OUT SYS_REFCURSOR,
    P_CONS_LOGO    OUT SYS_REFCURSOR,
    P_SIG_OPM      OUT SYS_REFCURSOR,
    P_SIG_CON      OUT SYS_REFCURSOR,
    P_SIG_REC      OUT SYS_REFCURSOR
  ) IS
    V_DOCID VARCHAR2(400) := TRIM(P_DOCID);
  BEGIN

    -- ── DBXQuery1 : the whole form ──────────────────────────────────────────
    OPEN P_HEADER FOR
      SELECT A.MATINSPREQHDRID,
             PM.PROJECTCODE,
             PM.PROJECTNAME,
             A.TOTHE,
             A.FROMTHE,
             TO_CHAR(A.DOCDATE, 'DD/MM/YYYY')                AS DOCDATE,
             CASE WHEN A.OLDMIRDOCID IS NULL
                  THEN A.DOCID
                  ELSE A.OLDMIRDOCID || '/' || A.REVNO
             END                                             AS DOCID,
             BR.BRANCHNAME                                   AS CONTRACTOR,
             A.MARREFNO,
             TO_CHAR(A.DELIVERYDATE, 'DD/MM/YYYY')           AS DELIVERYDATE,
             NCR.DOCID                                       AS AGAINSTNCR,
             A.LOACTION,
             A.MATERIALDESC,
             A.MANUFACTURE,
             A.NAMEOFSUPPLIER,
             A.TESTREQUIRED,
             A.NOOFSAMPLE,
             A.DETAILSOFINSPECTION,
             A.CONFIRMCOMPLAINCE,
             A.OTHER,
             -- The form falls back to the inspector's comments when the
             -- general comment box is empty; keep that or half the printed
             -- MIRs lose their comment.
             NVL(A.INSPCOMMENTS, A.INSPECTEDCOMMENTS)        AS INSPCOMMENTS,
             A.OPMEMPID,
             A.PMAPP,
             A.CONTRACTOREMPID,
             A.QAQCAPP,
             A.SUBCONTRACTORPM,
             A.SCPMAPP,
             A.RECEIVEDEMPID,
             A.RECAPP,
             CAST(NULL AS VARCHAR2(100))                     AS RECEIVEDDESG,
             A.RECEIVEDON,
             CAST(NULL AS VARCHAR2(100))                     AS RESPONSECOMMENTS,
             A.CONTRACTOROPM,
             A.CONTRACTORQAQC,
             A.INSPECTEDEMPID,
             A.INSPECTEDNAME,
             A.INSPECTEDAPP,
             A.RECEIVEDBY,
             TO_CHAR(A.INSPECTIONDATE, 'DD/MM/YYYY')         AS DATEOFINSPECTION,
             A.STATUSCOMMENTS,
             PM.PROJECTCODE || ' - ' || UPPER(PM.PROJBILLNAME) AS PNAME,
             A.SUBCONTACTPERSON,
             A.PMAPPON,
             A.QAQCAPPON,
             A.INSPECTEDAPPON,
             UPPER(PM.CONST)                                 AS CONSTS,
             PM.CONSTPREFIX,
             -- The four response tick boxes, and the three "And In Enclosed
             -- Notes" boxes beside them. 1 = ticked. Computed here exactly as
             -- the FastReport form did, so the builder only has to draw them.
             CASE WHEN A.STATUSCOMMENTS = 'Code 1 - APPROVED. Work can proceed'
                  THEN 1 ELSE 0 END                          AS T1,
             CASE WHEN A.STATUSCOMMENTS = 'Code 2 - APPROVED WITH COMMENTS. Work can proceed incorporating comments'
                  THEN 1 ELSE 0 END                          AS T2,
             CASE WHEN A.STATUSCOMMENTS = 'Code 3 - APPROVED WITH COMMENTS. Work can proceed. Revise and resubmit'
                  THEN 1 ELSE 0 END                          AS T3,
             CASE WHEN A.STATUSCOMMENTS = 'Code R - NOT APPROVED for reason noted below'
                  THEN 1 ELSE 0 END                          AS T4,
             CASE WHEN A.STATUSCOMMENTS = 'Code 2 - APPROVED WITH COMMENTS. Work can proceed incorporating comments'
                   AND A.ENCLOSEDNOTES = 'T' THEN 1 ELSE 0 END AS T22,
             CASE WHEN A.STATUSCOMMENTS = 'Code 3 - APPROVED WITH COMMENTS. Work can proceed. Revise and resubmit'
                   AND A.ENCLOSEDNOTES = 'T' THEN 1 ELSE 0 END AS T33,
             CASE WHEN A.STATUSCOMMENTS = 'Code R - NOT APPROVED for reason noted below'
                   AND A.ENCLOSEDNOTES = 'T' THEN 1 ELSE 0 END AS T44
        FROM ADK2026.MATINSPREQHDR A
        JOIN ADK2026.PROJECTMASTER PM
          ON PM.PROJECTMASTERID = A.PROJECTCODE
        JOIN ADK2026.BRANCH BR
          ON BR.BRANCHID = PM.BRANCHNAME
        LEFT JOIN ADK2026.NCRISSUEDHDR NCR
          ON NCR.NCRISSUEDHDRID = A.AGAINSTNCR
       WHERE A.CANCEL = 'F'
         -- Matches either the plain doc id or a revision's printed id, so the
         -- same value the listing shows can be handed straight back.
         AND (A.DOCID = V_DOCID
              OR (A.OLDMIRDOCID IS NOT NULL
                  AND A.OLDMIRDOCID || '/' || A.REVNO = V_DOCID));

    -- ── Companylogo ─────────────────────────────────────────────────────────
    OPEN P_BRANCH_LOGO FOR
      SELECT BL.IMG AS BRANCHLOGO
        FROM ADK2026.BRANCOMPLOGO BL,
             ADK2026.BRANCH B,
             ADK2026.PROJECTMASTER P,
             ADK2026.MATINSPREQHDR C
       WHERE BL.RECORDID       = B.BRANCHID
         AND P.BRANCHNAME      = B.BRANCHID
         AND P.PROJECTMASTERID = C.PROJECTCODE
         AND (C.DOCID = V_DOCID
              OR (C.OLDMIRDOCID IS NOT NULL
                  AND C.OLDMIRDOCID || '/' || C.REVNO = V_DOCID));

    -- ── clientlogo ──────────────────────────────────────────────────────────
    OPEN P_CLIENT_LOGO FOR
      SELECT PL.IMG AS CLIENTLOGO
        FROM ADK2026.PROJCLIENTLOGO PL,
             ADK2026.PROJECTMASTER PM,
             ADK2026.MATINSPREQHDR C
       WHERE PM.PROJECTMASTERID = PL.RECORDID
         AND PL.BLOBNO          = 1
         AND PM.PROJECTMASTERID = C.PROJECTCODE
         AND (C.DOCID = V_DOCID
              OR (C.OLDMIRDOCID IS NOT NULL
                  AND C.OLDMIRDOCID || '/' || C.REVNO = V_DOCID));

    -- ── consultantlogo ──────────────────────────────────────────────────────
    OPEN P_CONS_LOGO FOR
      SELECT PL.IMG AS CONSULTANTLOGO
        FROM ADK2026.PROJCONSULTANTLOGO PL,
             ADK2026.PROJECTMASTER PM,
             ADK2026.MATINSPREQHDR C
       WHERE PM.PROJECTMASTERID = PL.RECORDID
         AND PL.BLOBNO          = 1
         AND PM.PROJECTMASTERID = C.PROJECTCODE
         AND (C.DOCID = V_DOCID
              OR (C.OLDMIRDOCID IS NOT NULL
                  AND C.OLDMIRDOCID || '/' || C.REVNO = V_DOCID));

    -- ── DBXQuery2 : contractor project manager / engineer signature ─────────
    OPEN P_SIG_OPM FOR
      SELECT B.IMG AS IMG, E.EMPID, E.EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1 B,
             ADK2026.MATINSPREQHDR S1,
             ADK2026.EMPMAST E
       WHERE A.SIGNATUREHDRID = B.RECORDID
         AND E.EMPMASTID      = A.EMPID
         AND S1.OPMEMPID      = E.EMPID
         AND B.BLOBNO         = 1
         AND (S1.DOCID = V_DOCID
              OR (S1.OLDMIRDOCID IS NOT NULL
                  AND S1.OLDMIRDOCID || '/' || S1.REVNO = V_DOCID));

    -- ── DBXQuery3 : contractor's QA/QC signature ────────────────────────────
    OPEN P_SIG_CON FOR
      SELECT B.IMG AS IMG, E.EMPID, E.EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1 B,
             ADK2026.MATINSPREQHDR S1,
             ADK2026.EMPMAST E
       WHERE A.SIGNATUREHDRID  = B.RECORDID
         AND E.EMPMASTID       = A.EMPID
         AND S1.CONTRACTOREMPID = E.EMPID
         AND B.BLOBNO          = 1
         AND (S1.DOCID = V_DOCID
              OR (S1.OLDMIRDOCID IS NOT NULL
                  AND S1.OLDMIRDOCID || '/' || S1.REVNO = V_DOCID));

    -- ── DBXQuery4 : received-by signature ───────────────────────────────────
    OPEN P_SIG_REC FOR
      SELECT B.IMG AS IMG, E.EMPID, E.EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1 B,
             ADK2026.MATINSPREQHDR S1,
             ADK2026.EMPMAST E
       WHERE A.SIGNATUREHDRID = B.RECORDID
         AND E.EMPMASTID      = A.EMPID
         AND S1.RECEIVEDEMPID = E.EMPID
         AND B.BLOBNO         = 1
         AND (S1.DOCID = V_DOCID
              OR (S1.OLDMIRDOCID IS NOT NULL
                  AND S1.OLDMIRDOCID || '/' || S1.REVNO = V_DOCID));

  END SP_GET_MIR_PDF_DATA;

END PKG_QAQC;
/
