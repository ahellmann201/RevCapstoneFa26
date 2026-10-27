"""SQLite equivalent of the SQL Server schema used by the current API."""

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash BLOB NOT NULL,
    email TEXT NOT NULL UNIQUE,
    main_hand TEXT CHECK (main_hand IN ('L', 'R'))
);

CREATE TABLE IF NOT EXISTS clients (
    device TEXT NOT NULL,
    token TEXT NOT NULL,
    incorrect_passwords INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, device),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS master_locations (
    location_id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_name TEXT NOT NULL,
    lane_count INTEGER,
    address TEXT
);

CREATE TABLE IF NOT EXISTS user_establishments (
    establishment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    establishment_name TEXT NOT NULL,
    lane_count INTEGER,
    address TEXT,
    user_id INTEGER NOT NULL,
    location_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES master_locations(location_id)
);

CREATE TABLE IF NOT EXISTS balls (
    ball_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ball_name TEXT NOT NULL,
    weight INTEGER,
    color TEXT,
    core_type TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    event_type TEXT,
    location_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES master_locations(location_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    establishment_id INTEGER,
    date_time TEXT,
    opponent TEXT,
    score INTEGER,
    record INTEGER,
    FOREIGN KEY (event_id) REFERENCES events(event_id),
    FOREIGN KEY (establishment_id) REFERENCES user_establishments(establishment_id)
);

CREATE TABLE IF NOT EXISTS games (
    game_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    game_number INTEGER NOT NULL,
    lane_number INTEGER,
    game_score INTEGER,
    game_result INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS frames (
    frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    frame_number INTEGER NOT NULL CHECK (frame_number BETWEEN 1 AND 10),
    frame_result INTEGER,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shots (
    shot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_id INTEGER NOT NULL,
    shot_number INTEGER NOT NULL,
    throw_type TEXT,
    pin_leave INTEGER NOT NULL DEFAULT 0 CHECK (pin_leave BETWEEN 0 AND 1023),
    side TEXT,
    position TEXT,
    comment TEXT,
    ball_id INTEGER,
    FOREIGN KEY (frame_id) REFERENCES frames(frame_id) ON DELETE CASCADE,
    FOREIGN KEY (ball_id) REFERENCES balls(ball_id)
);
"""


def initialize_schema(connection):
    connection.executescript(SCHEMA)
    connection.commit()
