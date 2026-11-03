# Backend tests

Run from the project root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest Database/tests -q
```

These offline API, unit, and temporary SQLite integration tests need no SSH tunnel, running server, SQL Server
credentials, or installed ODBC system driver. The Python pyodbc package is still
required to import the backend. Tests block real pyodbc connections, prevent API
startup from loading .env, and use a temporary test signing key.

Coverage includes health and resource cleanup, registration/password hashing,
login/JWT failures, profile changes, all bowling resource route groups, ball CRUD,
reference rejection, validation, pagination, pin masks, UTC conversion, CORS, and
safe database error responses.

Database results are mocked. Ownership tests verify scoped query parameters and
the API's response when no owned record is returned; they do not execute SQL
Server ownership expressions or prove live database isolation. SQL syntax,
constraints, cascades, concurrency, and complete save/reload workflows still need
integration tests against an explicitly designated disposable SQL Server database.
No tests here create or delete records on the shared development server.


The combined command `npm.cmd run test` also includes the frontend tests. The
SQLite schema tests and isolated API scenario create temporary databases, not the
persistent app test database. The scenario exercises real SQL for accounts,
establishment details, a complete saved game, statistics, updates, cross-account
rejections, and cascading deletion. SQL Server unit tests still use mocks; the
migration tests do not apply changes to a real SQL Server instance.

## Remote SQL Server integration test

Ask a SQL Server administrator to provision a separate database named
`revmetrix_integration_test` on the remote server and apply the current schema
from `Database/database/table_setup.py`, including the establishment columns and password reset table.
Use a dedicated login with read/write permissions only in that database. The
runner does not create a database, apply migrations, or use the normal `.env`.

Install `requirements-dev.txt` and Microsoft ODBC Driver 18. Connect your
approved SSH tunnel if the remote database is private. Create a config file
**outside the repository** with these settings:

```dotenv
DB_SERVER=127.0.0.1,14330
DB_NAME=revmetrix_integration_test
DB_USER=your_dedicated_test_login
DB_PASSWORD=your_test_password
```

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m Database.tests.sqlserver_integration --config "$env:USERPROFILE\revmetrix-sql-test.env"
```

macOS Terminal:

```bash
./.venv/bin/python -m Database.tests.sqlserver_integration --config "$HOME/revmetrix-sql-test.env"
```

The runner checks the configured and connected database names before writing.
It exercises the FastAPI app in process against real SQL Server: authentication,
establishment edits, ball filters, game storage, scoring, ownership and cascades.
It creates uniquely named accounts and attempts to remove their records even if
an assertion fails. An interrupted run can leave test records behind. It does
not call the hosted HTTPS API or run as part of `npm run test`.
