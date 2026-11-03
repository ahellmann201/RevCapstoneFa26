import pyodbc
import pytest


CASES = [
    ("establishments", {"establishment_name": "Test Lanes"}),
    ("events", {"event_name": "Test Event"}),
    ("sessions", {"event_id": 10}),
    ("games", {"session_id": 10, "game_number": 1}),
    ("frames", {"game_id": 10, "frame_number": 1}),
    ("shots", {"frame_id": 10, "shot_number": 1, "pin_leave": [1, 10]}),
]


def row_for(resource, user_id=7):
    payload = dict(CASES)[resource.path.strip("/")]
    values = resource.model(**payload).model_dump()
    if "pin_leave" in values:
        values["pin_leave"] = 513
    return (11, *((user_id,) if resource.direct_owner else ()), *values.values())


@pytest.mark.parametrize("name,payload", CASES)
def test_resource_crud_routes(authenticated, modules, db, name, payload):
    connection, cursor = db
    resource = getattr(modules[3], name)
    row = row_for(resource)
    # Reference checks SELECT 1, then the INSERT returns the record.
    reference_count = sum(resource.model(**payload).model_dump().get(field) is not None for field, _ in resource.references)
    cursor.fetchone.side_effect = [(1,)] * reference_count + [row]
    response = authenticated.post(f"/{name}", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()[resource.key] == 11
    if name == "shots": assert response.json()["pin_leave"] == [1, 10]
    if resource.direct_owner: assert response.json()["user_id"] == 7
    connection.commit.assert_called_once()
    cursor.close.assert_called_once()
    connection.close.assert_called_once()

    cursor.fetchone.side_effect = None
    cursor.fetchone.return_value = row
    assert authenticated.get(f"/{name}/11").status_code == 200
    assert cursor.execute.call_args.args[1] == (11, 7)
    cursor.fetchall.return_value = [row]
    response = authenticated.get(f"/{name}?limit=5&offset=2")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert cursor.execute.call_args.args[1] == (7, 2, 5)

    cursor.fetchone.side_effect = [(1,)] * (reference_count + 1) + [row]
    assert authenticated.put(f"/{name}/11", json=payload).status_code == 200
    cursor.fetchone.side_effect = None
    cursor.fetchone.return_value = (11,)
    response = authenticated.delete(f"/{name}/11")
    assert response.status_code == 204
    assert response.content == b""


@pytest.mark.parametrize("name,payload", CASES)
@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_missing_or_unowned_resource_is_404(authenticated, db, name, payload, method):
    connection, cursor = db
    cursor.fetchone.return_value = None
    kwargs = {"json": payload} if method == "put" else {}
    response = getattr(authenticated, method)(f"/{name}/99", **kwargs)
    assert response.status_code == 404
    connection.commit.assert_not_called()
    connection.rollback.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize("name,payload", CASES[2:])
def test_unowned_parent_blocks_insert(authenticated, db, name, payload):
    connection, cursor = db
    response = authenticated.post(f"/{name}", json=payload)
    assert response.status_code == 404
    assert not any("INSERT INTO" in call.args[0] for call in cursor.execute.call_args_list)
    connection.commit.assert_not_called()


@pytest.mark.parametrize("method,path", [("post", "/events"), ("put", "/games/1"), ("delete", "/shots/1"), ("post", "/balls"), ("put", "/auth/me/display-name")])
def test_writes_require_login(client, method, path):
    response = getattr(client, method)(path, json={}) if method != "delete" else client.delete(path)
    assert response.status_code == 401


def test_locations_read_only(authenticated, db):
    _, cursor = db
    cursor.fetchall.return_value = [(1, "Lanes", 20, "Test Street")]
    assert authenticated.get("/locations").json()[0]["location_name"] == "Lanes"
    for method, path in [("post", "/locations"), ("put", "/locations/1"), ("delete", "/locations/1")]:
        assert getattr(authenticated, method)(path).status_code == 405


@pytest.mark.parametrize("error,status", [(pyodbc.Error, 503), (pyodbc.IntegrityError, 409)])
def test_resource_failure_rolls_back_and_hides_details(authenticated, db, error, status):
    connection, cursor = db
    cursor.execute.side_effect = error("SECRET TEST DATABASE DETAILS")
    response = authenticated.post("/events", json={"event_name": "Test"})
    assert response.status_code == status
    assert "SECRET" not in response.text
    connection.commit.assert_not_called()
    connection.rollback.assert_called_once()
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_ball_ownership_filter(authenticated, db, method):
    connection, cursor = db
    kwargs = {"json": {"ball_name": "Test"}} if method == "put" else {}
    response = getattr(authenticated, method)("/balls/99", **kwargs)
    assert response.status_code == 404
    sql, params = cursor.execute.call_args.args
    assert "user_id = ?" in sql
    assert params[-2:] == (99, 7)
    connection.commit.assert_not_called()


def test_ball_crud(authenticated, db):
    connection, cursor = db
    row = (11, 7, "Test Ball", 14, "Blue", None)
    payload = {"ball_name": "Test Ball", "weight": 14, "color": "Blue"}
    cursor.fetchone.return_value = row
    assert authenticated.post("/balls", json=payload).status_code == 201
    assert cursor.execute.call_args.args[1][0] == 7
    assert authenticated.get("/balls/11").json()["ball_name"] == "Test Ball"
    cursor.fetchall.return_value = [row]
    assert len(authenticated.get("/balls").json()) == 1
    assert authenticated.put("/balls/11", json=payload).status_code == 200
    cursor.fetchone.return_value = (11,)
    assert authenticated.delete("/balls/11").status_code == 204


def test_linked_ball_delete_conflict(authenticated, db):
    connection, cursor = db
    cursor.execute.side_effect = pyodbc.IntegrityError("PRIVATE")
    response = authenticated.delete("/balls/11")
    assert response.status_code == 409
    assert "PRIVATE" not in response.text
    connection.rollback.assert_called_once()


@pytest.mark.parametrize("path,payload", [
    ("/balls", {"ball_name": " "}),
    ("/balls", {"ball_name": "Test", "weight": 17}),
    ("/balls", {"ball_name": "Test", "weight": True}),
    ("/events", {"event_name": "Test", "user_id": 999}),
    ("/sessions", {}),
    ("/games", {"session_id": 1, "game_number": 1, "game_score": 301}),
    ("/frames", {"game_id": 1, "frame_number": 11}),
    ("/shots", {"frame_id": 1, "shot_number": 4}),
    ("/shots", {"frame_id": 1, "shot_number": 1, "pin_leave": [1, 1]}),
    ("/shots", {"frame_id": 1, "shot_number": 1, "pin_leave": [11]}),
])
def test_invalid_inputs_rejected(authenticated, path, payload):
    assert authenticated.post(path, json=payload).status_code == 422


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1"])
def test_pagination_validation(authenticated, query):
    assert authenticated.get(f"/games?{query}").status_code == 422


def test_all_pin_masks_round_trip(authenticated, modules, db):
    _, cursor = db
    for mask in range(1024):
        pins = [pin for pin in range(1, 11) if mask & (1 << (pin - 1))]
        payload = modules[3].ShotInput(frame_id=1, shot_number=1, pin_leave=pins)
        assert modules[4].database_values(payload)["pin_leave"] == mask
    cursor.fetchone.return_value = (11, 1, 1, None, 1023, None, None, None, None)
    assert authenticated.get("/shots/11").json()["pin_leave"] == list(range(1, 11))


def test_session_time_normalized_to_utc(modules):
    payload = modules[3].SessionInput(event_id=1, date_time="2026-10-27T12:00:00-04:00")
    assert payload.date_time.isoformat() == "2026-10-27T16:00:00"


@pytest.mark.parametrize("origin,allowed", [("http://localhost:5173", True), ("http://10.1.2.3:5173", True), ("https://example.com", False)])
def test_cors(client, origin, allowed):
    response = client.options("/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
    assert (response.headers.get("access-control-allow-origin") == origin) == allowed
