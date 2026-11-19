"""Authenticated, versioned home layout preferences (one per user)."""
import json
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, model_validator
from Database.api.resource_routes import UserDependency, database_cursor

router = APIRouter(prefix="/auth/me/home-layout", tags=["Account preferences"])
DEFAULT_LAYOUT = [{"id": "events", "slot": 0}, {"id": "game", "slot": 1}, {"id": "week", "slot": 2}]
MODULES = {name: (1, 1) for name in ("events", "game", "games", "sessions", "arsenal", "compare", "establishments", "archives", "stats", "ciclops", "smartDot", "smartWatch", "settings")}
MODULES["week"] = (2, 2)

class LayoutEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(max_length=32)
    slot: int = Field(ge=0, le=11, strict=True)
    size: Literal["small", "large"] | None = None
    color: Literal["orange", "amber", "deepTeal", "teal", "slateTeal", "offWhite", "errorRed"] | None = None

class HomeLayoutInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    layout_version: Literal[1] = 1
    layout_json: list[LayoutEntry] = Field(max_length=12)

    @model_validator(mode="after")
    def valid_positions(self):
        ids, occupied = set(), set()
        for entry in self.layout_json:
            if entry.id not in MODULES or entry.id in ids:
                raise ValueError("Unknown or duplicate module")
            if entry.size is not None and entry.id not in {"stats", "games", "arsenal"}:
                raise ValueError("This module cannot be resized")
            width, height = (2, 2) if entry.size == "large" else MODULES[entry.id]
            cells = {entry.slot + y * 2 + x for y in range(height) for x in range(width)}
            if entry.slot % 2 + width > 2 or max(cells) >= 12 or cells & occupied:
                raise ValueError("Modules overlap or extend outside the layout")
            ids.add(entry.id)
            occupied.update(cells)
        return self

class HomeLayoutResponse(BaseModel):
    layout_version: int
    layout_json: list[dict]
    updated_at: datetime | None = None

@router.get("", response_model=HomeLayoutResponse)
def get_home_layout(user: UserDependency):
    with database_cursor() as cursor:
        cursor.execute("SELECT layout_version, layout_json, updated_at FROM user_home_layouts WHERE user_id = ?", (user.user_id,))
        row = cursor.fetchone()
    if row is None:
        return {"layout_version": 1, "layout_json": DEFAULT_LAYOUT, "updated_at": None}
    return {"layout_version": row[0], "layout_json": json.loads(row[1]), "updated_at": row[2]}

@router.put("", response_model=HomeLayoutResponse)
def save_home_layout(data: HomeLayoutInput, user: UserDependency):
    # The transaction serializes writes; user_id always comes from the token.
    updated = datetime.now(timezone.utc)
    stamp = updated.replace(tzinfo=None).isoformat(timespec="microseconds")
    layout = [entry.model_dump(exclude_none=True) for entry in data.layout_json]
    encoded = json.dumps(layout, separators=(",", ":"))
    with database_cursor(write=True) as cursor:
        cursor.execute("SELECT user_id FROM user_home_layouts WHERE user_id = ?", (user.user_id,))
        if cursor.fetchone() is None:
            cursor.execute("INSERT INTO user_home_layouts (user_id, layout_version, layout_json, updated_at) VALUES (?, ?, ?, ?)", (user.user_id, 1, encoded, stamp))
        else:
            cursor.execute("UPDATE user_home_layouts SET layout_version = ?, layout_json = ?, updated_at = ? WHERE user_id = ?", (1, encoded, stamp, user.user_id))
    return {"layout_version": 1, "layout_json": layout, "updated_at": updated}
