import os
import sqlite3
from pathlib import Path


DB_TYPE = os.getenv("DB_TYPE", "sqlserver").strip().lower()
PROJECT_ROOT = Path(__file__).resolve().parents[2]

if DB_TYPE == "sqlite":
    DatabaseError = sqlite3.Error
    IntegrityError = sqlite3.IntegrityError
else:
    import pyodbc

    DatabaseError = pyodbc.Error
    IntegrityError = pyodbc.IntegrityError


def get_connection():
    if DB_TYPE == "sqlite":
        configured_path = os.getenv("DB_PATH", "test_database/revmetrix_test.db")
        database_path = Path(configured_path)
        if not database_path.is_absolute():
            database_path = PROJECT_ROOT / database_path

        if not database_path.is_file():
            raise sqlite3.OperationalError(
                "Test database is missing; initialize it with npm run db:test:init"
            )

        connection = sqlite3.connect(
            f"{database_path.resolve().as_uri()}?mode=rw",
            uri=True,
            timeout=10,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    if DB_TYPE != "sqlserver":
        raise ValueError(f"Unsupported DB_TYPE: {DB_TYPE}")

    server = os.environ["DB_SERVER"]
    database = os.environ["DB_NAME"]
    username = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]

    connection_string = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
    )

    return pyodbc.connect(connection_string)
