PACKAGE PKG_ADK_WIR AS

  PROCEDURE SP_GET_WIR_LIST (
    P_DOCID        IN  VARCHAR2 DEFAULT NULL,
    P_REVNO        IN  VARCHAR2 DEFAULT NULL,
    P_FROM_DATE    IN  VARCHAR2 DEFAULT NULL,
    P_TO_DATE      IN  VARCHAR2 DEFAULT NULL,
    P_PROJECT_CODE IN  VARCHAR2 DEFAULT NULL,
    P_DISCIPLINE   IN  VARCHAR2 DEFAULT NULL,
    P_SUBJECT      IN  VARCHAR2 DEFAULT NULL,
    P_LOCATION     IN  VARCHAR2 DEFAULT NULL,
    P_ZONE         IN  VARCHAR2 DEFAULT NULL,
    P_LLEVEL       IN  VARCHAR2 DEFAULT NULL,
    P_CONTRACTOR   IN  VARCHAR2 DEFAULT NULL,
    P_INSPECTED_BY IN  VARCHAR2 DEFAULT NULL,
    P_APPROVED_BY  IN  VARCHAR2 DEFAULT NULL,
    P_STATUS       IN  VARCHAR2 DEFAULT NULL,
    P_QAQC_STATUS  IN  VARCHAR2 DEFAULT NULL,
    P_SEARCH       IN  VARCHAR2 DEFAULT NULL,
    P_OFFSET       IN  NUMBER   DEFAULT 0,
    P_LIMIT        IN  NUMBER   DEFAULT NULL,
    P_CURSOR       OUT SYS_REFCURSOR,
    P_SUCCESS      OUT VARCHAR2,
    P_MESSAGE      OUT VARCHAR2
  );


  PROCEDURE SP_GET_WIR_PDF_DATA (
    P_DOCID        IN  VARCHAR2,
    P_HEADER       OUT SYS_REFCURSOR,
    P_SUBLOCATIONS OUT SYS_REFCURSOR,
    P_FALLBACK     OUT SYS_REFCURSOR,
    P_CHAIN        OUT SYS_REFCURSOR,
    P_BRANCH_LOGO  OUT SYS_REFCURSOR,
    P_CLIENT_LOGO  OUT SYS_REFCURSOR,
    P_CONS_LOGO    OUT SYS_REFCURSOR,
    P_SIG_CON      OUT SYS_REFCURSOR,
    P_SIG_QAQC     OUT SYS_REFCURSOR,
    P_SIG_INS      OUT SYS_REFCURSOR,
    P_SIG_APP      OUT SYS_REFCURSOR,
    P_SIG_REC      OUT SYS_REFCURSOR
  );

END PKG_ADK_WIR;
/
PACKAGE BODY PKG_ADK_WIR AS

  PROCEDURE SP_GET_WIR_LIST (
    P_DOCID        IN  VARCHAR2 DEFAULT NULL,
    P_REVNO        IN  VARCHAR2 DEFAULT NULL,
    P_FROM_DATE    IN  VARCHAR2 DEFAULT NULL,
    P_TO_DATE      IN  VARCHAR2 DEFAULT NULL,
    P_PROJECT_CODE IN  VARCHAR2 DEFAULT NULL,
    P_DISCIPLINE   IN  VARCHAR2 DEFAULT NULL,
    P_SUBJECT      IN  VARCHAR2 DEFAULT NULL,
    P_LOCATION     IN  VARCHAR2 DEFAULT NULL,
    P_ZONE         IN  VARCHAR2 DEFAULT NULL,
    P_LLEVEL       IN  VARCHAR2 DEFAULT NULL,
    P_CONTRACTOR   IN  VARCHAR2 DEFAULT NULL,
    P_INSPECTED_BY IN  VARCHAR2 DEFAULT NULL,
    P_APPROVED_BY  IN  VARCHAR2 DEFAULT NULL,
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
      WITH WIR AS (
        SELECT A.DOCID,
               A.REVNO,
               A.DOCDATE,
               TO_CHAR(A.DOCDATE, 'DD/MM/YYYY')  AS DOCDATESTR,
               PM.PROJECTCODE,
               PM.PROJECTNAME,
               D.TYPEVALUE                       AS DISCIPLINE,
               A.SUBJECT,
               A.LOCATION,
               A.ZONE,
               A.LLEVEL,
               C.BRANCHNAME                      AS CONTRACTOR,
               A.INSPECTEDBY,
               A.APPROVEDBY,
               CASE
                 WHEN A.COMMENTS LIKE 'Code 1%' THEN 'CODE 1 - APPROVED'
                 WHEN A.COMMENTS LIKE 'Code 2%' THEN 'CODE 2 - APPROVED W/ COMMENTS'
                 WHEN A.COMMENTS LIKE 'Code 3%' THEN 'CODE 3 - REVISE & RESUBMIT'
                 WHEN A.COMMENTS LIKE 'Code R%' THEN 'CODE R - NOT APPROVED'
                 ELSE 'PENDING'
               END                               AS STATUS,
               CASE
                 WHEN A.QAQCAPP = 'YES' THEN 'ACCEPTED'
                 WHEN A.QAQCAPP = 'NO'  THEN 'NO'
                 ELSE 'REJECTED'
               END                               AS QAQCSTATUS,
               A.IDATE,
               A.ADATE,
               A.CREATEDON
          FROM ADK2026.INSPREQHDR A
          JOIN ADK2026.PROJECTMASTER PM
            ON A.PROJECTCODE = PM.PROJECTMASTERID
          JOIN ADK2026.BRANCH C
            ON PM.BRANCHNAME = C.BRANCHID
          LEFT JOIN ADK2026.GLOBALTYPEMASTER D
            ON D.GLOBALTYPEMASTERID = A.DISCIPLINE
           AND D.CANCEL = 'F'
           AND D.TYPE   = 'DISCIPLINE'
         WHERE A.CANCEL = 'F'
      )
      SELECT DOCID,
             TO_CHAR(REVNO)     AS REVNO,
             DOCDATESTR         AS DOCDATE,
             PROJECTCODE,
             PROJECTNAME,
             DISCIPLINE,
             SUBJECT,
             LOCATION,
             ZONE,
             LLEVEL,
             CONTRACTOR,
             INSPECTEDBY,
             APPROVEDBY,
             STATUS,
             QAQCSTATUS,
             COUNT(*) OVER ()   AS TOTALROWS
        FROM WIR
       WHERE (P_DOCID        IS NULL OR UPPER(DOCID)       LIKE '%' || UPPER(P_DOCID)        || '%')
         AND (P_REVNO        IS NULL OR TO_CHAR(REVNO)     =  P_REVNO)
         AND (P_FROM_DATE    IS NULL OR DOCDATE            >= TO_DATE(P_FROM_DATE, 'DD/MM/YYYY'))
         AND (P_TO_DATE      IS NULL OR DOCDATE            <  TO_DATE(P_TO_DATE,   'DD/MM/YYYY') + 1)
         AND (P_PROJECT_CODE IS NULL OR PROJECTCODE        =  P_PROJECT_CODE)
         AND (P_DISCIPLINE   IS NULL OR DISCIPLINE         =  P_DISCIPLINE)
         AND (P_SUBJECT      IS NULL OR UPPER(SUBJECT)     LIKE '%' || UPPER(P_SUBJECT)      || '%')
         AND (P_LOCATION     IS NULL OR UPPER(LOCATION)    LIKE '%' || UPPER(P_LOCATION)     || '%')
         AND (P_ZONE         IS NULL OR ZONE               =  P_ZONE)
         AND (P_LLEVEL       IS NULL OR LLEVEL             =  P_LLEVEL)
         AND (P_CONTRACTOR   IS NULL OR CONTRACTOR         =  P_CONTRACTOR)
         AND (P_INSPECTED_BY IS NULL OR UPPER(INSPECTEDBY) LIKE '%' || UPPER(P_INSPECTED_BY) || '%')
         AND (P_APPROVED_BY  IS NULL OR UPPER(APPROVEDBY)  LIKE '%' || UPPER(P_APPROVED_BY)  || '%')
         AND (P_STATUS       IS NULL OR STATUS             =  P_STATUS)
         AND (P_QAQC_STATUS  IS NULL OR QAQCSTATUS         =  P_QAQC_STATUS)
         AND (P_SEARCH       IS NULL OR
              UPPER(DOCID || ' ' || PROJECTCODE || ' ' || PROJECTNAME || ' ' ||
                    NVL(DISCIPLINE, '') || ' ' || NVL(SUBJECT, '') || ' ' ||
                    NVL(LOCATION, '')   || ' ' || NVL(CONTRACTOR, '')
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
      OPEN P_CURSOR FOR SELECT * FROM DUAL WHERE 1 = 0;
  END SP_GET_WIR_LIST;

  PROCEDURE SP_GET_WIR_PDF_DATA (
    P_DOCID        IN  VARCHAR2,
    P_HEADER       OUT SYS_REFCURSOR,
    P_SUBLOCATIONS OUT SYS_REFCURSOR,
    P_FALLBACK     OUT SYS_REFCURSOR,
    P_CHAIN        OUT SYS_REFCURSOR,
    P_BRANCH_LOGO  OUT SYS_REFCURSOR,
    P_CLIENT_LOGO  OUT SYS_REFCURSOR,
    P_CONS_LOGO    OUT SYS_REFCURSOR,
    P_SIG_CON      OUT SYS_REFCURSOR,
    P_SIG_QAQC     OUT SYS_REFCURSOR,
    P_SIG_INS      OUT SYS_REFCURSOR,
    P_SIG_APP      OUT SYS_REFCURSOR,
    P_SIG_REC      OUT SYS_REFCURSOR
  ) IS
    V_DOCID VARCHAR2(400) := TRIM(P_DOCID);
  BEGIN

    -- -- Master Data 1 : header ---------------------------------------------
    OPEN P_HEADER FOR
      SELECT PM.PROJECTCODE,
             PM.PROJECTNAME,
             NULL                                AS SUBCONTRACTOR,
             TO_CHAR(A.DOCDATE, 'DD/MM/YYYY')    AS DOCDATE,
             A.DOCID,
             A.CREATEDON                         AS CDT,
             OLDWIRDOCID,
             REVNO,
             D.TYPEVALUE                         AS DISCIPLINE,
             SUBJECT,
             LOCATION,
             DWGSPECREF,
             WORKINSPECTED,
             CONEMPID,
             CONTRACTORPM,
             PMAPP,
             PMAPPDATE,
             CONQAQCEMPID,
             CONTRACTORQAQC,
             CASE
               WHEN QAQCAPP = 'YES' THEN 'ACCEPTED'
               WHEN QAQCAPP = 'NO'  THEN 'NO'
               ELSE 'REJECTED'
             END                                 AS QAQCAPP,
             QAQCAPPDATE,
             NULL                                AS SUBCONPM,
             NULL                                AS SCPMAPP,
             NULL                                AS SCPMAPPDATE,
             COMMENTS,
             ATTENDEES,
             OATTENDEES,
             INSEMPID,
             INSAPP,
             IDESIG,
             IDATE,
             APPEMPID,
             APP,
             ADESIG,
             ADATE,
             RECEMPID,
             RECAPP,
             RECEIVEDBY,
             RDESIGNATION,
             A.RDATE,
             INSPECTTIME,
             C.BRANCHNAME                        AS CONTRACTOR,
             INSPECTEDBY,
             APPROVEDBY,
             CASE WHEN COMMENTS = 'Code 1 - APPROVED. Work can proceed' THEN 1 ELSE 0 END AS T1,
             CASE WHEN COMMENTS = 'Code 2 - APPROVED WITH COMMENTS. Work can proceed incorporating comments' THEN 1 ELSE 0 END AS T2,
             CASE WHEN COMMENTS = 'Code 3 - APPROVED WITH COMMENTS. Work can proceed. Revise and resubmit' THEN 1 ELSE 0 END AS T3,
             CASE WHEN COMMENTS = 'Code R - NOT APPROVED for reason noted below' THEN 1 ELSE 0 END AS T4,
             CASE WHEN COMMENTS = 'Code 2 - APPROVED WITH COMMENTS. Work can proceed incorporating comments' AND ENCLOSEDNOTES = 'T' THEN 1 ELSE 0 END AS T22,
             CASE WHEN COMMENTS = 'Code 3 - APPROVED WITH COMMENTS. Work can proceed. Revise and resubmit' AND ENCLOSEDNOTES = 'T' THEN 1 ELSE 0 END AS T33,
             CASE WHEN COMMENTS = 'Code R - NOT APPROVED for reason noted below' AND ENCLOSEDNOTES = 'T' THEN 1 ELSE 0 END AS T44,
             PM.PROJECTCODE || ' - ' || UPPER(PROJBILLNAME) AS PNAME,
             UPPER(CONST)                        AS CONSTS,
             CONSTPREFIX,
             SUBCONTACTPERSON,
             ZONE,
             LLEVEL
        FROM ADK2026.INSPREQHDR A
        JOIN ADK2026.PROJECTMASTER PM
          ON A.PROJECTCODE = PM.PROJECTMASTERID
        LEFT JOIN ADK2026.BRANCH C
          ON PM.BRANCHNAME = C.BRANCHID
        LEFT JOIN (SELECT GLOBALTYPEMASTERID, TYPEVALUE
                     FROM ADK2026.GLOBALTYPEMASTER
                    WHERE CANCEL = 'F'
                      AND TYPE   = 'DISCIPLINE') D
          ON D.GLOBALTYPEMASTERID = A.DISCIPLINE
       WHERE A.CANCEL = 'F'
         AND TRIM(A.DOCID) = V_DOCID;

    -- -- Master Data 5 : sub locations --------------------------------------
    OPEN P_SUBLOCATIONS FOR
      SELECT INSPREQDTLROW,
             SUBLOCATION,
             RCOMMENTS
        FROM ADK2026.INSPREQHDR IH,
             ADK2026.INSPREQDTL ID
       WHERE IH.INSPREQHDRID = ID.INSPREQHDRID
         AND IH.CANCEL = 'F'
         AND TRIM(IH.DOCID) = V_DOCID
       ORDER BY INSPREQDTLROW;

    -- -- Header-level comments (when the WIR has no detail rows) ------------
    OPEN P_FALLBACK FOR
      SELECT 1              AS INSPREQDTLROW,
             NULL           AS SUBLOCATION,
             IH.RECCOMMENTS,
             IH.APPCOMMENTS,
             IH.INSCOMMENTS
        FROM ADK2026.INSPREQHDR IH
        LEFT JOIN ADK2026.INSPREQDTL ID
          ON IH.INSPREQHDRID = ID.INSPREQHDRID
       WHERE IH.CANCEL = 'F'
         AND NVL(ID.INSPREQDTLID, 0) = 0
         AND TRIM(IH.DOCID) = V_DOCID;

    -- -- Master Data 3 : approval-chain designations ------------------------
    OPEN P_CHAIN FOR
      SELECT I.DOCID,
             I.ATTENDEES,
             I.OATTENDEES,
             I.CONEMPID,
             E1.EMPNAME     AS CONCEMPNAME,
             FA.FDESIG,
             E2.EMPNAME     AS SECEMPNAME,
             SA.SDESIG,
             I.INSEMPID     AS INSPECTEDBY,
             E4.EMPNAME     AS FRTHEMPNAME,
             I.INSAPP,
             FO.FODESIG,
             I.IDATE,
             I.APPEMPID     AS APPROVEDBY,
             I.APP,
             FI.FIDESIG,
             I.ADATE,
             I.RECEIVEDBY,
             E5.EMPNAME     AS FIFTHEMPNAME,
             I.RECAPP,
             FA.FDESIG      AS RECEIVEDDESIGNATION,
             I.RDATE
        FROM ADK2026.INSPREQHDR I
        LEFT JOIN (SELECT H.PROJECTCODE, B.FIEMP, B.FDESIG
                     FROM ADK2026.TRANSAPPCTRLHDR H
                     JOIN ADK2026.TRANSFIRSTAPPCTRL B
                       ON H.TRANSAPPCTRLHDRID = B.TRANSAPPCTRLHDRID
                    WHERE B.FACTIVE = 'YES'
                      AND H.TTYPE   = 'QAQC'
                      AND H.TNAME   = 'qwir') FA
          ON FA.PROJECTCODE = I.PROJECTCODE
         AND FA.FIEMP       = I.CONEMPID
        LEFT JOIN ADK2026.EMPMAST E1
          ON E1.EMPID = I.CONEMPID
        LEFT JOIN (SELECT H.PROJECTCODE, B.SEEMP, B.SDESIG
                     FROM ADK2026.TRANSAPPCTRLHDR H
                     JOIN ADK2026.TRANSECOUNDAPPCTRL B
                       ON H.TRANSAPPCTRLHDRID = B.TRANSAPPCTRLHDRID
                    WHERE B.SEACTIVE = 'YES'
                      AND H.TTYPE    = 'QAQC'
                      AND H.TNAME    = 'qwir') SA
          ON SA.PROJECTCODE = I.PROJECTCODE
         AND SA.SEEMP       = I.CONQAQCEMPID
        LEFT JOIN ADK2026.EMPMAST E2
          ON E2.EMPID = I.CONQAQCEMPID
        LEFT JOIN (SELECT H.PROJECTCODE, B.FOEMP, B.FODESIG
                     FROM ADK2026.TRANSAPPCTRLHDR H
                     JOIN ADK2026.TRANSFOURTHAPPCTRL B
                       ON H.TRANSAPPCTRLHDRID = B.TRANSAPPCTRLHDRID
                    WHERE B.FOACTIVE = 'YES'
                      AND H.TTYPE    = 'QAQC'
                      AND H.TNAME    = 'qwir') FO
          ON FO.PROJECTCODE = I.PROJECTCODE
         AND FO.FOEMP       = I.INSEMPID
        LEFT JOIN ADK2026.EMPMAST E4
          ON E4.EMPID = I.INSEMPID
        LEFT JOIN (SELECT H.PROJECTCODE, B.FIVEEMP, B.FIDESIG
                     FROM ADK2026.TRANSAPPCTRLHDR H
                     JOIN ADK2026.TRANSFIFTHAPPCTRL B
                       ON H.TRANSAPPCTRLHDRID = B.TRANSAPPCTRLHDRID
                    WHERE B.FIVEACTIVE = 'YES'
                      AND H.TTYPE      = 'QAQC'
                      AND H.TNAME      = 'qwir') FI
          ON FI.PROJECTCODE = I.PROJECTCODE
         AND FI.FIVEEMP     = I.APPEMPID
        LEFT JOIN ADK2026.EMPMAST E5
          ON E5.EMPID = I.APPEMPID
       WHERE TRIM(I.DOCID) = V_DOCID
       FETCH FIRST 1 ROWS ONLY;

    -- -- Logos --------------------------------------------------------------
    OPEN P_BRANCH_LOGO FOR
      SELECT IMG
        FROM ADK2026.BRANCOMPLOGO  BL,
             ADK2026.BRANCH        B,
             ADK2026.PROJECTMASTER P,
             ADK2026.INSPREQHDR    C
       WHERE BL.RECORDID = B.BRANCHID
         AND P.BRANCHNAME = B.BRANCHID
         AND P.PROJECTMASTERID = C.PROJECTCODE
         AND TRIM(C.DOCID) = V_DOCID
       FETCH FIRST 1 ROWS ONLY;

    OPEN P_CLIENT_LOGO FOR
      SELECT IMG
        FROM ADK2026.PROJCLIENTLOGO PL,
             ADK2026.PROJECTMASTER  PM,
             ADK2026.INSPREQHDR     C
       WHERE PM.PROJECTMASTERID = PL.RECORDID
         AND BLOBNO = 1
         AND PM.PROJECTMASTERID = C.PROJECTCODE
         AND TRIM(C.DOCID) = V_DOCID
       FETCH FIRST 1 ROWS ONLY;

    OPEN P_CONS_LOGO FOR
      SELECT IMG
        FROM ADK2026.PROJCONSULTANTLOGO PL,
             ADK2026.PROJECTMASTER      PM,
             ADK2026.INSPREQHDR         C
       WHERE PM.PROJECTMASTERID = PL.RECORDID
         AND BLOBNO = 1
         AND PM.PROJECTMASTERID = C.PROJECTCODE
         AND TRIM(C.DOCID) = V_DOCID
       FETCH FIRST 1 ROWS ONLY;

    -- -- Signatures (one per approval role) ---------------------------------
    OPEN P_SIG_CON FOR
      SELECT B.IMG AS IMG, E.EMPID AS EMPID, E.EMPNAME AS EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1    B,
             ADK2026.INSPREQHDR   S1,
             ADK2026.EMPMAST      E
       WHERE A.SIGNATUREHDRID = B.RECORDID
         AND E.EMPMASTID      = A.EMPID
         AND S1.CONEMPID      = E.EMPID
         AND TRIM(S1.DOCID)   = V_DOCID
         AND BLOBNO = 1
       FETCH FIRST 1 ROWS ONLY;

    OPEN P_SIG_QAQC FOR
      SELECT B.IMG AS IMG, E.EMPID AS EMPID, E.EMPNAME AS EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1    B,
             ADK2026.INSPREQHDR   S1,
             ADK2026.EMPMAST      E
       WHERE A.SIGNATUREHDRID = B.RECORDID
         AND E.EMPMASTID      = A.EMPID
         AND S1.CONQAQCEMPID  = E.EMPID
         AND TRIM(S1.DOCID)   = V_DOCID
         AND BLOBNO = 1
       FETCH FIRST 1 ROWS ONLY;

    OPEN P_SIG_INS FOR
      SELECT B.IMG AS IMG, E.EMPID AS EMPID, E.EMPNAME AS EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1    B,
             ADK2026.INSPREQHDR   S1,
             ADK2026.EMPMAST      E
       WHERE A.SIGNATUREHDRID = B.RECORDID
         AND E.EMPMASTID      = A.EMPID
         AND S1.INSEMPID      = E.EMPID
         AND TRIM(S1.DOCID)   = V_DOCID
         AND BLOBNO = 1
       FETCH FIRST 1 ROWS ONLY;

    OPEN P_SIG_APP FOR
      SELECT B.IMG AS IMG, E.EMPID AS EMPID, E.EMPNAME AS EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1    B,
             ADK2026.INSPREQHDR   S1,
             ADK2026.EMPMAST      E
       WHERE A.SIGNATUREHDRID = B.RECORDID
         AND E.EMPMASTID      = A.EMPID
         AND S1.APPEMPID      = E.EMPID
         AND TRIM(S1.DOCID)   = V_DOCID
         AND BLOBNO = 1
       FETCH FIRST 1 ROWS ONLY;

    OPEN P_SIG_REC FOR
      SELECT B.IMG AS IMG, E.EMPID AS EMPID, E.EMPNAME AS EMPNAME
        FROM ADK2026.SIGNATUREHDR A,
             ADK2026.SIGNMIMG1    B,
             ADK2026.INSPREQHDR   S1,
             ADK2026.EMPMAST      E
       WHERE A.SIGNATUREHDRID = B.RECORDID
         AND E.EMPMASTID      = A.EMPID
         AND S1.RECEMPID      = E.EMPID
         AND TRIM(S1.DOCID)   = V_DOCID
         AND BLOBNO = 1
       FETCH FIRST 1 ROWS ONLY;

  END SP_GET_WIR_PDF_DATA;

END PKG_ADK_WIR;
/
