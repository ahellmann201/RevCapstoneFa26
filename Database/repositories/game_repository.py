import pyodbc

from ..entities import Game


class GameRepository:
    def __init__(self, conn: pyodbc.Connection):
        self.conn = conn

    def create(self, game: Game) -> Game:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            INSERT INTO games (
                session_id,
                game_number,
                lane_number,
                game_score,
                game_result
            )
            OUTPUT INSERTED.game_id
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                game.session_id,
                game.game_number,
                game.lane_number,
                game.game_score,
                game.game_result
            )
        )

        game.game_id = cursor.fetchone()[0]
        self.conn.commit()

        return game

    def get_by_id(self, game_id: int) -> Game | None:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT
                game_id,
                session_id,
                game_number,
                lane_number,
                game_score,
                game_result
            FROM games
            WHERE game_id = ?
            """,
            (game_id,)
        )

        row = cursor.fetchone()

        if row is None:
            return None

        return Game(
            game_id=row[0],
            session_id=row[1],
            game_number=row[2],
            lane_number=row[3],
            game_score=row[4],
            game_result=row[5]
        )

    def get_by_session(self, session_id: int) -> list[Game]:
        cursor = self.conn.cursor()

        cursor.execute(
            """
            SELECT
                game_id,
                session_id,
                game_number,
                lane_number,
                game_score,
                game_result
            FROM games
            WHERE session_id = ?
            ORDER BY game_number
            """,
            (session_id,)
        )

        return [
            Game(
                game_id=row[0],
                session_id=row[1],
                game_number=row[2],
                lane_number=row[3],
                game_score=row[4],
                game_result=row[5]
            )
            for row in cursor.fetchall()
        ]

    def update(self, game: Game) -> None:
        self.conn.cursor().execute(
            """
            UPDATE games
            SET game_number = ?,
                lane_number = ?,
                game_score = ?,
                game_result = ?
            WHERE game_id = ?
            """,
            (
                game.game_number,
                game.lane_number,
                game.game_score,
                game.game_result,
                game.game_id
            )
        )

        self.conn.commit()

    def delete(self, game_id: int) -> None:
        self.conn.cursor().execute(
            "DELETE FROM games WHERE game_id = ?",
            (game_id,)
        )

        self.conn.commit()
