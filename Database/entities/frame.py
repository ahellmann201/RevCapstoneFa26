from dataclasses import dataclass


@dataclass
class Frame:
    frame_result: int | None = None
    frame_id: int | None = None