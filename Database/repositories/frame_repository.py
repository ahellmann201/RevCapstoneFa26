import sqlite3

from entities import Frame


class FrameRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, frame: Frame) -> Frame:
        cursor = self.conn.execute(
            """
            INSERT INTO frames (
                frame_result
            )
            VALUES (?)
            """,
            (frame.frame_result,)
        )

        self.conn.commit()
        frame.frame_id = cursor.lastrowid

        return frame

    def get_by_id(self, frame_id: int) -> Frame | None:
        row = self.conn.execute(
            """
            SELECT frame_id, frame_result
            FROM frames
            WHERE frame_id = ?
            """,
            (frame_id,)
        ).fetchone()

        if row is None:
            return None

        return Frame(
            frame_id=row[0],
            frame_result=row[1]
        )

    def update(self, frame: Frame) -> None:
        self.conn.execute(
            """
            UPDATE frames
            SET frame_result = ?
            WHERE frame_id = ?
            """,
            (
                frame.frame_result,
                frame.frame_id
            )
        )

        self.conn.commit()

    def delete(self, frame_id: int) -> None:
        self.conn.execute(
            """
            DELETE FROM frames
            WHERE frame_id = ?
            """,
            (frame_id,)
        )

        self.conn.commit()