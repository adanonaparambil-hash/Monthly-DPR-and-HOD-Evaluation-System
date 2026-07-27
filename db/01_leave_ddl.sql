------------------------------------------------------------------------------
-- 01_leave_ddl.sql  — run ONCE, before compiling the package changes.
--
-- 1) New GTT to hold each eligible employee's leave spans for the session
--    (populated by SP_GET_CED_DPR_DASHBOARD on every call).
-- 2) New column on GT_DPR_EMP to expose leave days per employee.
--
-- NOTE: altering a GTT fails with ORA-14450 while any session is using it.
--       Run when the API app-pool is stopped / no dashboard calls in flight.
------------------------------------------------------------------------------

CREATE GLOBAL TEMPORARY TABLE GT_DPR_LEAVE
(
    EMPID    VARCHAR2(20 CHAR) NOT NULL,   -- human code, same as GT_DPR_EMP.EMPID
    LV_FROM  DATE              NOT NULL,   -- span already clipped to window+DOJ
    LV_TO    DATE              NOT NULL
)
ON COMMIT PRESERVE ROWS;

CREATE INDEX IX_GT_DPR_LEAVE ON GT_DPR_LEAVE (EMPID, LV_FROM, LV_TO);

ALTER TABLE GT_DPR_EMP ADD (LEAVE_DAYS NUMBER DEFAULT 0);
