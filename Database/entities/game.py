from dataclasses import dataclass


@dataclass
class Game:
    session_id: int
    game_number: int
    lane_number: int | None = None
    game_score: int | None = None
    game_result: int | None = None
    game_id: int | None = None