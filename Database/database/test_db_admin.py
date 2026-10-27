"""Explicit lifecycle commands for the local SQLite test database."""

import sqlite3
import sys
from contextlib import closing
from pathlib import Path

from dotenv import dotenv_values

from Database.database.sqlite_schema import initialize_schema


PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXPECTED_DATABASE_PATH = PROJECT_ROOT / "test_database" / "revmetrix_test.db"
SEED_FILE = Path(__file__).with_name("sqlite_seed.sql")
EXPECTED_TABLES = {
    "users",
    "clients",
    "master_locations",
    "user_establishments",
    "balls",
    "events",
    "sessions",
    "games",
    "frames",
    "shots",
}


def configured_database_path() -> Path:
    config_path = PROJECT_ROOT / ".env.test"
    if not config_path.is_file():
        raise RuntimeError(".env.test is missing")

    config = dotenv_values(config_path)
    if config.get("DB_TYPE", "sqlite").strip().lower() != "sqlite":
        raise RuntimeError("The test database must use DB_TYPE=sqlite")

    configured_path = config.get("DB_PATH")
    if not configured_path:
        raise RuntimeError("DB_PATH is missing from .env.test")

    path = Path(configured_path)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    path = path.resolve()

    if path != EXPECTED_DATABASE_PATH.resolve():
        raise RuntimeError(
            "Refusing to manage a database outside the dedicated local test path: "
            "test_database/revmetrix_test.db"
        )

    return path


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize(path: Path) -> None:
    if not SEED_FILE.is_file():
        raise RuntimeError(f"Test database seed file is missing: {SEED_FILE}")

    with closing(connect(path)) as connection:
        initialize_schema(connection)
        connection.executescript(SEED_FILE.read_text(encoding="utf-8"))
    print(f"Initialized test database schema at {path}")
    print(f"Applied starter data from {SEED_FILE.name}")


def reset(path: Path) -> None:
    # The path is validated against the dedicated local test database above.
    print("Reset removes all data from test_database/revmetrix_test.db.")
    print("Stop the app before resetting so it releases any open database handles.")
    for suffix in ("", "-journal", "-wal", "-shm"):
        Path(f"{path}{suffix}").unlink(missing_ok=True)
    initialize(path)
    print("Test database reset; the schema and configured starter data were recreated.")


def status(path: Path) -> int:
    if not path.is_file():
        print("Test database is not initialized.")
        return 1

    try:
        with closing(connect(path)) as connection:
            tables = {
                row[0]
                for row in connection.execute(
                    """SELECT name FROM sqlite_master
                       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"""
                )
            }
            integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
            foreign_key_issues = connection.execute(
                "PRAGMA foreign_key_check"
            ).fetchall()

        missing_tables = sorted(EXPECTED_TABLES - tables)
        if integrity != "ok" or foreign_key_issues or missing_tables:
            print("Test database is present but needs repair or reset.")
            if integrity != "ok":
                print(f"Integrity check: {integrity}")
            if foreign_key_issues:
                print(f"Foreign key violations: {len(foreign_key_issues)}")
            if missing_tables:
                print(f"Missing tables: {', '.join(missing_tables)}")
            return 1

        print(f"Test database is healthy at {path}")
        print(f"Tables: {len(tables)}; rows are preserved.")
        return 0
    except sqlite3.DatabaseError as error:
        print(f"Test database cannot be read: {error}")
        print("Run npm run db:test:reset to recreate it.")
        return 1


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"init", "reset", "status"}:
        print("Usage: python -m Database.database.test_db_admin init|reset|status")
        return 2

    try:
        path = configured_database_path()
        action = sys.argv[1]
        if action == "init":
            initialize(path)
            return 0
        if action == "reset":
            reset(path)
            return 0
        return status(path)
    except (OSError, RuntimeError, sqlite3.DatabaseError) as error:
        print(f"Test database {sys.argv[1]} failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
