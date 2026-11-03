"""Pure ten-pin scoring and statistics; no database or web dependencies."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from collections.abc import Mapping, Sequence


@dataclass(frozen=True)
class RecordedShot:
    shot_number: int
    pin_leave: tuple[int, ...]


@dataclass(frozen=True)
class RecordedGame:
    game_id: int
    played_at: datetime | None
    frames: Mapping[int, Sequence[RecordedShot]]


@dataclass(frozen=True)
class GameResult:
    game_id: int
    played_at: datetime | None
    score: int


@dataclass(frozen=True)
class StatisticsSummary:
    completed_games: int
    average_score: float | None
    highest_score: int | None
    recent_games: tuple[GameResult, ...]
    invalid_games: int = 0


def score_game(frames: Mapping[int, Sequence[RecordedShot]]) -> int | None:
    """Score complete legal shot sequences; None means unfinished.

    pin_leave is the set of pins still standing after each shot, not pinfall.
    A cleared rack resets only for bonus shots in frame ten. Invalid sequences
    raise ValueError and must not contribute to statistics.
    """
    if any(type(number) is not int or not 1 <= number <= 10 for number in frames):
        raise ValueError("Frame numbers must be between 1 and 10")
    rolls_by_frame = []
    complete_frames = []
    for number in range(1, 11):
        shots = frames.get(number, ())
        standing = set(range(1, 11))
        rolls = []
        complete = False
        for index, shot in enumerate(shots):
            if complete or type(shot.shot_number) is not int or shot.shot_number != index + 1:
                raise ValueError("Invalid shot order or extra shot")
            leave = shot.pin_leave
            if any(type(pin) is not int or not 1 <= pin <= 10 for pin in leave):
                raise ValueError("Invalid pin number")
            remaining = set(leave)
            if len(remaining) != len(leave) or not remaining <= standing:
                raise ValueError("Invalid remaining pins")
            rolls.append(len(standing) - len(remaining))
            if number < 10:
                complete = not remaining or index == 1
            elif index == 1:
                complete = rolls[0] != 10 and sum(rolls) < 10
            elif index == 2:
                complete = True
            standing = set(range(1, 11)) if number == 10 and not remaining else remaining
        rolls_by_frame.append(rolls)
        complete_frames.append(complete)
    if not all(complete_frames):
        return None
    all_rolls = [roll for frame in rolls_by_frame for roll in frame]
    score = 0
    offset = 0
    for frame in rolls_by_frame[:9]:
        if frame[0] == 10:
            score += sum(all_rolls[offset:offset + 3])
        elif sum(frame) == 10:
            score += sum(all_rolls[offset:offset + 3])
        else:
            score += sum(frame)
        offset += len(frame)
    return score + sum(rolls_by_frame[9])


def calculate_statistics(games: Sequence[RecordedGame], recent_limit: int = 10) -> StatisticsSummary:
    """All totals use complete shot-derived scores, never editable score fields.

    Recent means session date descending, then game ID descending. Undated games
    come last. Invalid games are excluded and counted separately for visibility.
    """
    if type(recent_limit) is not int or not 1 <= recent_limit <= 100:
        raise ValueError("recent_limit must be between 1 and 100")
    if len({game.game_id for game in games}) != len(games):
        raise ValueError("Duplicate game IDs")
    results = []
    invalid = 0
    for game in games:
        try:
            score = score_game(game.frames)
        except ValueError:
            invalid += 1
            continue
        if score is not None:
            results.append(GameResult(game.game_id, game.played_at, score))
    results.sort(key=lambda result: (result.played_at is not None,
        result.played_at or datetime.min, result.game_id), reverse=True)
    average = None
    if results:
        average = float((Decimal(sum(result.score for result in results)) /
            Decimal(len(results))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return StatisticsSummary(len(results), average,
        max((result.score for result in results), default=None),
        tuple(results[:recent_limit]), invalid)
