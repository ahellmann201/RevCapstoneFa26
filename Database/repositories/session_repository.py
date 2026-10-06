import sqlite3
from datetime import datetime

from entities import Session


class SessionRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, session: Session) -> Session:
        cursor = self.conn.execute(
            """
            INSERT INTO sessions (
                date_time,
                opponent,
                score,
                stats,
                record
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                session.date_time.isoformat()
                if session.date_time else None,
                session.opponent,
                session.score,
                session.stats,
                session.record
            )
        )

        self.conn.commit()
        session.session_id = cursor.lastrowid

        return session

    def get_by_id(self, session_id: int) -> Session | None:
        row = self.conn.execute(
            """
            SELECT
                session_id,
                date_time,
                opponent,
                score,
                stats,
                record
            FROM sessions
            WHERE session_id = ?
            """,
            (session_id,)
        ).fetchone()

        if row is None:
            return None

        return Session(
            session_id=row[0],
            date_time=datetime.fromisoformat(row[1])
            if row[1] else None,
            opponent=row[2],
            score=row[3],
            stats=row[4],
            record=row[5]
        )

    def update(self, session: Session) -> None:
        self.conn.execute(
            """
            UPDATE sessions
            SET date_time = ?,
                opponent = ?,
                score = ?,
                stats = ?,
                record = ?
            WHERE session_id = ?
            """,
            (
                session.date_time.isoformat()
                if session.date_time else None,
                session.opponent,
                session.score,
                session.stats,
                session.record,
                session.session_id
            )
        )

        self.conn.commit()

    def delete(self, session_id: int) -> None:
        self.conn.execute(
            """
            DELETE FROM sessions
            WHERE session_id = ?
            """,
            (session_id,)
        )

        self.conn.commit()