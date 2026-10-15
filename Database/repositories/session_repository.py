import pyodbc

from ..entities import Session


class SessionRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, session: Session) -> Session:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO sessions (
                event_id,
                establishment_id,
                date_time,
                opponent,
                score,
                record
            )
            OUTPUT INSERTED.session_id
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session.event_id,
                session.establishment_id,
                session.date_time,
                session.opponent,
                session.score,
                session.record
            )
        )

        session.session_id = cursor.fetchone()[0]
        self.conn.commit()

        return session

    def get_by_id(self, session_id: int) -> Session | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT
                session_id,
                event_id,
                establishment_id,
                date_time,
                opponent,
                score,
                record
            FROM sessions
            WHERE session_id = ?
            """,
            (session_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return Session(
            session_id=row[0],
            event_id=row[1],
            establishment_id=row[2],
            date_time=row[3],
            opponent=row[4],
            score=row[5],
            record=row[6]
        )

    def get_by_event(self, event_id: int) -> list[Session]:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT
                session_id,
                event_id,
                establishment_id,
                date_time,
                opponent,
                score,
                record
            FROM sessions
            WHERE event_id = ?
            ORDER BY date_time
            """,
            (event_id,)
        )

        return [
            Session(
                session_id=row[0],
                event_id=row[1],
                establishment_id=row[2],
                date_time=row[3],
                opponent=row[4],
                score=row[5],
                record=row[6]
            )
            for row in cursor.fetchall()
        ]

    def update(self, session: Session) -> None:
        self.conn.cursor().execute(
            """
            UPDATE sessions
            SET event_id = ?,
                establishment_id = ?,
                date_time = ?,
                opponent = ?,
                score = ?,
                record = ?
            WHERE session_id = ?
            """,
            (
                session.event_id,
                session.establishment_id,
                session.date_time,
                session.opponent,
                session.score,
                session.record,
                session.session_id
            )
        )

        self.conn.commit()

    def delete(self, session_id: int) -> None:
        self.conn.cursor().execute(
            "DELETE FROM sessions WHERE session_id = ?",
            (session_id,)
        )

        self.conn.commit()
