SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.shots', 'U') IS NULL
    THROW 50000, 'The shots table does not exist in the selected database.', 1;
IF COL_LENGTH('dbo.shots', 'foul') IS NULL
    ALTER TABLE dbo.shots ADD foul BIT NOT NULL DEFAULT 0 WITH VALUES;
COMMIT TRANSACTION;
GO
