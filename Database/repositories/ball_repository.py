import sqlite3

from entities import Ball


class BallRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, ball: Ball) -> Ball:
        cursor = self.conn.execute(
            """
            INSERT INTO balls (
                ball_name,
                weight,
                color,
                core_type
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                ball.ball_name,
                ball.weight,
                ball.color,
                ball.core_type
            )
        )

        self.conn.commit()
        ball.ball_id = cursor.lastrowid

        return ball

    def get_by_id(self, ball_id: int) -> Ball | None:
        row = self.conn.execute(
            """
            SELECT ball_id, ball_name, weight, color, core_type
            FROM balls
            WHERE ball_id = ?
            """,
            (ball_id,)
        ).fetchone()

        if row is None:
            return None

        return Ball(
            ball_id=row[0],
            ball_name=row[1],
            weight=row[2],
            color=row[3],
            core_type=row[4]
        )

    def update(self, ball: Ball) -> None:
        self.conn.execute(
            """
            UPDATE balls
            SET ball_name = ?,
                weight = ?,
                color = ?,
                core_type = ?
            WHERE ball_id = ?
            """,
            (
                ball.ball_name,
                ball.weight,
                ball.color,
                ball.core_type,
                ball.ball_id
            )
        )

        self.conn.commit()

    def delete(self, ball_id: int) -> None:
        self.conn.execute(
            """
            DELETE FROM balls
            WHERE ball_id = ?
            """,
            (ball_id,)
        )

        self.conn.commit()