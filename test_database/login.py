from test_database.connection import get_connection


def validate_login(email: str, password: str) -> int | None:
    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT User_ID
            FROM USERS
            WHERE Email = ? AND Password = ?
            """,
            (email, password)
        )

        user = cursor.fetchone()

        if user is None:
            return None

        return user["User_ID"]

    finally:
        conn.close()