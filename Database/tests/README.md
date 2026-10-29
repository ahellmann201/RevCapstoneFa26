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
