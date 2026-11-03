"""Offline API tests: never load local credentials or open a real connection."""
from unittest.mock import MagicMock

import pytest


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "offline-test-signing-key-" * 4)
    for key in ("DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture(scope="session")
def modules():
    from unittest.mock import patch
    # Prevent main.py from loading a developer's real .env during collection.
    with patch("dotenv.load_dotenv", return_value=False), patch.dict(
        "os.environ", {"DB_TYPE": "sqlserver"}
    ):
        from Database.api import main, auth, balls, bowling, resource_routes
    return main, auth, balls, bowling, resource_routes


@pytest.fixture(autouse=True)
def block_real_database(modules, monkeypatch):
    import pyodbc
    def forbidden(*args, **kwargs):
        raise AssertionError("Offline tests must never open a real database")
    monkeypatch.setattr(pyodbc, "connect", forbidden)


@pytest.fixture
def client(modules):
    from fastapi.testclient import TestClient
    app = modules[0].app
    app.dependency_overrides.clear()
    with TestClient(app) as result:
        yield result
    app.dependency_overrides.clear()


@pytest.fixture
def user(modules):
    return modules[1].UserResponse(user_id=7, display_name="Test Bowler",
        username="testbowler", email="bowler@example.com", main_hand="R")


@pytest.fixture
def authenticated(client, modules, user):
    modules[0].app.dependency_overrides[modules[1].current_user] = lambda: user
    return client


@pytest.fixture
def db(modules, monkeypatch):
    from Database.database import connection as connection_module
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = None
    cursor.fetchall.return_value = []
    for module in (modules[1], modules[4], connection_module):
        monkeypatch.setattr(module, "get_connection", lambda: connection)
    return connection, cursor
