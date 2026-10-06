from dataclasses import dataclass


@dataclass
class Event:
    event_name: str
    average_score: float | None = None
    statistics: str | None = None
    event_type: str | None = None
    event_id: int | None = None