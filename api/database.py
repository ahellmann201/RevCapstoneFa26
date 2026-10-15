# api/database.py

from api.config import DB_TYPE

# Select the configured adapter once; API handlers use the same repository
# functions regardless of whether development SQL Server or test SQLite is active.
if DB_TYPE == "sqlite":
    from test_database.connection import get_connection
elif DB_TYPE == "sqlserver":
    from Database.database.connection import get_connection
else:
    raise RuntimeError(f"Unsupported database type: {DB_TYPE}")


def get_user_by_id(user_id: int) -> dict | None:
    """Retrieve a user by ID and return a JSON-ready profile record.

    The API consumes a plain mapping rather than driver-specific row objects,
    which keeps response serialization consistent across SQLite and SQL Server.
    """

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT User_ID, Username, Display_Name, Main_Hand
            FROM USERS
            WHERE User_ID = ?
            """,
            (user_id,)
        )
        row = cursor.fetchone()

        if row is None:
            return None

        # SQLite rows are mapping-like; pyodbc rows expose named attributes.
        # Normalize both to the same API response shape.
        if DB_TYPE == "sqlite":
            return dict(row)

        return {
            "User_ID": row.User_ID,
            "Username": row.Username,
            "Display_Name": row.Display_Name,
        }

    finally:
        # Connections are short-lived for these simple requests; always release
        # them, including when query execution or row conversion raises.
        conn.close()


def update_display_name(user_id: int, display_name: str) -> bool:
    """Update a user's display name; return whether a row was changed."""

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE USERS
            SET Display_Name = ?
            WHERE User_ID = ?
            """,
            (display_name, user_id)
        )
        conn.commit()

        return cursor.rowcount > 0

    finally:
        conn.close()
