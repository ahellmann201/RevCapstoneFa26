import pyodbc

from ..entities import Ball


class BallRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, ball: Ball) -> Ball:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO balls (
                user_id,
                ball_name,
                weight,
                color,
                core_type
            )
            OUTPUT INSERTED.ball_id
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                ball.user_id,
                ball.ball_name,
                ball.weight,
                ball.color,
                ball.core_type
            )
        )

        ball.ball_id = cursor.fetchone()[0]
        self.conn.commit()

        return ball

    def get_by_id(self, ball_id: int) -> Ball | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT ball_id, user_id, ball_name, weight, color, core_type
            FROM balls
            WHERE ball_id = ?
            """,
            (ball_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return Ball(
            ball_id=row[0],
            user_id=row[1],
            ball_name=row[2],
            weight=row[3],
            color=row[4],
            core_type=row[5]
        )

    def get_by_user(self, user_id: int) -> list[Ball]:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT ball_id, user_id, ball_name, weight, color, core_type
            FROM balls
            WHERE user_id = ?
            ORDER BY ball_id
            """,
            (user_id,)
        )

        return [
            Ball(
                ball_id=row[0],
                user_id=row[1],
                ball_name=row[2],
                weight=row[3],
                color=row[4],
                core_type=row[5]
            )
            for row in cursor.fetchall()
        ]

    def update(self, ball: Ball) -> None:
        self.conn.cursor().execute(
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
        self.conn.cursor().execute(
            "DELETE FROM balls WHERE ball_id = ?",
            (ball_id,)
        )

        self.conn.commit()
