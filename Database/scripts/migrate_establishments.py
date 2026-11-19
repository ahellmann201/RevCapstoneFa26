"""Explicit, repeatable SQL Server migration for establishment details.

Run from the repository root with --apply only against the intended database.
No migration runs implicitly during API startup.
"""
import argparse
from pathlib import Path

from dotenv import load_dotenv


FIELDS = {
    "nickname": "NVARCHAR(100) NULL",
    "type": "NVARCHAR(100) NULL",
    "phone": "NVARCHAR(50) NULL",
    "home_house": "BIT NOT NULL DEFAULT 0 WITH VALUES",
    "enabled": "BIT NOT NULL DEFAULT 1 WITH VALUES",
}


def migrate(connection):
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT OBJECT_ID('dbo.user_establishments', 'U')")
        if cursor.fetchone()[0] is None:
            raise RuntimeError("The user_establishments table must exist first")
        added = []
        for name, definition in FIELDS.items():
            cursor.execute("SELECT COL_LENGTH('dbo.user_establishments', ?)", (name,))
            if cursor.fetchone()[0] is None:
                # Column names/types come only from the fixed definitions above.
                cursor.execute(f"ALTER TABLE dbo.user_establishments ADD [{name}] {definition}")
                added.append(name)
        connection.commit()
        return added
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not args.apply:
        print("Adds missing establishment columns: " + ", ".join(FIELDS))
        print("Back up the intended SQL Server database, then rerun with --apply.")
        return 0
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    from Database.database.connection import DB_TYPE, get_connection
    if DB_TYPE != "sqlserver":
        print("Use npm run db:test:init for SQLite. This command requires SQL Server.")
        return 1
    connection = None
    try:
        connection = get_connection()
        added = migrate(connection)
        print("Migration complete. Added: " + (", ".join(added) or "none; already current"))
        return 0
    except Exception:
        print("Migration failed. Check database access and ALTER permissions; details withheld.")
        return 1
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
