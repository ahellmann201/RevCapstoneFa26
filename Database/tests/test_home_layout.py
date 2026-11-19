import json
import pyodbc
import pytest


def test_layout_requires_login(client):
    assert client.get("/auth/me/home-layout").status_code == 401
    assert client.put("/auth/me/home-layout", json={"layout_json": []}).status_code == 401


def test_layout_default_and_resource_cleanup(authenticated, db):
    connection, cursor = db
    result = authenticated.get("/auth/me/home-layout")
    assert result.status_code == 200
    assert result.json()["updated_at"] is None
    assert len(result.json()["layout_json"]) == 3
    assert cursor.execute.call_args.args[1] == (7,)
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


def test_layout_save_uses_authenticated_id_and_updates(authenticated, db):
    connection, cursor = db
    cursor.fetchone.return_value = (7,)
    result = authenticated.put("/auth/me/home-layout", json={"layout_version": 1, "layout_json": []})
    assert result.status_code == 200
    assert result.json()["layout_json"] == []
    assert result.json()["updated_at"] is not None
    sql, params = cursor.execute.call_args.args
    assert "UPDATE user_home_layouts" in sql
    assert params[-1] == 7
    assert json.loads(params[1]) == []
    connection.commit.assert_called_once()
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize("payload", [
    {"layout_version": 2, "layout_json": []},
    {"layout_json": [{"id": "week", "slot": 1}]},
    {"layout_json": [{"id": "week", "slot": 10}]},
    {"layout_json": [{"id": "game", "slot": True}]},
    {"layout_json": [{"id": "game", "slot": 0}, {"id": "game", "slot": 1}]},
    {"layout_json": [{"id": "week", "slot": 0}, {"id": "stats", "slot": 2}]},
    {"layout_json": [], "user_id": 8},
    {"layout_json": [{"id": "<script>", "slot": 0}]},
])
def test_invalid_layout_never_opens_database(authenticated, db, payload):
    connection, _ = db
    result = authenticated.put("/auth/me/home-layout", json=payload)
    assert result.status_code == 422
    connection.cursor.assert_not_called()


def test_layout_database_failure_is_safe(authenticated, db):
    connection, cursor = db
    cursor.execute.side_effect = pyodbc.OperationalError("secret-password host details")
    result = authenticated.get("/auth/me/home-layout")
    assert result.status_code == 503
    assert "secret-password" not in result.text
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize("entry", [
    {"id": "stats", "slot": 1, "size": "large"},
    {"id": "game", "slot": 0, "size": "large"},
    {"id": "stats", "slot": 0, "size": "giant"},
])
def test_widget_sizes_are_validated(authenticated, db, entry):
    assert authenticated.put("/auth/me/home-layout", json={"layout_json": [entry]}).status_code == 422
    db[0].cursor.assert_not_called()


def test_expanded_size_is_stored_and_returned(authenticated, db):
    _, cursor = db
    entries = [{"id": "stats", "slot": 0, "size": "large"}, {"id": "games", "slot": 4, "size": "small"}]
    result = authenticated.put("/auth/me/home-layout", json={"layout_json": entries})
    assert result.status_code == 200, result.text
    assert result.json()["layout_json"] == entries
    assert json.loads(cursor.execute.call_args.args[1][2]) == entries
