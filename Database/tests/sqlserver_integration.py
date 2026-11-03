"""Opt-in remote SQL Server integration test for a pre-provisioned test DB."""
import argparse
from contextlib import closing
import os
import secrets
from uuid import uuid4

from dotenv import dotenv_values

TEST_DATABASE = "revmetrix_integration_test"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    with open(args.config, encoding="utf-8") as config_file:
        config = dotenv_values(stream=config_file, interpolate=False)
    keys = ("DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD")
    if any(not config.get(key) for key in keys) or config["DB_NAME"] != TEST_DATABASE:
        parser.error(f"Provide all four DB settings and use only {TEST_DATABASE}.")
    os.environ.update({key: config[key] for key in keys})
    os.environ.update(DB_TYPE="sqlserver", JWT_SECRET=secrets.token_hex(32))
    from Database.database.connection import get_connection
    from Database.tests.api_scenario import run_scenario

    prefix = f"integration_{uuid4().hex}"
    usernames = (f"{prefix}_owner", f"{prefix}_other")
    with closing(get_connection()) as connection:
        with closing(connection.cursor()) as cursor:
            cursor.execute("SELECT DB_NAME()")
            if cursor.fetchone()[0] != TEST_DATABASE:
                raise RuntimeError("Connected database is not the dedicated integration database.")
            cursor.execute("SELECT TOP (0) nickname, [type], phone, home_house, enabled FROM dbo.user_establishments")
            cursor.execute("SELECT TOP (0) token_hash FROM dbo.password_resets")
    try:
        run_scenario(usernames)
    finally:
        with closing(get_connection()) as connection:
            with closing(connection.cursor()) as cursor:
                for username in usernames:
                    cursor.execute("""DELETE s FROM sessions AS s JOIN events AS e ON s.event_id = e.event_id
                        JOIN users AS u ON e.user_id = u.user_id WHERE u.username = ?""", (username,))
                    cursor.execute("DELETE e FROM events AS e JOIN users AS u ON e.user_id = u.user_id WHERE u.username = ?", (username,))
                    cursor.execute("DELETE FROM users WHERE username = ?", (username,))
                connection.commit()
    print("Remote SQL Server API scenario passed; test records cleaned up.")


if __name__ == "__main__":
    main()
