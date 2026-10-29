import os
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

app = FastAPI(
    title="RevMetrix API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    # Local demo frontends on private IPv4 networks, on Vite's fixed port.
    allow_origin_regex=(
        r"http://(?:10(?:\.\d{1,3}){3}|"
        r"192\.168(?:\.\d{1,3}){2}|"
        r"172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):5173"
    ),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health", tags=["Health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


def database_health() -> dict[str, str]:
    try:
        from Database.database.connection import get_connection

        connection = get_connection()

        try:
            cursor = connection.cursor()

            try:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()

                if result is None or result[0] != 1:
                    raise RuntimeError("Unexpected connectivity result")
            finally:
                cursor.close()
        finally:
            connection.close()

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connectivity check unavailable",
        ) from None

    return {
        "status": "ok",
        "database": "reachable",
    }


if os.getenv("API_ENABLE_DB_HEALTH", "").strip().lower() == "true":
    app.add_api_route(
        "/health/db",
        database_health,
        methods=["GET"],
        tags=["Health"],
    )


# Load routers after loading the root environment file.
from Database.api.auth import (
    UserResponse,
    current_user,
    database,
    inserted_columns,
    router as auth_router,
    user_response,
)
from Database.api.balls import router as balls_router
from Database.api.bowling import router as bowling_router
from Database.api.statistics import router as statistics_router

app.include_router(auth_router)
app.include_router(balls_router)
app.include_router(bowling_router)
app.include_router(statistics_router)


@app.on_event("startup")
def migrate_local_establishments():
    from Database.database.connection import DB_TYPE, get_connection
    if DB_TYPE == "sqlite":
        from Database.database.sqlite_schema import migrate_establishments
        connection = get_connection()
        try:
            migrate_establishments(connection)
            connection.commit()
        finally:
            connection.close()


class DisplayNameRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    value: str = Field(min_length=1, max_length=100)


@app.put(
    "/auth/me/display-name",
    response_model=UserResponse,
    tags=["Authentication"],
)
def update_display_name(
    data: DisplayNameRequest,
    user: Annotated[UserResponse, Depends(current_user)],
) -> UserResponse:
    with database() as connection:
        cursor = connection.cursor()

        try:
            update_sql = (
                """
                UPDATE users
                SET display_name = ?
                WHERE user_id = ?
                RETURNING user_id, display_name, username, email, main_hand
                """
                if os.getenv("DB_TYPE", "sqlserver").strip().lower() == "sqlite"
                else f"""
                UPDATE users
                SET display_name = ?
                {inserted_columns()}
                WHERE user_id = ?
                """
            )
            cursor.execute(
                update_sql,
                (data.value, user.user_id),
            )

            row = cursor.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Account not found",
                )

            result = user_response(row)
            connection.commit()

        finally:
            cursor.close()

    return result


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "loc": list(error["loc"]),
                    "msg": error["msg"],
                    "type": error["type"],
                }
                for error in exc.errors()
            ]
        },
    )
