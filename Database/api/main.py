import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse



PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

app = FastAPI(
    title="RevMetrix API",
    version="0.1.0",
)


@app.get("/health", tags=["Health"])
def health() -> dict[str, str]:
    """Check API availability without importing or connecting to the database."""
    return {"status": "ok"}


def database_health() -> dict[str, str]:
    """Run a read-only query and explicitly release database resources."""
    try:
        # Import only when this optional endpoint is called.
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
            # A pyodbc connection context manager does not close the connection.
            connection.close()

    except Exception:
        # Do not return or log raw driver errors, connection strings,
        # credentials, server addresses, or environment variable values.
        raise HTTPException(
            status_code=503,
            detail="Database connectivity check unavailable",
        ) from None

    return {"status": "ok", "database": "reachable"}


# Disabled by default. Restart the API after changing this setting.
if os.getenv("API_ENABLE_DB_HEALTH", "").strip().lower() == "true":
    app.add_api_route(
        "/health/db",
        database_health,
        methods=["GET"],
        tags=["Health"],
    )



# Import after the root .env has been loaded.
from Database.api.auth import router as auth_router
from Database.api.balls import router as balls_router
from Database.api.bowling import router as bowling_router


app.include_router(auth_router)
app.include_router(balls_router)
app.include_router(bowling_router)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    # Avoid echoing submitted passwords or other request values.
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