import pyodbc

from entities import Event


class EventRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, event: Event) -> Event:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO events (
                user_id,
                event_name,
                event_type,
                location_id
            )
            OUTPUT INSERTED.event_id
            VALUES (?, ?, ?, ?)
            """,
            (
                event.user_id,
                event.event_name,
                event.event_type,
                event.location_id
            )
        )

        event.event_id = cursor.fetchone()[0]
        self.conn.commit()

        return event

    def get_by_id(self, event_id: int) -> Event | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT event_id, user_id, event_name, event_type, location_id
            FROM events
            WHERE event_id = ?
            """,
            (event_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return Event(
            event_id=row[0],
            user_id=row[1],
            event_name=row[2],
            event_type=row[3],
            location_id=row[4]
        )

    def get_by_user(self, user_id: int) -> list[Event]:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT event_id, user_id, event_name, event_type, location_id
            FROM events
            WHERE user_id = ?
            ORDER BY event_id
            """,
            (user_id,)
        )

        return [
            Event(
                event_id=row[0],
                user_id=row[1],
                event_name=row[2],
                event_type=row[3],
                location_id=row[4]
            )
            for row in cursor.fetchall()
        ]

    def update(self, event: Event) -> None:
        self.conn.cursor().execute(
            """
            UPDATE events
            SET event_name = ?,
                event_type = ?,
                location_id = ?
            WHERE event_id = ?
            """,
            (
                event.event_name,
                event.event_type,
                event.location_id,
                event.event_id
            )
        )

        self.conn.commit()

    def delete(self, event_id: int) -> None:
        self.conn.cursor().execute(
            "DELETE FROM events WHERE event_id = ?",
            (event_id,)
        )

        self.conn.commit()