"""Exercise both release migrations twice inside a rolled-back transaction."""
from contextlib import closing
from pathlib import Path

from Database.database.password_reset_schema import SQLSERVER_RESET_SCHEMA
from Database.database.table_setup import SCHEMA


def check_migrations(connection):
    with closing(connection.cursor()) as cursor:
        cursor.execute("SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0")
        if cursor.fetchone()[0] != 0:
            raise RuntimeError("Migration check requires an empty dedicated test database.")
        if connection.autocommit:
            raise RuntimeError("Migration check requires transactional connections.")
        legacy_schema = SCHEMA.removesuffix(SQLSERVER_RESET_SCHEMA).replace(
            "        foul        BIT NOT NULL DEFAULT 0,\n", ""
        )
        foul_path = Path(__file__).resolve().parents[1] / "scripts" / "migrate_shot_fouls.sql"
        foul_migration = "\n".join(line for line in foul_path.read_text(encoding="utf-8-sig").splitlines()
                                   if line.strip().upper() != "GO")
        try:
            cursor.execute("BEGIN TRANSACTION")
            cursor.execute(legacy_schema)
            cursor.execute("INSERT INTO users (display_name, username, password_hash, email) OUTPUT INSERTED.user_id VALUES (?, ?, ?, ?)",
                           ("Migration test", "migration_fixture", b"fixture-only", "migration@example.com"))
            user_id = cursor.fetchone()[0]
            cursor.execute("INSERT INTO sessions OUTPUT INSERTED.session_id DEFAULT VALUES")
            session_id = cursor.fetchone()[0]
            cursor.execute("INSERT INTO games (session_id, game_number) OUTPUT INSERTED.game_id VALUES (?, 1)", (session_id,))
            game_id = cursor.fetchone()[0]
            cursor.execute("INSERT INTO frames (game_id, frame_number) OUTPUT INSERTED.frame_id VALUES (?, 1)", (game_id,))
            frame_id = cursor.fetchone()[0]
            cursor.execute("INSERT INTO shots (frame_id, shot_number, pin_leave) OUTPUT INSERTED.shot_id VALUES (?, 1, 1023)", (frame_id,))
            shot_id = cursor.fetchone()[0]
            for _ in range(2):
                cursor.execute(foul_migration)
                cursor.execute(SQLSERVER_RESET_SCHEMA)
                cursor.execute("SELECT frame_id, shot_number, pin_leave, foul FROM shots WHERE shot_id = ?", (shot_id,))
                assert tuple(cursor.fetchone()) == (frame_id, 1, 1023, False)
                cursor.execute("SELECT username, password_hash FROM users WHERE user_id = ?", (user_id,))
                assert tuple(cursor.fetchone()) == ("migration_fixture", b"fixture-only")
            cursor.execute("INSERT INTO password_resets (user_id, token_hash, issued_at, expires_at) VALUES (?, ?, 1, 2)",
                           (user_id, "a" * 64))
            cursor.execute("SELECT token_hash FROM password_resets WHERE user_id = ?", (user_id,))
            assert cursor.fetchone()[0] == "a" * 64
        finally:
            connection.rollback()
        cursor.execute("SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0")
        assert cursor.fetchone()[0] == 0
    print("Both SQL Server migrations preserved existing rows on two runs; test schema rolled back.")
