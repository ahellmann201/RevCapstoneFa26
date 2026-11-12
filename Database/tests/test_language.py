"""Account language updates use the authenticated identity and safe transactions."""
import sqlite3
import pyodbc
import pytest

def test_language_update_scoped_to_current_user(authenticated, db):
    connection, cursor = db
    cursor.fetchone.return_value = (7, "Bowler", "bowler", "bowler@example.com", None, "es")
    response = authenticated.put("/auth/me/language", json={"main_language": "es"})
    assert response.status_code == 200
    assert response.json()["main_language"] == "es"
    assert cursor.execute.call_args_list[0].args[1] == ("es", 7)
    connection.commit.assert_called_once()
    cursor.close.assert_called_once()
    connection.close.assert_called_once()

def test_language_failure_rolls_back_and_hides_driver_details(authenticated, db):
    connection, cursor = db
    cursor.execute.side_effect = pyodbc.Error("PRIVATE DATABASE DETAILS")
    response = authenticated.put("/auth/me/language", json={"main_language": "fr"})
    assert response.status_code == 503
    assert "PRIVATE" not in response.text
    connection.rollback.assert_called_once()
    cursor.close.assert_called_once()
    connection.close.assert_called_once()

def test_language_upgrade_preserves_existing_users():
    from Database.database.sqlite_schema import initialize_schema
    connection = sqlite3.connect(":memory:")
    try:
        connection.execute("CREATE TABLE users (user_id INTEGER PRIMARY KEY, display_name TEXT, "
            "username TEXT, password_hash BLOB, email TEXT, main_hand TEXT)")
        connection.execute("INSERT INTO users VALUES (1, 'Original', 'owner', X'01', 'owner@example.com', 'R')")
        initialize_schema(connection)
        assert connection.execute("SELECT display_name, main_language FROM users").fetchone() == ("Original", "en")
        connection.execute("UPDATE users SET main_language = 'es'")
        initialize_schema(connection)
        assert connection.execute("SELECT main_language FROM users").fetchone()[0] == "es"
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("UPDATE users SET main_language = 'unsupported'")
    finally:
        connection.close()
