# Backend tests

Run from the project root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest Database/tests -q
```

These offline API and unit tests need no SSH tunnel, running server, SQL Server
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
