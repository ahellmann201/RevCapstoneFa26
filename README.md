# RevCapstoneFa26
https://lucid.app/lucidspark/b331f15c-ab04-4a91-9431-1e1df06ae60a/edit?beaconFlowId=C329386C8C156C92&page=0_0&invitationId=inv_bc223a45-ad5f-4d7e-ae88-da50ea4d7955#


## Initial FastAPI backend

The API currently exposes health checks only. It does not expose CRUD
operations or provide authentication.

### Windows setup

Open PowerShell at the project root:

```powershell
cd C:\SCHOOL\capstone\RevCapstoneFa26
```

Create a root virtual environment if `.venv` does not already exist:

```powershell
py -m venv .venv
```

Install dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Activation is optional because these commands explicitly use the virtual
environment's Python.

### Run the API

From the project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn Database.api.main:app --reload --host 127.0.0.1 --port 8000
```

Alternatively, open the project root in VS Code, install the Python and
Python Debugger extensions, and select the "Run FastAPI" launch configuration.

Check the API from another PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected response:

```json
{"status": "ok"}
```

Interactive API documentation is available at:
http://127.0.0.1:8000/docs

Teammates can test `/health` without database credentials, an SSH tunnel,
or the SQL Server ODBC system driver.

The development server binds to this computer's loopback address.
The `--reload` option is for development.

### Optional database connectivity check

Install Microsoft ODBC Driver 18 for SQL Server separately:
https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

The driver is a Windows system dependency; installing `pyodbc` with pip
does not install it.

For database access through SSH, keep a tunnel running in a separate
terminal. Use the actual SSH host and database destination supplied by
the project administrator:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:14330:DB_HOST:DB_PORT SSH_USER@SSH_HOST
```

Replace the uppercase placeholders before running the command. The
database destination is resolved and reached from the SSH host. If SQL
Server runs on that host itself, the destination may be `127.0.0.1:1433`;
confirm the project's actual topology.

Each teammate needs authorized SSH access using their own key and
authorized database credentials. Do not share or commit private keys.

Create a local `.env` at the project root:

```dotenv
API_ENABLE_DB_HEALTH=true
DB_SERVER=127.0.0.1,14330
DB_NAME=replace_with_database_name
DB_USER=replace_with_database_user
DB_PASSWORD=replace_with_database_password
```

Use real credentials only in the ignored local `.env`, never in committed
files. Do not commit connection strings or private keys.

Restart the API, then check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health/db
```

Results:
- 200: the existing connection function successfully ran `SELECT 1`.
- 503: configuration, connection, query, or resource cleanup failed.
  The response intentionally does not disclose database error details.
- 404: the optional endpoint is disabled.

Remove `API_ENABLE_DB_HEALTH` or set it to `false`, then restart, to disable
the database check.

### Existing repository tests

These tests require database access and create, update, and delete
temporary records. Run them against an approved development/test database.

From the project root:

```powershell
Push-Location Database
try {
    ..\.venv\Scripts\python.exe -m tests.run_tests
}
finally {
    Pop-Location
}
```