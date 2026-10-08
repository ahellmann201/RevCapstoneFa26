from dataclasses import dataclass


@dataclass
class Frame:
    game_id: int
    frame_number: int
    frame_result: int | None = None
    frame_id: int | None = None