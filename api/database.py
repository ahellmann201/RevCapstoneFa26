# api/database.py

from api.config import DB_TYPE

if DB_TYPE == "sqlite":
    from test_database.connection import get_connection
elif DB_TYPE == "sqlserver":
    from Database.database.connection import get_connection
else:
    raise RuntimeError(f"Unsupported database type: {DB_TYPE}")


def get_user_by_id(user_id: int):
    """Retrieve a user by ID from the configured database."""

    conn = get_connection()

    try:
        query = """
            SELECT User_ID, Username, Display_Name, Main_Hand
            FROM USERS
            WHERE User_ID = ?
        """

        row = conn.execute(query, (user_id,)).fetchone()

        if row is None:
            return None

        if DB_TYPE == "sqlite":
            return dict(row)

        return {
            "User_ID": row.User_ID,
            "Username": row.Username,
            "Display_Name": row.Display_Name,
        }

    finally:
        conn.close()