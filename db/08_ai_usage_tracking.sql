------------------------------------------------------------------------------
-- 08_ai_usage_tracking.sql — read the AI usage audit trail.
--
-- No DDL required. Both AI features now write to TM_AI_CHAT_HISTORY:
--
--   Chatbot        SESSION_ID = a GUID              (one row per Q&A turn)
--   AI Insight     SESSION_ID = 'rpt-<EMPID>-<ts>'  (one row per report view)
--                  USER_MSG   = '[AI INSIGHT REPORT] role=... scope=... period=... source=...'
--                  AI_RESPONSE= the delivered markdown (source=generated), or a
--                               pointer line (source=cache)
--
-- So a report row is identified by SESSION_ID LIKE 'rpt-%' and a chat row by
-- everything else. Queries below use that split.
------------------------------------------------------------------------------

-- Q1. Every AI Insight report view, newest first (the main audit trail).
SELECT h.CREATED_DATE,
       h.EMPID,
       e.EMPLOYEENAME,
       e.DEPARTMENT,
       REGEXP_SUBSTR(DBMS_LOB.SUBSTR(h.USER_MSG, 400, 1), 'role=(\S+)', 1, 1, NULL, 1)   AS ROLE_USED,
       REGEXP_SUBSTR(DBMS_LOB.SUBSTR(h.USER_MSG, 400, 1), 'period=(\S+)', 1, 1, NULL, 1) AS PERIOD,
       REGEXP_SUBSTR(DBMS_LOB.SUBSTR(h.USER_MSG, 400, 1), 'source=(\S+)', 1, 1, NULL, 1) AS SOURCE,
       DBMS_LOB.GETLENGTH(h.AI_RESPONSE)                                                 AS REPORT_CHARS
  FROM TM_AI_CHAT_HISTORY h
  LEFT JOIN TM_DPR_EMPLOYEE_DETAILS e ON e.EMPID = h.EMPID
 WHERE h.SESSION_ID LIKE 'rpt-%'
 ORDER BY h.CREATED_DATE DESC;

-- Q2. Who uses the AI features, and how much (reports vs chat).
SELECT h.EMPID,
       e.EMPLOYEENAME,
       e.DEPARTMENT,
       COUNT(CASE WHEN h.SESSION_ID LIKE 'rpt-%' THEN 1 END)     AS REPORT_VIEWS,
       COUNT(CASE WHEN h.SESSION_ID NOT LIKE 'rpt-%' THEN 1 END) AS CHAT_TURNS,
       MIN(h.CREATED_DATE)                                       AS FIRST_USE,
       MAX(h.CREATED_DATE)                                       AS LAST_USE
  FROM TM_AI_CHAT_HISTORY h
  LEFT JOIN TM_DPR_EMPLOYEE_DETAILS e ON e.EMPID = h.EMPID
 GROUP BY h.EMPID, e.EMPLOYEENAME, e.DEPARTMENT
 ORDER BY REPORT_VIEWS DESC, CHAT_TURNS DESC;

-- Q3. Adoption by role: how many distinct people in each role ran a report.
SELECT REGEXP_SUBSTR(DBMS_LOB.SUBSTR(h.USER_MSG, 400, 1), 'role=(\S+)', 1, 1, NULL, 1) AS ROLE_USED,
       COUNT(*)                     AS REPORT_VIEWS,
       COUNT(DISTINCT h.EMPID)      AS DISTINCT_USERS
  FROM TM_AI_CHAT_HISTORY h
 WHERE h.SESSION_ID LIKE 'rpt-%'
 GROUP BY REGEXP_SUBSTR(DBMS_LOB.SUBSTR(h.USER_MSG, 400, 1), 'role=(\S+)', 1, 1, NULL, 1)
 ORDER BY REPORT_VIEWS DESC;

-- Q4. Daily AI usage trend (both features).
SELECT TRUNC(h.CREATED_DATE)                                     AS USE_DAY,
       COUNT(CASE WHEN h.SESSION_ID LIKE 'rpt-%' THEN 1 END)     AS REPORTS,
       COUNT(CASE WHEN h.SESSION_ID NOT LIKE 'rpt-%' THEN 1 END) AS CHAT_TURNS,
       COUNT(DISTINCT h.EMPID)                                   AS DISTINCT_USERS
  FROM TM_AI_CHAT_HISTORY h
 GROUP BY TRUNC(h.CREATED_DATE)
 ORDER BY USE_DAY DESC;

-- Q5. Employees who have NEVER opened their AI insight (engagement gap).
SELECT e.EMPID, e.EMPLOYEENAME, e.DEPARTMENT
  FROM TM_DPR_EMPLOYEE_DETAILS e
 WHERE TRIM(UPPER(e.CURRENTSTATUS)) = 'ACTIVE'
   AND TRIM(UPPER(NVL(e.IS_DPR,'N'))) = 'Y'
   AND NOT EXISTS (SELECT 1 FROM TM_AI_CHAT_HISTORY h
                    WHERE h.EMPID = e.EMPID AND h.SESSION_ID LIKE 'rpt-%')
 ORDER BY e.DEPARTMENT, e.EMPLOYEENAME;

-- Q6. Re-read exactly what a user was shown (useful when a rating is disputed).
--     Replace the CHAT_ID from Q1.
-- SELECT DBMS_LOB.SUBSTR(AI_RESPONSE, 32000, 1) FROM TM_AI_CHAT_HISTORY WHERE CHAT_ID = <id>;

------------------------------------------------------------------------------
-- HOUSEKEEPING (optional)
-- Fresh CED reports are large (~50-100KB of markdown each). If TM_AI_CHAT_HISTORY
-- grows too fast, keep the audit row but drop the stored body for old reports —
-- CED/HOD reports also live in TM_AI_MONTHLY_REPORT, so only employee reports
-- are unique to this table.
--
-- UPDATE TM_AI_CHAT_HISTORY
--    SET AI_RESPONSE = '(body purged ' || TO_CHAR(SYSDATE,'YYYY-MM-DD') || ')'
--  WHERE SESSION_ID LIKE 'rpt-%'
--    AND CREATED_DATE < ADD_MONTHS(SYSDATE, -6)
--    AND DBMS_LOB.GETLENGTH(AI_RESPONSE) > 1000;
-- COMMIT;
--
-- Check current footprint first:
SELECT COUNT(*)                                     AS REPORT_ROWS,
       ROUND(SUM(DBMS_LOB.GETLENGTH(AI_RESPONSE))/1024/1024, 1) AS TOTAL_MB
  FROM TM_AI_CHAT_HISTORY
 WHERE SESSION_ID LIKE 'rpt-%';
