from datetime import datetime, timedelta, timezone

import jwt
import pyodbc
import pytest
from fastapi import HTTPException


def test_health_without_database(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("result", [(1,), None, (0,)])
def test_database_health_cleanup(modules, db, result):
    connection, cursor = db
    cursor.fetchone.return_value = result
    if result == (1,):
        assert modules[0].database_health()["database"] == "reachable"
    else:
        with pytest.raises(HTTPException) as error:
            modules[0].database_health()
        assert error.value.status_code == 503
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


def test_database_health_hides_errors(modules, db):
    connection, cursor = db
    cursor.execute.side_effect = pyodbc.Error("SECRET-CONNECTION-DETAILS")
    with pytest.raises(HTTPException) as error:
        modules[0].database_health()
    assert error.value.detail == "Database connectivity check unavailable"
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize("path", ["/auth/me", "/balls", "/locations", "/events", "/sessions", "/games", "/frames", "/shots", "/establishments"])
def test_reads_require_login(client, path):
    assert client.get(path).status_code == 401


def registration():
    return dict(display_name="Bowler", username="bowler", email="bowler@example.com", password="TestPass123!")


def test_registration_hashes_password(authenticated, modules, db):
    connection, cursor = db
    cursor.fetchone.return_value = (7, "Bowler", "bowler", "bowler@example.com", None)
    payload = registration()
    response = authenticated.post("/auth/register", json=payload)
    assert response.status_code == 201
    assert "password" not in response.text
    params = cursor.execute.call_args.args[1]
    assert params[2] != payload["password"].encode()
    assert modules[1].password_hasher.verify(payload["password"], params[2].decode())
    connection.commit.assert_called_once()
    cursor.close.assert_called_once()
    connection.close.assert_called_once()


def test_duplicate_registration_rolls_back(client, db):
    connection, cursor = db
    cursor.execute.side_effect = pyodbc.IntegrityError("PRIVATE DETAILS")
    response = client.post("/auth/register", json=registration())
    assert response.status_code == 409
    assert "PRIVATE" not in response.text
    connection.rollback.assert_called_once()
    connection.commit.assert_not_called()
    connection.close.assert_called_once()


@pytest.mark.parametrize("password", ["xY9!", "a" * 129])
def test_registration_validation_does_not_echo_password(client, password):
    payload = registration()
    payload["password"] = password
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 422
    assert password not in response.text
    assert all("input" not in item for item in response.json()["detail"])


def test_login_issues_valid_token(client, modules, db, monkeypatch):
    _, cursor = db
    auth = modules[1]
    cursor.fetchone.return_value = (7, auth.password_hasher.hash("TestPass123!").encode())
    response = client.post("/auth/login", json={"username": "bowler", "password": "TestPass123!"})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    token = response.json()["access_token"]
    claims = jwt.decode(token, auth.signing_secret(), algorithms=["HS256"], issuer=auth.TOKEN_ISSUER, audience=auth.TOKEN_AUDIENCE)
    assert claims["sub"] == "7"
    assert claims["exp"] - claims["iat"] == 1800


@pytest.mark.parametrize("kind", ["unknown", "wrong_password", "bad_hash"])
def test_login_failure_is_generic(client, modules, db, kind):
    _, cursor = db
    stored = modules[1].password_hasher.hash("DifferentPass123!").encode()
    cursor.fetchone.return_value = None if kind == "unknown" else (7, b"bad-hash" if kind == "bad_hash" else stored)
    response = client.post("/auth/login", json={"username": "bowler", "password": "TestPass123!"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials or expired access token"


@pytest.mark.parametrize("kind", ["expired", "signature", "audience", "issuer", "subject", "missing"])
def test_invalid_tokens_rejected_before_database(client, modules, kind):
    auth = modules[1]
    now = datetime.now(timezone.utc)
    claims = dict(sub="7", iat=now, exp=now + timedelta(minutes=5), iss=auth.TOKEN_ISSUER, aud=auth.TOKEN_AUDIENCE)
    secret = auth.signing_secret()
    if kind == "expired": claims["exp"] = now - timedelta(seconds=10)
    if kind == "signature": secret = "wrong-test-secret-" * 5
    if kind == "audience": claims["aud"] = "other-client"
    if kind == "issuer": claims["iss"] = "other-issuer"
    if kind == "subject": claims["sub"] = "-1"
    if kind == "missing": del claims["exp"]
    token = jwt.encode(claims, secret, algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_valid_token_returns_profile(client, modules, db):
    auth = modules[1]
    _, cursor = db
    cursor.fetchone.return_value = (7, "Bowler", "bowler", "bowler@example.com", None)
    now = datetime.now(timezone.utc)
    token = jwt.encode(dict(sub="7", iat=now, exp=now + timedelta(minutes=5), iss=auth.TOKEN_ISSUER, aud=auth.TOKEN_AUDIENCE), auth.signing_secret(), algorithm="HS256")
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["user_id"] == 7
    assert cursor.execute.call_args.args[1] == (7,)


def test_display_name_update(authenticated, db):
    connection, cursor = db
    cursor.fetchone.return_value = (7, "New Name", "bowler", "bowler@example.com", None)
    response = authenticated.put("/auth/me/display-name", json={"value": " New Name "})
    assert response.status_code == 200
    assert cursor.execute.call_args.args[1] == ("New Name", 7)
    connection.commit.assert_called_once()


def test_missing_signing_secret(client, monkeypatch):
    monkeypatch.delenv("JWT_SECRET")
    response = client.post("/auth/login", json={"username": "bowler", "password": "TestPass123!"})
    assert response.status_code == 503
