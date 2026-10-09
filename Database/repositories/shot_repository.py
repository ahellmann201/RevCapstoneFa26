import pyodbc

from entities import Shot, ThrowType


class ShotRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, shot: Shot) -> Shot:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO shots (
                frame_id,
                shot_number,
                throw_type,
                pin_leave,
                side,
                position,
                comment,
                ball_id
            )
            OUTPUT INSERTED.shot_id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                shot.frame_id,
                shot.shot_number,
                shot.throw_type.value if shot.throw_type else None,
                self._encode_pin_leave(shot.pin_leave),
                shot.side,
                shot.position,
                shot.comment,
                shot.ball_id
            )
        )

        shot.shot_id = cursor.fetchone()[0]
        self.conn.commit()

        return shot

    def get_by_id(self, shot_id: int) -> Shot | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT
                shot_id,
                frame_id,
                shot_number,
                throw_type,
                pin_leave,
                side,
                position,
                comment,
                ball_id
            FROM shots
            WHERE shot_id = ?
            """,
            (shot_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return self._to_shot(row)

    def get_by_frame(self, frame_id: int) -> list[Shot]:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT
                shot_id,
                frame_id,
                shot_number,
                throw_type,
                pin_leave,
                side,
                position,
                comment,
                ball_id
            FROM shots
            WHERE frame_id = ?
            ORDER BY shot_number
            """,
            (frame_id,)
        )

        return [self._to_shot(row) for row in cursor.fetchall()]

    def update(self, shot: Shot) -> None:
        self.conn.cursor().execute(
            """
            UPDATE shots
            SET shot_number = ?,
                throw_type = ?,
                pin_leave = ?,
                side = ?,
                position = ?,
                comment = ?,
                ball_id = ?
            WHERE shot_id = ?
            """,
            (
                shot.shot_number,
                shot.throw_type.value if shot.throw_type else None,
                self._encode_pin_leave(shot.pin_leave),
                shot.side,
                shot.position,
                shot.comment,
                shot.ball_id,
                shot.shot_id
            )
        )

        self.conn.commit()

    def delete(self, shot_id: int) -> None:
        self.conn.cursor().execute(
            "DELETE FROM shots WHERE shot_id = ?",
            (shot_id,)
        )

        self.conn.commit()

    @staticmethod
    def _encode_pin_leave(pins: list[int]) -> int:
        mask = 0

        for pin in pins:
            if pin < 1 or pin > 10:
                raise ValueError(
                    f"Invalid pin number: {pin}. Pins must be 1-10."
                )

            mask |= 1 << (pin - 1)

        return mask

    @staticmethod
    def _decode_pin_leave(mask: int | None) -> list[int]:
        if mask is None:
            return []

        return [
            pin
            for pin in range(1, 11)
            if mask & (1 << (pin - 1))
        ]

    @classmethod
    def _to_shot(cls, row) -> Shot:
        return Shot(
            shot_id=row[0],
            frame_id=row[1],
            shot_number=row[2],
            throw_type=ThrowType(row[3]) if row[3] else None,
            pin_leave=cls._decode_pin_leave(row[4]),
            side=row[5],
            position=row[6],
            comment=row[7],
            ball_id=row[8]
        )