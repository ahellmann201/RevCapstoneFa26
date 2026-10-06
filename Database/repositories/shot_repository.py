import sqlite3

from entities import Shot, ThrowType


class ShotRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, shot: Shot) -> Shot:
        cursor = self.conn.execute(
            """
            INSERT INTO shots (
                throw_type,
                pin_leave,
                side,
                position,
                comment,
                ball_id
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                shot.throw_type.value if shot.throw_type else None,
                self._encode_pin_leave(shot.pin_leave),
                shot.side,
                shot.position,
                shot.comment,
                shot.ball_id
            )
        )

        self.conn.commit()

        shot.shot_id = cursor.lastrowid

        return shot

    def get_by_id(self, shot_id: int) -> Shot | None:
        row = self.conn.execute(
            """
            SELECT
                shot_id,
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
        ).fetchone()

        if row is None:
            return None

        return Shot(
            shot_id=row[0],
            throw_type=ThrowType(row[1]) if row[1] else None,
            pin_leave=self._decode_pin_leave(row[2]),
            side=row[3],
            position=row[4],
            comment=row[5],
            ball_id=row[6]
        )

    def update(self, shot: Shot) -> None:
        self.conn.execute(
            """
            UPDATE shots
            SET throw_type = ?,
                pin_leave = ?,
                side = ?,
                position = ?,
                comment = ?,
                ball_id = ?
            WHERE shot_id = ?
            """,
            (
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
        self.conn.execute(
            """
            DELETE FROM shots
            WHERE shot_id = ?
            """,
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

        pins = []

        for pin in range(1, 11):
            if mask & (1 << (pin - 1)):
                pins.append(pin)

        return pins