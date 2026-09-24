import sqlite3

SCHEMA = """
PRAGMA foreign_keys = ON;

-- ---------- Users & clients ----------
CREATE TABLE IF NOT EXISTS users (
    user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name  TEXT NOT NULL,
    username      TEXT NOT NULL UNIQUE,
    password      TEXT NOT NULL,            
    email         TEXT NOT NULL UNIQUE,
    main_hand     CHAR(1) CHECK (main_hand IN ('L', 'R'))
);

CREATE TABLE IF NOT EXISTS clients (
    device              TEXT NOT NULL,
    token               TEXT NOT NULL,
    incorrect_passwords INTEGER NOT NULL DEFAULT 0,
    user_id             INTEGER NOT NULL,
    PRIMARY KEY (user_id, device),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ---------- Locations & establishments ----------
CREATE TABLE IF NOT EXISTS master_locations (
    location_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    location_name TEXT NOT NULL,
    lane_count    INTEGER,
    address       TEXT
);

CREATE TABLE IF NOT EXISTS user_establishments (
    establishment_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    establishment_name TEXT NOT NULL,
    lane_count         INTEGER,
    address            TEXT,
    user_id            INTEGER NOT NULL,
    location_id        INTEGER,             -- optional link to master list
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES master_locations(location_id)
);

-- ---------- Events / sessions / games / frames / shots ----------
CREATE TABLE IF NOT EXISTS events (
    event_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name    TEXT NOT NULL,
    average_score REAL,
    statistics    TEXT,                     -- JSON blob
    event_type    TEXT
);

CREATE TABLE IF NOT EXISTS establishments_events (
    establishment_id INTEGER NOT NULL,
    event_id         INTEGER NOT NULL,
    PRIMARY KEY (establishment_id, event_id),
    FOREIGN KEY (establishment_id) REFERENCES user_establishments(establishment_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_time  TEXT,                        -- ISO 8601
    opponent   TEXT,
    score      INTEGER,
    stats      TEXT,                        -- JSON blob
    record     INTEGER
);

CREATE TABLE IF NOT EXISTS events_sessions (
    event_id       INTEGER NOT NULL,
    session_id     INTEGER NOT NULL,
    session_number INTEGER,
    session_type   TEXT,
    PRIMARY KEY (event_id, session_id),
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS games (
    game_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    lane_number INTEGER,
    game_score  INTEGER,
    game_result INTEGER
);

CREATE TABLE IF NOT EXISTS sessions_games (
    session_id  INTEGER NOT NULL,
    game_id     INTEGER NOT NULL,
    game_number INTEGER,
    PRIMARY KEY (session_id, game_id),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frames (
    frame_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_result INTEGER
);

CREATE TABLE IF NOT EXISTS games_frames (
    game_id      INTEGER NOT NULL,
    frame_id     INTEGER NOT NULL,
    frame_number INTEGER,
    PRIMARY KEY (game_id, frame_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    FOREIGN KEY (frame_id) REFERENCES frames(frame_id) ON DELETE CASCADE
);

-- ---------- Balls ----------
CREATE TABLE IF NOT EXISTS balls (
    ball_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    ball_name TEXT NOT NULL,
    weight    INTEGER,
    color     TEXT,
    core_type TEXT
);

CREATE TABLE IF NOT EXISTS user_balls (
    user_id INTEGER NOT NULL,
    ball_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, ball_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (ball_id) REFERENCES balls(ball_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shots (
    shot_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    throw_type TEXT,
    pin_leave  TEXT,                        -- e.g. "7,10" (pins left standing)
    side       TEXT,
    position   TEXT,
    comment    TEXT,
    ball_id    INTEGER,
    FOREIGN KEY (ball_id) REFERENCES balls(ball_id)
);

CREATE TABLE IF NOT EXISTS frames_shots (
    frame_id    INTEGER NOT NULL,
    shot_id     INTEGER NOT NULL,
    shot_number INTEGER,
    PRIMARY KEY (frame_id, shot_id),
    FOREIGN KEY (frame_id) REFERENCES frames(frame_id) ON DELETE CASCADE,
    FOREIGN KEY (shot_id) REFERENCES shots(shot_id) ON DELETE CASCADE
);
"""


def create_database(path: str = "bowling.db") -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


if __name__ == "__main__":
    conn = create_database()
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    print("Created tables:", ", ".join(t[0] for t in tables))
    conn.close()