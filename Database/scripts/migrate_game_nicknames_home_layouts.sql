-- Run against the approved application database after taking a backup.
-- Safe to repeat; preserves existing games and users.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.games', 'nickname') IS NULL
    ALTER TABLE dbo.games ADD nickname NVARCHAR(100) NULL;
IF OBJECT_ID('dbo.user_home_layouts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_home_layouts (
        user_id INT NOT NULL PRIMARY KEY REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        layout_version INT NOT NULL DEFAULT 1 CHECK (layout_version = 1),
        layout_json NVARCHAR(MAX) NOT NULL CHECK (ISJSON(layout_json) = 1),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
COMMIT;
