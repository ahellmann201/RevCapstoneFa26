import hashlib
import hmac
import secrets

from api.config import DB_TYPE

# Select the configured adapter once; API handlers use the same repository
# functions regardless of whether development SQL Server or test SQLite is active.
if DB_TYPE == "sqlite":
    from test_database.connection import get_connection
elif DB_TYPE == "sqlserver":
    from Database.database.connection import get_connection
else:
    raise RuntimeError(f"Unsupported database type: {DB_TYPE}")

PASSWORD_HASH_ITERATIONS = 600_000
PASSWORD_HASH_PREFIX = "pbkdf2_sha256"


def _hash_password(password: str) -> str:
    """Return a salted PBKDF2 hash in a self-describing storage format."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return (
        f"{PASSWORD_HASH_PREFIX}${PASSWORD_HASH_ITERATIONS}$"
        f"{salt.hex()}${digest.hex()}"
    )


def _password_matches(password: str, stored_hash: str | bytes) -> bool:
    if isinstance(stored_hash, bytes):
        stored_hash = stored_hash.decode("utf-8")

    try:
        scheme, iterations, salt_hex, digest_hex = stored_hash.split("$", 3)
        if scheme != PASSWORD_HASH_PREFIX:
            return False

        expected_digest = bytes.fromhex(digest_hex)
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
        return hmac.compare_digest(actual_digest, expected_digest)
    except (AttributeError, UnicodeDecodeError, ValueError):
        return False


def create_account(name: str, email: str, password: str) -> int | None:
    """Create an account and return its ID, or None if its email is taken."""
    conn = get_connection()

    try:
        cursor = conn.cursor()
        if DB_TYPE == "sqlite":
            cursor.execute(
                "SELECT User_ID FROM USERS WHERE Email = ? OR Username = ?",
                (email, email),
            )
        else:
            cursor.execute(
                "SELECT user_id FROM users WHERE email = ? OR username = ?",
                (email, email),
            )

        if cursor.fetchone() is not None:
            return None

        password_hash = _hash_password(password)

        if DB_TYPE == "sqlite":
            cursor.execute(
                """
                INSERT INTO USERS (Display_Name, Username, Password, Email, Main_Hand)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, email, password_hash, email, "both"),
            )
            user_id = cursor.lastrowid
        else:
            cursor.execute(
                """
                INSERT INTO users (display_name, username, password_hash, email)
                OUTPUT INSERTED.user_id
                VALUES (?, ?, ?, ?)
                """,
                (name, email, password_hash.encode("utf-8"), email),
            )
            user_id = cursor.fetchone()[0]

        conn.commit()
        return user_id
    finally:
        conn.close()


def validate_login(email: str, password: str) -> int | None:
    """Find an account and verify its password for the configured database."""
    conn = get_connection()

    try:
        cursor = conn.cursor()
        if DB_TYPE == "sqlite":
            cursor.execute(
                """
                SELECT User_ID, Password
                FROM USERS
                WHERE Email = ? OR Username = ?
                """,
                (email, email),
            )
            row = cursor.fetchone()
            if row is None:
                return None

            user_id = row["User_ID"]
            stored_hash = row["Password"]
        else:
            cursor.execute(
                """
                SELECT user_id, password_hash
                FROM users
                WHERE email = ? OR username = ?
                """,
                (email, email),
            )
            row = cursor.fetchone()
            if row is None:
                return None

            user_id = row.user_id
            stored_hash = row.password_hash

        # Existing SQLite seed accounts use plain text; verify them and replace
        # the stored value with a salted hash on the first successful login.
        if isinstance(stored_hash, str) and not stored_hash.startswith(
            f"{PASSWORD_HASH_PREFIX}$"
        ):
            if not hmac.compare_digest(stored_hash, password):
                return None
            if DB_TYPE == "sqlite":
                cursor.execute(
                    "UPDATE USERS SET Password = ? WHERE User_ID = ?",
                    (_hash_password(password), user_id),
                )
                conn.commit()
            return user_id

        if _password_matches(password, stored_hash):
            return user_id
        return None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    """Retrieve a user by ID and return a JSON-ready profile record.

    The API consumes a plain mapping rather than driver-specific row objects,
    which keeps response serialization consistent across SQLite and SQL Server.
    """

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT User_ID, Username, Display_Name, Main_Hand
            FROM USERS
            WHERE User_ID = ?
            """,
            (user_id,)
        )
        row = cursor.fetchone()

        if row is None:
            return None

        # SQLite rows are mapping-like; pyodbc rows expose named attributes.
        # Normalize both to the same API response shape.
        if DB_TYPE == "sqlite":
            return dict(row)

        return {
            "User_ID": row.User_ID,
            "Username": row.Username,
            "Display_Name": row.Display_Name,
        }

    finally:
        # Connections are short-lived for these simple requests; always release
        # them, including when query execution or row conversion raises.
        conn.close()


def update_display_name(user_id: int, display_name: str) -> bool:
    """Update a user's display name; return whether a row was changed."""

    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE USERS
            SET Display_Name = ?
            WHERE User_ID = ?
            """,
            (display_name, user_id)
        )
        conn.commit()

        return cursor.rowcount > 0

    finally:
        conn.close()
