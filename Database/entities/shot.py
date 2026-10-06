from dataclasses import dataclass,field
from enum import Enum

class ThrowType(str, Enum):
    pass


@dataclass
class Shot:
    throw_type: ThrowType | None = None
    pin_leave: list[int] = field(default_factory=list)
    side: str | None = None
    position: str | None = None
    comment: str | None = None
    ball_id: int | None = None
    shot_id: int | None = None
