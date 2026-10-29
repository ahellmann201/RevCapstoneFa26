"""Executed in a separate process so SQLite and SQL Server imports stay isolated."""
from unittest.mock import patch

from Database.database.connection import get_connection
from Database.database.sqlite_schema import initialize_schema


def main():
    connection = get_connection()
    initialize_schema(connection)
    connection.close()
    # No developer .env or remote connection is used by this scenario.
    with patch("dotenv.load_dotenv", return_value=False):
        from Database.api.main import app
    from fastapi.testclient import TestClient
    with TestClient(app) as client:
        def register(username):
            response = client.post("/auth/register", json={
                "display_name": username, "username": username,
                "email": username + "@example.com", "password": "OfflineTest123!"})
            assert response.status_code == 201, response.text
            response = client.post("/auth/login", json={"username": username, "password": "OfflineTest123!"})
            assert response.status_code == 200, response.text
            return {"Authorization": "Bearer " + response.json()["access_token"]}
        owner, other = register("owner"), register("other")
        def post(path, payload, headers=owner):
            response = client.post(path, json=payload, headers=headers)
            assert response.status_code == 201, response.text
            return response.json()
        def listing(path):
            response = client.get(path, headers=owner)
            assert response.status_code == 200, response.text
            return response.json()

        establishment = post("/establishments", {"establishment_name": "Demo Lanes", "nickname": "Home",
            "type": "Bowling", "phone": "555-0100", "home_house": True, "enabled": True})
        assert listing("/establishments")[0]["nickname"] == "Home"
        payload = {k: v for k, v in establishment.items() if k not in {"user_id", "establishment_id"}}
        payload["nickname"] = "Updated"
        response = client.put(f"/establishments/{establishment['establishment_id']}", headers=owner, json=payload)
        assert response.status_code == 200, response.text
        assert response.json()["nickname"] == "Updated"

        ball = post("/balls", {"ball_name": "Demo Ball", "weight": 14})
        event = post("/events", {"event_name": "Practice"})
        session = post("/sessions", {"event_id": event["event_id"], "date_time": "2026-10-29T12:00:00Z",
            "establishment_id": establishment["establishment_id"]})
        game = post("/games", {"session_id": session["session_id"], "game_number": 1})
        # A complete perfect game exercises retrieval, pin masks, and scoring.
        first_frame = first_shot = None
        for number in range(1, 11):
            frame = post("/frames", {"game_id": game["game_id"], "frame_number": number})
            first_frame = first_frame or frame
            for shot_number in range(1, 4 if number == 10 else 2):
                shot = post("/shots", {"frame_id": frame["frame_id"], "shot_number": shot_number,
                    "pin_leave": [], "ball_id": ball["ball_id"]})
                first_shot = first_shot or shot
        assert len(listing("/frames")) == 10
        assert len(listing("/shots")) == 12
        response = client.get("/statistics", headers=owner)
        assert response.status_code == 200, response.text
        summary = response.json()
        assert summary["completed_games"] == 1
        assert summary["average_score"] == summary["highest_score"] == 300
        assert summary["recent_games"][0]["game_id"] == game["game_id"]
        assert client.get("/statistics", headers=other).json()["completed_games"] == 0

        # Actual SELECT/UPDATE/DELETE ownership expressions execute in SQLite.
        resources = [("establishments", establishment), ("balls", ball), ("events", event),
            ("sessions", session), ("games", game), ("frames", first_frame), ("shots", first_shot)]
        keys = {"establishments": "establishment_id", "balls": "ball_id", "events": "event_id",
            "sessions": "session_id", "games": "game_id", "frames": "frame_id", "shots": "shot_id"}
        for path, record in resources:
            key = keys[path]
            url = f"/{path}/{record[key]}"
            assert client.get(url, headers=other).status_code == 404, url
            body = {k: v for k, v in record.items() if k not in {key, "user_id"}}
            assert client.put(url, json=body, headers=other).status_code == 404, url
            assert client.delete(url, headers=other).status_code == 404, url
            assert client.get("/" + path, headers=other).json() == [], path

        # A valid ID from another account must not be accepted as a parent.
        for path, body in [
            ("/sessions", {"event_id": event["event_id"]}),
            ("/games", {"session_id": session["session_id"], "game_number": 1}),
            ("/frames", {"game_id": game["game_id"], "frame_number": 1}),
            ("/shots", {"frame_id": first_frame["frame_id"], "shot_number": 1}),
        ]:
            response = client.post(path, json=body, headers=other)
            assert response.status_code == 404, response.text

        # Owner can update/delete descendants; linked balls cannot be removed.
        assert client.delete(f"/balls/{ball['ball_id']}", headers=owner).status_code == 409
        response = client.put(f"/games/{game['game_id']}", headers=owner,
            json={"session_id": session["session_id"], "game_number": 2})
        assert response.status_code == 200, response.text
        assert response.json()["game_number"] == 2
        assert client.delete(f"/games/{game['game_id']}", headers=owner).status_code == 204
        assert listing("/shots") == []
        assert listing("/frames") == []
        assert client.delete(f"/balls/{ball['ball_id']}", headers=owner).status_code == 204
        assert client.get("/statistics", headers=owner).json()["completed_games"] == 0
        assert client.put("/auth/me/display-name", json={"value": "Updated Owner"}, headers=owner).status_code == 200
    print("SQLite API save/reload, statistics, ownership, updates and cascades verified")


if __name__ == "__main__":
    main()
