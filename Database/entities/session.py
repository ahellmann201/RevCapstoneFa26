from dataclasses import dataclass
from datetime import datetime


@dataclass
class Session:
    date_time: datetime | None = None
    opponent: str | None = None
    score: int | None = None
    stats: str | None = None
    record: int | None = None
    session_id: int | None = None