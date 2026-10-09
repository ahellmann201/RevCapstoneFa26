from dataclasses import dataclass
from datetime import datetime


@dataclass
class Session:
    event_id: int | None = None
    establishment_id: int | None = None
    date_time: datetime | None = None
    opponent: str | None = None
    score: int | None = None
    record: int | None = None
    session_id: int | None = None