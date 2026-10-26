from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, field_validator

from Database.api.resource_routes import Resource, add_resource_routes


router = APIRouter()

Id = Annotated[int, Field(ge=1, le=2147483647, strict=True)]
Number = Annotated[
    int,
    Field(ge=-2147483648, le=2147483647, strict=True),
]
PositiveNumber = Annotated[
    int,
    Field(ge=1, le=2147483647, strict=True),
]
Pin = Annotated[int, Field(ge=1, le=10, strict=True)]


class InputModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class LocationInput(InputModel):
    location_name: str = Field(min_length=1, max_length=255)
    lane_count: PositiveNumber | None = None
    address: str | None = Field(default=None, max_length=500)


class EstablishmentInput(InputModel):
    establishment_name: str = Field(min_length=1, max_length=255)
    lane_count: PositiveNumber | None = None
    address: str | None = Field(default=None, max_length=500)
    location_id: Id | None = None


class EventInput(InputModel):
    event_name: str = Field(min_length=1, max_length=255)
    event_type: str | None = Field(default=None, max_length=100)
    location_id: Id | None = None


class SessionInput(InputModel):
    # Required for API ownership, although nullable in the database.
    event_id: Id
    establishment_id: Id | None = None
    date_time: datetime | None = None
    opponent: str | None = Field(default=None, max_length=255)
    score: Number | None = None
    record: Number | None = None

    @field_validator("date_time")
    @classmethod
    def normalize_datetime(cls, value):
        # DATETIME2 has no timezone. Store UTC without an offset.
        # A supplied time without an offset is treated as UTC.
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)

        return value


class GameInput(InputModel):
    session_id: Id
    game_number: PositiveNumber
    lane_number: PositiveNumber | None = None
    game_score: int | None = Field(
        default=None,
        ge=0,
        le=300,
        strict=True,
    )
    game_result: Number | None = None


class FrameInput(InputModel):
    game_id: Id
    frame_number: int = Field(ge=1, le=10, strict=True)
    frame_result: Number | None = None


class ShotInput(InputModel):
    frame_id: Id
    shot_number: int = Field(ge=1, le=3, strict=True)
    throw_type: Literal["strike", "spare", "backup"] | None = None
    pin_leave: list[Pin] = Field(default_factory=list, max_length=10)
    side: str | None = Field(default=None, max_length=50)
    position: str | None = Field(default=None, max_length=50)
    comment: str | None = Field(default=None, max_length=1000)
    ball_id: Id | None = None

    @field_validator("pin_leave")
    @classmethod
    def unique_pins(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Pin numbers must not be repeated")

        return value


# Shared reference data: authenticated reads only.
locations = Resource(
    table="master_locations",
    key="location_id",
    path="/locations",
    model=LocationInput,
    scope="1 = 1",
    read_only=True,
)

establishments = Resource(
    table="user_establishments",
    key="establishment_id",
    path="/establishments",
    model=EstablishmentInput,
    scope="r.user_id = ?",
    direct_owner=True,
    references=(("location_id", locations),),
)

events = Resource(
    table="events",
    key="event_id",
    path="/events",
    model=EventInput,
    scope="r.user_id = ?",
    direct_owner=True,
    references=(("location_id", locations),),
)

# Sessions belong to the event's owner. If an establishment is linked,
# it must also belong to that owner.
session_ownership = """
    EXISTS (
        SELECT 1
        FROM events AS e
        WHERE e.event_id = r.event_id
          AND e.user_id = ?
          AND (
              r.establishment_id IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM user_establishments AS ue
                  WHERE ue.establishment_id = r.establishment_id
                    AND ue.user_id = e.user_id
              )
          )
    )
"""

sessions = Resource(
    table="sessions",
    key="session_id",
    path="/sessions",
    model=SessionInput,
    scope=session_ownership,
    references=(
        ("event_id", events),
        ("establishment_id", establishments),
    ),
)

# Reuse the same session ownership check for descendants.
# These substitutions use fixed application definitions only.
owned_session = session_ownership.replace("r.", "s.")

games = Resource(
    table="games",
    key="game_id",
    path="/games",
    model=GameInput,
    scope=f"""
        EXISTS (
            SELECT 1
            FROM sessions AS s
            WHERE s.session_id = r.session_id
              AND ({owned_session})
        )
    """,
    references=(("session_id", sessions),),
)

frames = Resource(
    table="frames",
    key="frame_id",
    path="/frames",
    model=FrameInput,
    scope=f"""
        EXISTS (
            SELECT 1
            FROM games AS g
            JOIN sessions AS s
              ON s.session_id = g.session_id
            WHERE g.game_id = r.game_id
              AND ({owned_session})
        )
    """,
    references=(("game_id", games),),
)

# Used only to validate shot references.
# Your existing balls router continues handling ball endpoints.
balls_reference = Resource(
    table="balls",
    key="ball_id",
    path="/balls",
    model=InputModel,
    scope="r.user_id = ?",
    direct_owner=True,
)

shots = Resource(
    table="shots",
    key="shot_id",
    path="/shots",
    model=ShotInput,
    scope=f"""
        EXISTS (
            SELECT 1
            FROM frames AS f
            JOIN games AS g
              ON g.game_id = f.game_id
            JOIN sessions AS s
              ON s.session_id = g.session_id
            WHERE f.frame_id = r.frame_id
              AND ({owned_session})
        )
    """,
    references=(
        ("frame_id", frames),
        ("ball_id", balls_reference),
    ),
)

for resource in (
    locations,
    establishments,
    events,
    sessions,
    games,
    frames,
    shots,
):
    add_resource_routes(router, resource)