import hmac
import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr
from pwdlib import PasswordHash

from Database.database.connection import DB_TYPE, DatabaseError, IntegrityError, get_connection


router = APIRouter(prefix="/auth", tags=["Authentication"])

password_hasher = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)

# Used so unknown usernames still perform a password verification.
DUMMY_HASH = password_hasher.hash("not-a-real-account-password")

TOKEN_MINUTES = 30
TOKEN_ISSUER = "revmetrix-api"
TOKEN_AUDIENCE = "revmetrix-client"


Language = Literal["en", "es", "fr", "de", "zh-CN"]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(
        min_length=1,
        max_length=100,
        pattern=r"\S",
    )
    username: str = Field(
        min_length=3,
        max_length=100,
        pattern=r"^[A-Za-z0-9_.-]+$",
    )
    email: EmailStr = Field(max_length=255)
    password: SecretStr = Field(min_length=8, max_length=128)
    main_hand: Literal["L", "R"] | None = None
    main_language: Language = "en"


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=100)
    password: SecretStr = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    user_id: int
    display_name: str
    username: str
    email: str
    main_hand: Literal["L", "R"] | None
    main_language: Language = "en"


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = TOKEN_MINUTES * 60


def signing_secret() -> str:
    secret = os.getenv("JWT_SECRET", "")

    if len(secret) < 64:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured",
        )

    return secret


def password_stamp(secret: str, encoded_hash: bytes) -> str:
    return hmac.digest(secret.encode(), b"password-version:" + encoded_hash, "sha256").hex()


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Invalid credentials or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )


@contextmanager
def database():
    connection = None

    try:
        connection = get_connection()
        try:
            yield connection
        finally:
            connection.close()

    except (DatabaseError, KeyError):
        # Do not expose raw database errors or configuration values.
        raise HTTPException(
            status_code=503,
            detail="Authentication database unavailable",
        ) from None


def user_response(row) -> UserResponse:
    return UserResponse(
        user_id=row[0],
        display_name=row[1],
        username=row[2],
        email=row[3],
        main_hand=row[4],
        main_language=row[5] if len(row) > 5 else "en",
    )


def inserted_columns() -> str:
    columns = "user_id, display_name, username, email, main_hand, main_language"
    if DB_TYPE == "sqlite":
        return f"RETURNING {columns}"
    return "OUTPUT " + ", ".join(
        f"INSERTED.{column}" for column in columns.split(", ")
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201,
)
def register(data: RegisterRequest) -> UserResponse:
    # Ensure login is configured before creating an account.
    signing_secret()

    encoded_hash = password_hasher.hash(
        data.password.get_secret_value()
    ).encode("utf-8")

    with database() as connection:
        cursor = connection.cursor()

        try:
            try:
                insert_sql = (
                    """
                    INSERT INTO users (
                        display_name,
                        username,
                        password_hash,
                        email,
                        main_hand,
                        main_language
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    RETURNING user_id, display_name, username, email, main_hand, main_language
                    """
                    if DB_TYPE == "sqlite"
                    else f"""
                    INSERT INTO users (
                        display_name,
                        username,
                        password_hash,
                        email,
                        main_hand,
                        main_language
                    )
                    {inserted_columns()}
                    VALUES (?, ?, ?, ?, ?, ?)
                    """
                )
                cursor.execute(
                    insert_sql,
                    (
                        data.display_name.strip(),
                        data.username,
                        encoded_hash,
                        str(data.email),
                        data.main_hand,
                        data.main_language,
                    ),
                )

                result = user_response(cursor.fetchone())
                connection.commit()

            except IntegrityError:
                connection.rollback()

                raise HTTPException(
                    status_code=409,
                    detail="Account could not be created with those details",
                ) from None

        finally:
            cursor.close()

    return result


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, response: Response) -> TokenResponse:
    secret = signing_secret()

    with database() as connection:
        cursor = connection.cursor()

        try:
            cursor.execute(
                """
                SELECT user_id, password_hash
                FROM users
                WHERE username = ?
                """,
                (data.username,),
            )
            row = cursor.fetchone()

        finally:
            cursor.close()

    stored_hash = DUMMY_HASH

    if row is not None:
        try:
            stored_hash = bytes(row[1]).decode("utf-8")
        except (TypeError, UnicodeDecodeError):
            stored_hash = DUMMY_HASH

    try:
        valid_password = password_hasher.verify(
            data.password.get_secret_value(),
            stored_hash,
        )
    except Exception:
        # Malformed/unsupported stored hashes must not reveal internals.
        valid_password = False

    if row is None or not valid_password or stored_hash == DUMMY_HASH:
        raise unauthorized()

    now = datetime.now(timezone.utc)

    token = jwt.encode(
        {
            "sub": str(row[0]),
            "pwd": password_stamp(secret, bytes(row[1])),
            "iat": now,
            "exp": now + timedelta(minutes=TOKEN_MINUTES),
            "iss": TOKEN_ISSUER,
            "aud": TOKEN_AUDIENCE,
        },
        secret,
        algorithm="HS256",
    )

    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"

    return TokenResponse(access_token=token)


def current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer),
    ],
) -> UserResponse:
    if credentials is None:
        raise unauthorized()

    secret = signing_secret()

    try:
        claims = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            issuer=TOKEN_ISSUER,
            audience=TOKEN_AUDIENCE,
            options={
                "require": ["sub", "iat", "exp", "iss", "aud", "pwd"],
            },
        )

        subject = claims["sub"]

        if not isinstance(subject, str) or not subject.isascii():
            raise ValueError("Invalid subject")

        if not subject.isdecimal():
            raise ValueError("Invalid subject")

        user_id = int(subject)

        if not 1 <= user_id <= 2147483647:
            raise ValueError("Invalid subject")

    except (InvalidTokenError, ValueError, TypeError):
        raise unauthorized() from None

    with database() as connection:
        cursor = connection.cursor()

        try:
            cursor.execute(
                """
                SELECT
                    user_id,
                    display_name,
                    username,
                    email,
                    main_hand,
                    password_hash,
                    main_language
                FROM users
                WHERE user_id = ?
                """,
                (user_id,),
            )
            row = cursor.fetchone()

        finally:
            cursor.close()

    stamp = claims["pwd"]
    if row is None or not isinstance(stamp, str) or not stamp.isascii() or not hmac.compare_digest(
        stamp, password_stamp(secret, bytes(row[5]))
    ):
        raise unauthorized()

    return user_response((*row[:5], row[6] if len(row) > 6 else "en"))


@router.get("/me", response_model=UserResponse)
def me(
    user: Annotated[UserResponse, Depends(current_user)],
) -> UserResponse:
    return user


class LanguageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    main_language: Language


@router.put("/me/language", response_model=UserResponse)
def update_language(
    data: LanguageRequest,
    user: Annotated[UserResponse, Depends(current_user)],
) -> UserResponse:
    with database() as connection:
        cursor = connection.cursor()
        try:
            try:
                cursor.execute(
                    "UPDATE users SET main_language = ? WHERE user_id = ?",
                    (data.main_language, user.user_id),
                )
                cursor.execute(
                    "SELECT user_id, display_name, username, email, main_hand, main_language "
                    "FROM users WHERE user_id = ?",
                    (user.user_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Account not found")
                result = user_response(row)
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        finally:
            cursor.close()
    return result
