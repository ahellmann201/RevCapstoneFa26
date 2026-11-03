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

## Repeat both SQL Server migrations

Use `--check-migrations` with the SQL Server runner and its existing `--config`
argument. This mode requires an **empty** `revmetrix_integration_test` database
and a test-only login allowed to create and alter tables in its `dbo` schema.
It builds the old schema, inserts a user and shot, applies both migrations twice,
checks the old records and the new columns, and rolls the transaction back.
It refuses a database that already has user tables. Run this mode before
provisioning the current schema for the regular SQL Server API scenario.

The regular API scenario also races two independent requests using the same reset
token and expects one success and one rejection. Delivery is faked in that test.

## Browser smoke tests

Activate the project virtual environment and install the optional browser tools.
Use `.venv\Scripts\Activate.ps1` on Windows PowerShell or
`source .venv/bin/activate` on macOS. Install the project dependencies first.

```sh
python -m pip install playwright
python -m playwright install chromium
python -m Database.tests.browser_smoke foul
```

Stop any local frontend or API using ports 5173 or 8000 first. The foul test starts its own local API
and frontend and uses a disposable SQLite database. It saves a foul through the
UI, logs in again in a fresh browser context, and checks the restored F marker,
zero credited pins, and all ten standing pins. No deployed accounts are used.

After the HTTPS recovery page and real email delivery are configured, register a
**dedicated** test account with a username beginning `recovery_test_` and a test
inbox you control. This check intentionally changes that account's password:

```sh
python -m Database.tests.browser_smoke email --api https://api.revmetrix.io --page https://YOUR-FRONTEND/reset_password.html --username recovery_test_demo --email YOUR-TEST-INBOX
```

Use the exact published recovery page URL. The script prompts for passwords and
for the link you receive in the test inbox, without echoing them. It requests an
email through the browser, completes the reset in a separate browser context, and
checks that the old login and token fail while the new password works. Do not
share the reset link or raw browser traces. This is an interactive live test,
not part of the regular offline suite.
