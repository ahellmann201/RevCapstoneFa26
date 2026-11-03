# api/config.py

import os

APP_ENV = os.getenv("APP_ENV", "development")
DB_TYPE = os.getenv("DB_TYPE", "sqlserver")

if APP_ENV not in {"development", "test"}:
    raise RuntimeError(f"Invalid APP_ENV: {APP_ENV}")

if APP_ENV == "test" and DB_TYPE != "sqlite":
    raise RuntimeError("Test mode must use SQLite.")

if APP_ENV == "development" and DB_TYPE != "sqlserver":
    raise RuntimeError("Development mode must use SQL Server.")