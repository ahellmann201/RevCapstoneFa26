"""Executed in a separate process so SQLite and SQL Server imports stay isolated."""
from Database.tests.api_scenario import run_scenario

from Database.database.connection import get_connection
from Database.database.sqlite_schema import initialize_schema


def main():
    connection = get_connection()
    initialize_schema(connection)
    connection.close()
    run_scenario(("owner", "other"))
    print("SQLite API save/reload, statistics, ownership, updates and cascades verified")


if __name__ == "__main__":
    main()
