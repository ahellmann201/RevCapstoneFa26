import sqlite3
from pathlib import Path


# Store the database file inside test_database/.
DATABASE_PATH = Path(__file__).resolve().parent / "capstone_test.db"


def get_connection():
    """Open a connection to the test database."""

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row

    # Enforce foreign-key constraints.
    conn.execute("PRAGMA foreign_keys = ON")

    return conn


def initialize_database():
    """Create the tables and populate the test data."""

    directory = Path(__file__).resolve().parent

    schema_path = directory / "schema.sql"
    seed_path = directory / "seed.sql"

    with get_connection() as conn:
        conn.executescript(schema_path.read_text())
        conn.executescript(seed_path.read_text())

    print(f"Test database initialized: {DATABASE_PATH}")


if __name__ == "__main__":
    initialize_database()