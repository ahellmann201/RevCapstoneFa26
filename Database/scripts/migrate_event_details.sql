SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.events', 'nickname') IS NULL
    ALTER TABLE dbo.events ADD nickname NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.events', 'week_day') IS NULL
    ALTER TABLE dbo.events ADD week_day NVARCHAR(9) NULL;
IF COL_LENGTH('dbo.events', 'start_time') IS NULL
    ALTER TABLE dbo.events ADD start_time CHAR(5) NULL;
IF COL_LENGTH('dbo.events', 'games_per_session') IS NULL
    ALTER TABLE dbo.events ADD games_per_session INT NOT NULL DEFAULT 3;
IF COL_LENGTH('dbo.events', 'enabled') IS NULL
    ALTER TABLE dbo.events ADD enabled BIT NOT NULL DEFAULT 1;
COMMIT TRANSACTION;
