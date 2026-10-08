import pyodbc

from entities import Frame


class FrameRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, frame: Frame) -> Frame:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO frames (
                game_id,
                frame_number,
                frame_result
            )
            OUTPUT INSERTED.frame_id
            VALUES (?, ?, ?)
            """,
            (
                frame.game_id,
                frame.frame_number,
                frame.frame_result
            )
        )

        frame.frame_id = cursor.fetchone()[0]
        self.conn.commit()

        return frame

    def get_by_id(self, frame_id: int) -> Frame | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT frame_id, game_id, frame_number, frame_result
            FROM frames
            WHERE frame_id = ?
            """,
            (frame_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return Frame(
            frame_id=row[0],
            game_id=row[1],
            frame_number=row[2],
            frame_result=row[3]
        )

    def get_by_game(self, game_id: int) -> list[Frame]:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT frame_id, game_id, frame_number, frame_result
            FROM frames
            WHERE game_id = ?
            ORDER BY frame_number
            """,
            (game_id,)
        )

        return [
            Frame(
                frame_id=row[0],
                game_id=row[1],
                frame_number=row[2],
                frame_result=row[3]
            )
            for row in cursor.fetchall()
        ]

    def update(self, frame: Frame) -> None:
        self.conn.cursor().execute(
            """
            UPDATE frames
            SET frame_number = ?,
                frame_result = ?
            WHERE frame_id = ?
            """,
            (
                frame.frame_number,
                frame.frame_result,
                frame.frame_id
            )
        )

        self.conn.commit()

    def delete(self, frame_id: int) -> None:
        self.conn.cursor().execute(
            "DELETE FROM frames WHERE frame_id = ?",
            (frame_id,)
        )

        self.conn.commit()