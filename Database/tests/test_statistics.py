from datetime import datetime

import pyodbc
import pytest

from Statistics.statistics_calculations import (
    RecordedGame, RecordedShot, calculate_statistics, score_game,
)


def frame(*pinfall):
    standing = list(range(1, 11))
    shots = []
    for number, knocked in enumerate(pinfall, 1):
        if not standing:
            standing = list(range(1, 11))
        standing = standing[knocked:]
        shots.append(RecordedShot(number, tuple(standing)))
    return shots


def regular_game(first, second):
    return {number: frame(first, second) for number in range(1, 11)}


@pytest.mark.parametrize("frames,expected", [
    (regular_game(0, 0), 0),
    (regular_game(4, 5), 90),
    ({**{number: frame(10) for number in range(1, 10)}, 10: frame(10, 10, 10)}, 300),
    ({number: frame(5, 5, 5) if number == 10 else frame(5, 5) for number in range(1, 11)}, 150),
    ({**regular_game(0, 0), 9: frame(10), 10: frame(10, 7, 3)}, 47),
    ({**regular_game(0, 0), 10: frame(10, 7, 2)}, 19),
    ({**regular_game(0, 0), 10: frame(7, 3, 10)}, 20),
])
def test_known_scores(frames, expected):
    assert score_game(frames) == expected


@pytest.mark.parametrize("frames", [
    {}, {1: frame(10)}, {**regular_game(0, 0), 10: frame(10)},
    {**regular_game(0, 0), 10: frame(10, 10)},
    {**regular_game(0, 0), 10: frame(5, 5)},
    {**regular_game(0, 0), 3: frame(4)},
])
def test_incomplete_games_have_no_final_score(frames):
    assert score_game(frames) is None


@pytest.mark.parametrize("number,shots", [
    (0, frame(10)), (11, frame(10)),
    (1, frame(10, 1)),
    (1, [RecordedShot(2, ())]),
    (1, [RecordedShot(1, (1, 1))]),
    (1, [RecordedShot(1, (11,))]),
    (1, [RecordedShot(1, (True,))]),
    (1, [RecordedShot(1, (1,)), RecordedShot(2, (2,))]),
    (10, frame(4, 5, 1)),
    (10, frame(10, 10, 10, 10)),
])
def test_invalid_shots_rejected(number, shots):
    with pytest.raises(ValueError):
        score_game({**regular_game(0, 0), number: shots})


def test_empty_statistics():
    result = calculate_statistics([])
    assert result.completed_games == 0
    assert result.average_score is None
    assert result.highest_score is None
    assert result.recent_games == ()


def test_statistics_include_only_completed_games_and_order_dates():
    # All spares with a gutter bonus: 100. All 5-spares: 150.
    hundred = {number: frame(0, 10, 0) if number == 10 else frame(0, 10) for number in range(1, 11)}
    one_fifty = {number: frame(5, 5, 5) if number == 10 else frame(5, 5) for number in range(1, 11)}
    # Alternating strikes and 0/10 spares, ending with a strike bonus: 200.
    two_hundred = {number: frame(10) if number % 2 else frame(0, 10) for number in range(1, 10)}
    two_hundred[10] = frame(0, 10, 10)
    assert score_game(two_hundred) == 200
    records = [RecordedGame(1, datetime(2026, 10, 1), hundred),
        RecordedGame(2, datetime(2026, 10, 2), one_fifty),
        RecordedGame(3, datetime(2026, 10, 3), two_hundred),
        RecordedGame(4, datetime(2026, 10, 4), {1: frame(10)})]
    result = calculate_statistics(records, recent_limit=2)
    assert result.completed_games == 3
    assert result.average_score == 150.0
    assert result.highest_score == 200
    assert [game.game_id for game in result.recent_games] == [3, 2]


def test_zero_score_counts_as_completed_and_invalid_games_are_reported():
    result = calculate_statistics([RecordedGame(1, None, regular_game(0, 0)),
        RecordedGame(2, None, {1: frame(10, 10)})])
    assert result.completed_games == 1
    assert result.average_score == 0
    assert result.highest_score == 0
    assert result.invalid_games == 1


def test_recent_ties_and_undated_games():
    complete = regular_game(0, 0)
    date = datetime(2026, 10, 27)
    result = calculate_statistics([RecordedGame(100, None, complete),
        RecordedGame(2, date, complete), RecordedGame(3, date, complete)])
    assert [game.game_id for game in result.recent_games] == [3, 2, 100]


def test_duplicate_game_ids_rejected():
    with pytest.raises(ValueError):
        calculate_statistics([RecordedGame(1, None, {}), RecordedGame(1, None, {})])


def rows_for_game(game_id, frames, date=None):
    rows = []
    for number, shots in frames.items():
        for shot in shots:
            mask = sum(1 << (pin - 1) for pin in shot.pin_leave)
            rows.append((game_id, date, game_id * 10 + number, number, shot.shot_number, mask))
    return rows


def test_statistics_require_authentication(client):
    assert client.get("/statistics").status_code == 401


def test_statistics_endpoint_scoped_and_computed(authenticated, modules, db):
    connection, cursor = db
    cursor.fetchall.return_value = rows_for_game(1, regular_game(4, 5)) + [(2, None, None, None, None, None)]
    response = authenticated.get("/statistics")
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["completed_games"] == 1
    assert result["average_score"] == 90
    assert result["highest_score"] == 90
    assert result["recent_games"] == [{"game_id": 1, "played_at": None, "score": 90}]
    sql, params = cursor.execute.call_args.args
    assert modules[3].games.scope in sql
    assert params == (7,)
    connection.commit.assert_not_called()
    connection.close.assert_called_once()
    cursor.close.assert_called_once()


@pytest.mark.parametrize("case", ["duplicate_frame", "invalid_mask", "duplicate_shot"])
def test_corrupt_database_sequences_not_counted(authenticated, db, case):
    _, cursor = db
    rows = rows_for_game(1, regular_game(4, 5))
    if case == "duplicate_frame": rows.append((1, None, 999, 1, 1, 0))
    if case == "invalid_mask": rows[0] = (1, None, 11, 1, 1, 1024)
    if case == "duplicate_shot": rows.insert(1, rows[0])
    cursor.fetchall.return_value = rows
    result = authenticated.get("/statistics").json()
    assert result["completed_games"] == 0
    assert result["invalid_games"] == 1


def test_statistics_database_failure_is_safe(authenticated, db):
    _, cursor = db
    cursor.execute.side_effect = pyodbc.Error("PRIVATE CONNECTION DETAILS")
    response = authenticated.get("/statistics")
    assert response.status_code == 503
    assert "PRIVATE" not in response.text


@pytest.mark.parametrize("limit", [0, 101])
def test_statistics_limit_validation(authenticated, limit):
    assert authenticated.get(f"/statistics?recent_limit={limit}").status_code == 422
