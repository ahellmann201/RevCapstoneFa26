import sqlite3

from entities import Event


class EventRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, event: Event) -> Event:
        cursor = self.conn.execute(
            """
            INSERT INTO events (
                event_name,
                average_score,
                statistics,
                event_type
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                event.event_name,
                event.average_score,
                event.statistics,
                event.event_type
            )
        )

        self.conn.commit()
        event.event_id = cursor.lastrowid

        return event

    def get_by_id(self, event_id: int) -> Event | None:
        row = self.conn.execute(
            """
            SELECT
                event_id,
                event_name,
                average_score,
                statistics,
                event_type
            FROM events
            WHERE event_id = ?
            """,
            (event_id,)
        ).fetchone()

        if row is None:
            return None

        return Event(
            event_id=row[0],
            event_name=row[1],
            average_score=row[2],
            statistics=row[3],
            event_type=row[4]
        )

    def update(self, event: Event) -> None:
        self.conn.execute(
            """
            UPDATE events
            SET event_name = ?,
                average_score = ?,
                statistics = ?,
                event_type = ?
            WHERE event_id = ?
            """,
            (
                event.event_name,
                event.average_score,
                event.statistics,
                event.event_type,
                event.event_id
            )
        )

        self.conn.commit()

    def delete(self, event_id: int) -> None:
        self.conn.execute(
            """
            DELETE FROM events
            WHERE event_id = ?
            """,
            (event_id,)
        )

        self.conn.commit()