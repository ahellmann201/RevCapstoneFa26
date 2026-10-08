from dataclasses import dataclass


@dataclass
class Event:
    user_id: int
    event_name: str
    event_type: str | None = None
    location_id: int | None = None
    event_id: int | None = None