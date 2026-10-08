
from database.connection import get_connection


SCHEMA = """
-- ---------- Users & clients ----------

IF OBJECT_ID('users', 'U') IS NULL
BEGIN
    CREATE TABLE users (
        user_id       INT IDENTITY(1,1) PRIMARY KEY,
        display_name  NVARCHAR(100) NOT NULL,
        username      NVARCHAR(100) NOT NULL UNIQUE,
        password_hash VARBINARY(255) NOT NULL,
        email         NVARCHAR(255) NOT NULL UNIQUE,
        main_hand     CHAR(1),

        CONSTRAINT CK_users_main_hand
            CHECK (main_hand IN ('L', 'R'))
    );
END;


IF OBJECT_ID('clients', 'U') IS NULL
BEGIN
    CREATE TABLE clients (
        device              NVARCHAR(255) NOT NULL,
        token               NVARCHAR(500) NOT NULL,
        incorrect_passwords INT NOT NULL DEFAULT 0,
        user_id             INT NOT NULL,

        PRIMARY KEY (user_id, device),

        FOREIGN KEY (user_id)
            REFERENCES users(user_id)
            ON DELETE CASCADE
    );
END;


-- ---------- Locations & establishments ----------

IF OBJECT_ID('master_locations', 'U') IS NULL
BEGIN
    CREATE TABLE master_locations (
        location_id   INT IDENTITY(1,1) PRIMARY KEY,
        location_name NVARCHAR(255) NOT NULL,
        lane_count    INT,
        address       NVARCHAR(500)
    );
END;


IF OBJECT_ID('user_establishments', 'U') IS NULL
BEGIN
    CREATE TABLE user_establishments (
        establishment_id   INT IDENTITY(1,1) PRIMARY KEY,
        establishment_name NVARCHAR(255) NOT NULL,
        lane_count         INT,
        address            NVARCHAR(500),
        user_id            INT NOT NULL,
        location_id        INT,

        FOREIGN KEY (user_id)
            REFERENCES users(user_id)
            ON DELETE CASCADE,

        FOREIGN KEY (location_id)
            REFERENCES master_locations(location_id)
    );
END;


-- ---------- Balls ----------

IF OBJECT_ID('balls', 'U') IS NULL
BEGIN
    CREATE TABLE balls (
        ball_id   INT IDENTITY(1,1) PRIMARY KEY,
        user_id   INT NOT NULL,
        ball_name NVARCHAR(255) NOT NULL,
        weight    INT,
        color     NVARCHAR(100),
        core_type NVARCHAR(100),

        FOREIGN KEY (user_id)
            REFERENCES users(user_id)
            ON DELETE CASCADE
    );
END;


-- ---------- Events ----------

IF OBJECT_ID('events', 'U') IS NULL
BEGIN
    CREATE TABLE events (
        event_id    INT IDENTITY(1,1) PRIMARY KEY,
        user_id     INT NOT NULL,
        event_name  NVARCHAR(255) NOT NULL,
        event_type  NVARCHAR(100),
        location_id INT,

        FOREIGN KEY (user_id)
            REFERENCES users(user_id)
            ON DELETE CASCADE,

        FOREIGN KEY (location_id)
            REFERENCES master_locations(location_id)
    );
END;


-- ---------- Sessions ----------

IF OBJECT_ID('sessions', 'U') IS NULL
BEGIN
    CREATE TABLE sessions (
        session_id       INT IDENTITY(1,1) PRIMARY KEY,
        event_id         INT,
        establishment_id INT,
        date_time        DATETIME2,
        opponent         NVARCHAR(255),
        score            INT,
        record           INT,

        FOREIGN KEY (event_id)
            REFERENCES events(event_id),

        FOREIGN KEY (establishment_id)
            REFERENCES user_establishments(establishment_id)
    );
END;


-- ---------- Games ----------

IF OBJECT_ID('games', 'U') IS NULL
BEGIN
    CREATE TABLE games (
        game_id     INT IDENTITY(1,1) PRIMARY KEY,
        session_id  INT NOT NULL,
        game_number INT NOT NULL,
        lane_number INT,
        game_score  INT,
        game_result INT,

        FOREIGN KEY (session_id)
            REFERENCES sessions(session_id)
            ON DELETE CASCADE
    );
END;


-- ---------- Frames ----------

IF OBJECT_ID('frames', 'U') IS NULL
BEGIN
    CREATE TABLE frames (
        frame_id     INT IDENTITY(1,1) PRIMARY KEY,
        game_id      INT NOT NULL,
        frame_number INT NOT NULL,
        frame_result INT,

        FOREIGN KEY (game_id)
            REFERENCES games(game_id)
            ON DELETE CASCADE,

        CONSTRAINT CK_frames_number
            CHECK (frame_number BETWEEN 1 AND 10)
    );
END;


-- ---------- Shots ----------

IF OBJECT_ID('shots', 'U') IS NULL
BEGIN
    CREATE TABLE shots (
        shot_id     INT IDENTITY(1,1) PRIMARY KEY,
        frame_id    INT NOT NULL,
        shot_number INT NOT NULL,
        throw_type  NVARCHAR(50),
        pin_leave   SMALLINT NOT NULL DEFAULT 0,
        side        NVARCHAR(50),
        position    NVARCHAR(50),
        comment     NVARCHAR(1000),
        ball_id     INT,

        FOREIGN KEY (frame_id)
            REFERENCES frames(frame_id)
            ON DELETE CASCADE,

        FOREIGN KEY (ball_id)
            REFERENCES balls(ball_id),

        CONSTRAINT CK_shots_pin_leave
            CHECK (pin_leave BETWEEN 0 AND 1023)
    );
END;
"""


def create_tables() -> None:
    conn = get_connection()

    try:
        cursor = conn.cursor()

        # Confirm the correct database before making changes
        database_name = cursor.execute(
            "SELECT DB_NAME()"
        ).fetchone()[0]

        if database_name != "revmetrix-26":
            raise RuntimeError(
                f"Wrong database: {database_name}. "
                "Expected revmetrix-26."
            )

        print(f"Connected to: {database_name}")

        # Execute the schema
        cursor.execute(SCHEMA)
        conn.commit()

        # Get all existing tables
        cursor.execute("""
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """)

        tables = [row[0] for row in cursor.fetchall()]

        print(f"Tables found: {len(tables)}")

        for table in tables:
            print(f"  - {table}")

        print("Database setup completed successfully.")

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    create_tables()
