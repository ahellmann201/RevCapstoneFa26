"""Authenticated statistics over the caller's owned bowling games."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from datetime import datetime

from Database.api.auth import UserResponse, current_user
from Database.api.bowling import games
from Database.api.resource_routes import database_cursor
from Statistics.statistics_calculations import RecordedGame, RecordedShot, calculate_statistics


router = APIRouter(prefix="/statistics", tags=["Statistics"])


class RecentGameResponse(BaseModel):
    game_id: int
    played_at: datetime | None
    score: int


class StatisticsResponse(BaseModel):
    completed_games: int
    average_score: float | None
    highest_score: int | None
    recent_games: list[RecentGameResponse]
    invalid_games: int


@router.get("", response_model=StatisticsResponse)
def get_statistics(
    user: Annotated[UserResponse, Depends(current_user)],
    recent_limit: Annotated[int, Query(ge=1, le=100)] = 10,
):
    # Reuse the same ownership scope as /games, including establishment ownership.
    # Fetch the game hierarchy in one query rather than one query per game.
    with database_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT r.game_id, session.date_time, f.frame_id, f.frame_number,
                   shot.shot_number, shot.pin_leave
            FROM games AS r
            JOIN sessions AS session ON session.session_id = r.session_id
            LEFT JOIN frames AS f ON f.game_id = r.game_id
            LEFT JOIN shots AS shot ON shot.frame_id = f.frame_id
            WHERE {games.scope}
            ORDER BY r.game_id, f.frame_number, f.frame_id, shot.shot_number, shot.shot_id
            """,
            (user.user_id,),
        )
        rows = cursor.fetchall()
    records = {}
    frame_ids = {}
    for game_id, date_time, frame_id, frame_number, shot_number, mask in rows:
        if isinstance(date_time, str):
            date_time = datetime.fromisoformat(date_time)
        record = records.setdefault(game_id, RecordedGame(game_id, date_time, {}))
        if frame_id is None:
            continue
        # Duplicate frame numbers must not silently merge into a valid game.
        key = (game_id, frame_number)
        prior = frame_ids.setdefault(key, frame_id)
        shots = record.frames.setdefault(frame_number, [])
        if prior != frame_id:
            shots.append(RecordedShot(0, ()))
            continue
        if shot_number is not None:
            if type(mask) is not int or not 0 <= mask <= 1023:
                shots.append(RecordedShot(0, ()))
            else:
                pins = tuple(pin for pin in range(1, 11) if mask & (1 << (pin - 1)))
                shots.append(RecordedShot(shot_number, pins))
    return calculate_statistics(list(records.values()), recent_limit)
