import sqlite3

from entities import Game


class GameRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create(self, game: Game) -> Game:
        cursor = self.conn.execute(
            """
            INSERT INTO games (
                lane_number,
                game_score,
                game_result
            )
            VALUES (?, ?, ?)
            """,
            (
                game.lane_number,
                game.game_score,
                game.game_result
            )
        )

        self.conn.commit()
        game.game_id = cursor.lastrowid

        return game

    def get_by_id(self, game_id: int) -> Game | None:
        row = self.conn.execute(
            """
            SELECT
                game_id,
                lane_number,
                game_score,
                game_result
            FROM games
            WHERE game_id = ?
            """,
            (game_id,)
        ).fetchone()

        if row is None:
            return None

        return Game(
            game_id=row[0],
            lane_number=row[1],
            game_score=row[2],
            game_result=row[3]
        )

    def update(self, game: Game) -> None:
        self.conn.execute(
            """
            UPDATE games
            SET lane_number = ?,
                game_score = ?,
                game_result = ?
            WHERE game_id = ?
            """,
            (
                game.lane_number,
                game.game_score,
                game.game_result,
                game.game_id
            )
        )

        self.conn.commit()

    def delete(self, game_id: int) -> None:
        self.conn.execute(
            """
            DELETE FROM games
            WHERE game_id = ?
            """,
            (game_id,)
        )

        self.conn.commit()