"""Password reset storage for fresh databases and explicit migrations."""
SQLSERVER_RESET_SCHEMA = """
IF OBJECT_ID('dbo.password_resets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.password_resets (
        user_id INT PRIMARY KEY REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        issued_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
    );
END;
"""

SQLITE_RESET_SCHEMA = """
CREATE TABLE IF NOT EXISTS password_resets (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
"""
