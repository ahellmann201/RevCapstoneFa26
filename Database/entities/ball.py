from dataclasses import dataclass


@dataclass
class Ball:
    ball_name: str
    weight: int | None = None
    color: str | None = None
    core_type: str | None = None
    ball_id: int | None = None