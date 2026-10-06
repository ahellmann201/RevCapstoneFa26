from entities import User,Hand
import sqlite3

class UserRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    
    
    def create(self, user: User):
        row = self.conn.execute(
            """
            INSERT INTO users(display_name,username,password,email,main_hand)
            VALUES (?,?,?,?,?)
        """,(user.display_name,user.username,password,user.email,user.main_hand.value if user.main_hand else None)
        )

        self.conn.commit()

        user.user_id = cursor.lastrowid

        return user

    
    
    def get_by_id(self, user_id: int) -> User | None:
        row = self.conn.execute(
            """
            SELECT user_id, display_name, username, email, main_hand
            FROM users
            WHERE user_id = ?

        """,(user_id,)
        ).fetchone()

        if row is None:
            return None

        return User(
            user_id=row[0],
            display_name=row[1],
            username=row[2],
            email=row[3],
            main_hand=Hand(row[4] if row[4] is not None else None)
        )

    
    
    def get_by_username(self, username: str) -> User | None:
        row = self.conn.execute(
            """
            SELECT user_id,display_name,username,email,main_hand
            FROM users
            WHERE username = ?
        """,(username)
        ).fetchone()

        if row is None:
            return None

        return User(
            user_id=row[0],
            display_name=row[1],
            username=row[2],
            email=row[3],
            main_hand=Hand(row[4] if row[4] is not None else None)
        )

    
    
    def update(self, user: User)->None:
        self.conn.execute(
            """
            UPDATE users
            SET display_name = ?,
                username = ?,
                email = ?,
                main_hand = ?
            WHERE user_id = ?
        """, (user.display_name, user.username,user.email,user.main_hand.value if user.main_hand else None)
        )

        self.conn.commit()

    
    
    def delete(self, user: User)-> None:
        self.conn.execute(
            """
            DELETE FROM users
            WHERE user_id = ?
        """,(user.user_id,)
        )

        self.conn.commit()