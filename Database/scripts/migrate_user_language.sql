SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.users', 'main_language') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD main_language NVARCHAR(10) NOT NULL
        CONSTRAINT DF_users_main_language DEFAULT N'en' WITH VALUES;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.users')
      AND name = N'CK_users_main_language'
)
BEGIN
    EXEC(N'ALTER TABLE dbo.users WITH CHECK ADD CONSTRAINT CK_users_main_language
        CHECK (main_language IN (N''en'', N''es'', N''fr'', N''de'', N''zh-CN''))');
END;
COMMIT TRANSACTION;
