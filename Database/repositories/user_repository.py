import pyodbc

from entities import User, Hand


class UserRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, user: User, password_hash: bytes) -> User:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO users (
                display_name,
                username,
                password_hash,
                email,
                main_hand
            )
            OUTPUT INSERTED.user_id
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                user.display_name,
                user.username,
                password_hash,
                user.email,
                user.main_hand.value if user.main_hand else None
            )
        )

        user.user_id = cursor.fetchone()[0]
        self.conn.commit()

        return user

    def get_by_id(self, user_id: int) -> User | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT user_id, display_name, username, email, main_hand
            FROM users
            WHERE user_id = ?
            """,
            (user_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return User(
            user_id=row[0],
            display_name=row[1],
            username=row[2],
            email=row[3],
            main_hand=Hand(row[4]) if row[4] else None
        )

    def get_by_username(self, username: str) -> User | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT user_id, display_name, username, email, main_hand
            FROM users
            WHERE username = ?
            """,
            (username,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return User(
            user_id=row[0],
            display_name=row[1],
            username=row[2],
            email=row[3],
            main_hand=Hand(row[4]) if row[4] else None
        )

    def update(self, user: User) -> None:
        self.conn.cursor().execute(
            """
            UPDATE users
            SET display_name = ?,
                username = ?,
                email = ?,
                main_hand = ?
            WHERE user_id = ?
            """,
            (
                user.display_name,
                user.username,
                user.email,
                user.main_hand.value if user.main_hand else None,
                user.user_id
            )
        )

        self.conn.commit()

    def delete(self, user_id: int) -> None:
        self.conn.cursor().execute(
            "DELETE FROM users WHERE user_id = ?",
            (user_id,)
        )

        self.conn.commit()