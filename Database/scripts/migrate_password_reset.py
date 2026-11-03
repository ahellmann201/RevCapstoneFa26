"""Explicit additive SQL Server migration for password recovery."""
import argparse
from contextlib import closing
from pathlib import Path

from dotenv import load_dotenv

from Database.database.password_reset_schema import SQLSERVER_RESET_SCHEMA


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not args.apply:
        print(SQLSERVER_RESET_SCHEMA.strip())
        return
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    from Database.database.connection import DB_TYPE, get_connection
    if DB_TYPE != "sqlserver":
        parser.error("Use db:test:init for SQLite")
    with closing(get_connection()) as connection:
        with closing(connection.cursor()) as cursor:
            cursor.execute(SQLSERVER_RESET_SCHEMA)
            connection.commit()
    print("Password reset storage is ready.")


if __name__ == "__main__":
    main()
