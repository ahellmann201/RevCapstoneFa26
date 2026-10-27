"""Database-level checks for the SQLite schema used by the app's test mode."""

import sqlite3
import tempfile
import unittest
from pathlib import Path

from Database.database.sqlite_schema import initialize_schema


EXPECTED_TABLES = {
    "users",
    "clients",
    "master_locations",
    "user_establishments",
    "balls",
    "events",
    "sessions",
    "games",
    "frames",
    "shots",
}


class SQLiteDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        database_path = Path(self.temporary_directory.name) / "database.sqlite3"
        self.connection = sqlite3.connect(database_path)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        initialize_schema(self.connection)

    def tearDown(self):
        self.connection.close()
        self.temporary_directory.cleanup()

    def create_user(self):
        cursor = self.connection.execute(
            """INSERT INTO users
               (display_name, username, password_hash, email, main_hand)
               VALUES (?, ?, ?, ?, ?)""",
            ("Test Bowler", "test-bowler", b"hash", "bowler@example.test", "R"),
        )
        return cursor.lastrowid

    def test_initialization_creates_all_current_tables_and_is_repeatable(self):
        initialize_schema(self.connection)
        tables = {
            row[0]
            for row in self.connection.execute(
                """SELECT name FROM sqlite_master
                   WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"""
            )
        }

        self.assertEqual(tables, EXPECTED_TABLES)

    def test_bowling_records_round_trip_and_game_delete_cascades(self):
        user_id = self.create_user()
        ball_id = self.connection.execute(
            "INSERT INTO balls (user_id, ball_name, weight) VALUES (?, ?, ?)",
            (user_id, "Test Ball", 14),
        ).lastrowid
        event_id = self.connection.execute(
            "INSERT INTO events (user_id, event_name) VALUES (?, ?)",
            (user_id, "Test Practice"),
        ).lastrowid
        session_id = self.connection.execute(
            "INSERT INTO sessions (event_id, opponent, score) VALUES (?, ?, ?)",
            (event_id, "Practice", 180),
        ).lastrowid
        game_id = self.connection.execute(
            "INSERT INTO games (session_id, game_number) VALUES (?, ?)",
            (session_id, 1),
        ).lastrowid
        frame_id = self.connection.execute(
            "INSERT INTO frames (game_id, frame_number) VALUES (?, ?)",
            (game_id, 1),
        ).lastrowid
        shot_id = self.connection.execute(
            """INSERT INTO shots
               (frame_id, shot_number, throw_type, pin_leave, ball_id)
               VALUES (?, ?, ?, ?, ?)""",
            (frame_id, 1, "strike", 0, ball_id),
        ).lastrowid
        self.connection.commit()

        saved = self.connection.execute(
            """SELECT u.username, e.event_name, g.game_number,
                      f.frame_number, s.throw_type, s.pin_leave, b.ball_name
               FROM shots AS s
               JOIN frames AS f ON f.frame_id = s.frame_id
               JOIN games AS g ON g.game_id = f.game_id
               JOIN sessions AS ss ON ss.session_id = g.session_id
               JOIN events AS e ON e.event_id = ss.event_id
               JOIN users AS u ON u.user_id = e.user_id
               JOIN balls AS b ON b.ball_id = s.ball_id
               WHERE s.shot_id = ?""",
            (shot_id,),
        ).fetchone()

        self.assertEqual(tuple(saved), (
            "test-bowler", "Test Practice", 1, 1, "strike", 0, "Test Ball",
        ))

        self.connection.execute(
            "UPDATE frames SET frame_result = ? WHERE frame_id = ?",
            (10, frame_id),
        )
        self.connection.commit()
        self.assertEqual(
            self.connection.execute(
                "SELECT frame_result FROM frames WHERE frame_id = ?",
                (frame_id,),
            ).fetchone()[0],
            10,
        )

        with self.assertRaises(sqlite3.IntegrityError):
            self.connection.execute("DELETE FROM balls WHERE ball_id = ?", (ball_id,))

        self.connection.execute("DELETE FROM games WHERE game_id = ?", (game_id,))
        self.connection.commit()
        self.assertIsNone(
            self.connection.execute(
                "SELECT frame_id FROM frames WHERE frame_id = ?", (frame_id,)
            ).fetchone()
        )
        self.assertIsNone(
            self.connection.execute(
                "SELECT shot_id FROM shots WHERE shot_id = ?", (shot_id,)
            ).fetchone()
        )

    def test_foreign_keys_unique_fields_and_domain_checks_are_enforced(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.connection.execute(
                "INSERT INTO balls (user_id, ball_name) VALUES (?, ?)",
                (9999, "Orphan ball"),
            )

        self.create_user()
        self.connection.commit()

        with self.assertRaises(sqlite3.IntegrityError):
            self.connection.execute(
                """INSERT INTO users
                   (display_name, username, password_hash, email)
                   VALUES (?, ?, ?, ?)""",
                ("Duplicate", "test-bowler", b"hash", "other@example.test"),
            )

        with self.assertRaises(sqlite3.IntegrityError):
            self.connection.execute(
                "INSERT INTO users (display_name, username, password_hash, email, main_hand) VALUES (?, ?, ?, ?, ?)",
                ("Invalid", "invalid-hand", b"hash", "invalid@example.test", "B"),
            )

        user_id = self.connection.execute(
            "SELECT user_id FROM users WHERE username = ?", ("test-bowler",)
        ).fetchone()[0]
        event_id = self.connection.execute(
            "INSERT INTO events (user_id, event_name) VALUES (?, ?)",
            (user_id, "Constraint test"),
        ).lastrowid
        session_id = self.connection.execute(
            "INSERT INTO sessions (event_id) VALUES (?)", (event_id,)
        ).lastrowid
        game_id = self.connection.execute(
            "INSERT INTO games (session_id, game_number) VALUES (?, ?)",
            (session_id, 1),
        ).lastrowid

        with self.assertRaises(sqlite3.IntegrityError):
            self.connection.execute(
                "INSERT INTO frames (game_id, frame_number) VALUES (?, ?)",
                (game_id, 11),
            )

        frame_id = self.connection.execute(
            "INSERT INTO frames (game_id, frame_number) VALUES (?, ?)",
            (game_id, 1),
        ).lastrowid
        with self.assertRaises(sqlite3.IntegrityError):
            self.connection.execute(
                "INSERT INTO shots (frame_id, shot_number, pin_leave) VALUES (?, ?, ?)",
                (frame_id, 1, 1024),
            )

        self.assertEqual(
            self.connection.execute("PRAGMA foreign_key_check").fetchall(),
            [],
        )


if __name__ == "__main__":
    unittest.main()
