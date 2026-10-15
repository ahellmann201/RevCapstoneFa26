# RevCapstoneFa26

RevMetrix backend for tracking bowling equipment, events, sessions, games,
frames, and shots.

[Project planning board](https://lucid.app/lucidspark/b331f15c-ab04-4a91-9431-1e1df06ae60a/edit)

## Backend features

- API and optional database health checks
- Account registration and login
- Argon2 password hashing
- JWT bearer authentication with 30-minute access tokens
- Protected CRUD endpoints for bowling records
- Ownership checks for records and linked resources
- Authenticated read-only access to shared master locations
- Paginated record lists

The API stores bowling data but does not automatically calculate scores
or enforce complete bowling scoring rules.

## Windows setup

Open PowerShell at the project root:

```powershell
cd C:\SCHOOL\capstone\RevCapstoneFa26
```

Use your own checkout path if different.

Create a virtual environment if `.venv` does not already exist:

```powershell
py -m venv .venv
```

Install dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The root `requirements.txt` should contain:

```text
fastapi
uvicorn
pyodbc
python-dotenv
pwdlib[argon2]
PyJWT
email-validator
```

Activation is optional because the commands explicitly use the virtual
environment's Python.

## Local environment configuration

Create `.env` in the project root, alongside `requirements.txt`.
Do not place it inside `Database`.

```dotenv
API_ENABLE_DB_HEALTH=true
DB_SERVER=127.0.0.1,14330
DB_NAME=replace_with_database_name
DB_USER=replace_with_database_user
DB_PASSWORD="replace_with_database_password"
JWT_SECRET=replace_with_generated_secret
```

Generate a JWT signing secret:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Copy the generated value into `JWT_SECRET`. The authentication code requires
a value at least 64 characters long.

Keep this secret consistent between restarts. Changing it invalidates
previously issued tokens.

The database credentials in `.env` are for SQL Server access. They are
separate from application accounts created through `/auth/register`.

Never commit `.env`, passwords, access tokens, or private keys.

Include these entries in `.gitignore`:

```gitignore
.env
.env.*
.venv/
venv/
__pycache__/
*.py[cod]
scripts/start-tunnel.ps1
```

## Database system dependency

Database operations require Microsoft ODBC Driver 18 for SQL Server.

[Download the driver from Microsoft](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

This is a Windows system dependency. Installing `pyodbc` with pip does
not install the driver.

The basic `/health` endpoint does not require database credentials,
an SSH tunnel, or the SQL Server ODBC driver. Install the Python
requirements before starting the API.

## SSH database tunnel

For local access to the remote database, keep an SSH tunnel running in
a separate terminal:

```powershell
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:14330:DB_HOST:DB_PORT SSH_USER@SSH_HOST
```

Replace the uppercase placeholders with the project's approved connection
details.

`DB_HOST` and `DB_PORT` identify the database destination as reached from
the SSH host. They may differ from the public SSH address.

With this tunnel, use:

```dotenv
DB_SERVER=127.0.0.1,14330
```

Leave the terminal open while using the database. A connected tunnel may
show no output. Press Ctrl+C to close it.

If you created a personal tunnel script, run it from the project root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-tunnel.ps1
```

The script is optional and must exist before using that command. Keep
personal connection details out of committed files.

Each developer running a local backend needs authorized database and SSH
access. Do not share private keys.

## Run the API

In another terminal, from the project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn Database.api.main:app --reload --host 127.0.0.1 --port 8000
```

Leave the terminal running.

Alternatively, open the project root in VS Code, install the Python and
Python Debugger extensions, and select the `Run FastAPI` launch
configuration.

- API documentation: http://127.0.0.1:8000/docs
- Basic health check: http://127.0.0.1:8000/health
- Optional database check: http://127.0.0.1:8000/health/db

The server binds to this computer's loopback address. The `--reload`
option is for development.

Restart the API after changing `.env`; environment-file changes may not
trigger an automatic reload.

## Health checks

### API health

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

This checks API availability without connecting to the database.

### Database health

Enable the optional endpoint in the root `.env`:

```dotenv
API_ENABLE_DB_HEALTH=true
```

Restart the API, then run:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health/db
```

Expected response:

```json
{
  "status": "ok",
  "database": "reachable"
}
```

Results:

- `200`: the database connection successfully ran `SELECT 1`.
- `503`: configuration, connection, query, or cleanup failed.
- `404`: the optional endpoint is not registered.

The response does not disclose raw database error details.

Set `API_ENABLE_DB_HEALTH=false` and restart to disable this endpoint.

## Authentication

### Register

In `/docs`, expand `POST /auth/register`, select **Try it out**, and submit:

```json
{
  "display_name": "Example User",
  "username": "your_username",
  "email": "you@example.com",
  "password": "replace-with-a-unique-long-password",
  "main_hand": "R"
}
```

Registration creates a real database record.

- Passwords must contain 15–128 characters.
- Usernames must contain 3–100 characters and use letters, numbers,
  underscores, periods, or hyphens.
- `main_hand` may be `"L"`, `"R"`, or `null`.
- Password hashes are stored instead of plaintext passwords.

A successful registration returns `201` and the account details.
Conflicting account details return `409`.

### Log in

Use `POST /auth/login`:

```json
{
  "username": "your_username",
  "password": "replace-with-your-password"
}
```

A successful response contains:

```json
{
  "access_token": "generated-token",
  "token_type": "bearer",
  "expires_in": 1800
}
```

Use application-account credentials, not `DB_USER` and `DB_PASSWORD`.

### Authorize requests

In `/docs`:

1. Copy the `access_token` value from the login response.
2. Click **Authorize**.
3. Clear any previous authorization using **Logout**.
4. Paste only the token, without quotation marks or the word `Bearer`.
5. Click **Authorize**, then close the dialog.
6. Run `GET /auth/me` to verify the authenticated account.

Outside the documentation UI, send the token in this header:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Access tokens expire after 30 minutes. Log in again to obtain a fresh one.

The Swagger **Logout** button clears its saved token. It does not revoke
an already issued token on the server.

## API endpoints

Except for health checks, the following endpoints require authentication.
Registration and login accept unauthenticated requests.

| Resource | Endpoints |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Balls | `POST /balls`, `GET /balls`, `GET /balls/{ball_id}`, `PUT /balls/{ball_id}`, `DELETE /balls/{ball_id}` |
| Shared locations | `GET /locations`, `GET /locations/{item_id}` |
| Establishments | `POST /establishments`, `GET /establishments`, `GET /establishments/{item_id}`, `PUT /establishments/{item_id}`, `DELETE /establishments/{item_id}` |
| Events | `POST /events`, `GET /events`, `GET /events/{item_id}`, `PUT /events/{item_id}`, `DELETE /events/{item_id}` |
| Sessions | `POST /sessions`, `GET /sessions`, `GET /sessions/{item_id}`, `PUT /sessions/{item_id}`, `DELETE /sessions/{item_id}` |
| Games | `POST /games`, `GET /games`, `GET /games/{item_id}`, `PUT /games/{item_id}`, `DELETE /games/{item_id}` |
| Frames | `POST /frames`, `GET /frames`, `GET /frames/{item_id}`, `PUT /frames/{item_id}`, `DELETE /frames/{item_id}` |
| Shots | `POST /shots`, `GET /shots`, `GET /shots/{item_id}`, `PUT /shots/{item_id}`, `DELETE /shots/{item_id}` |

Use `/docs` for the exact request and response schemas.

List endpoints support:

```text
?limit=50&offset=0
```

The maximum page size is 100. Lists contain only accessible records,
except shared locations, which are readable by all authenticated users.

`PUT` replaces editable fields. Include optional values you want to retain;
omitted optional fields are reset to their defaults, usually `null`.

### Ownership and relationships

Create records in this order:

```text
Event → Session → Game → Frame → Shot
```

Establishments and balls can be created independently.

- Events, establishments, and balls belong directly to the authenticated user.
- Sessions created through the API require an owned event.
- An optional session establishment must belong to the same user.
- Games, frames, and shots inherit access through their parent records.
- A shot's optional ball must belong to the authenticated user.
- User IDs are assigned from authentication, not accepted from request bodies.
- Inaccessible item IDs and linked IDs return `404`.

Existing sessions without an event are not accessible through these routes.

Shared locations are read-only through the API. There are no general
user-management endpoints or endpoints exposing the legacy `clients`
table's stored tokens.

### Shot pin leaves

Send standing pins as a list:

```json
{
  "pin_leave": [7, 10]
}
```

Pin numbers must be unique integers from 1 through 10. An empty list means
no pins remain.

The API converts this list to the existing database bitmask and converts
it back when returning records.

### Session timestamps

Prefer ISO 8601 timestamps with a UTC offset:

```text
2026-10-15T18:00:00Z
```

The API converts timestamps to UTC and stores them without a timezone
offset because the database column uses `DATETIME2`. Timestamps supplied
without an offset are treated as UTC. Returned timestamps should also be
interpreted as UTC.

### Deletion behavior

Successful deletes return `204 No Content`.

The existing schema cascades deletion through:

```text
Session → Games → Frames → Shots
```

Deleting a game also deletes its frames and shots. Deleting a frame also
deletes its shots.

Other foreign-key relationships may prevent deletion. For example, a ball
referenced by a shot cannot be deleted until that reference is addressed.
These conflicts return `409`.

## Common response codes

| Code | Meaning |
| --- | --- |
| `200` | Read, login, or update succeeded |
| `201` | Record created |
| `204` | Record deleted; response has no body |
| `401` | Missing, invalid, or expired authentication |
| `404` | Record missing, inaccessible, or optional route disabled |
| `409` | Conflicting account details or linked database records |
| `422` | Invalid request data |
| `503` | Database operation or authentication configuration unavailable |

## Manual API checks

Use a development/test database because these operations create and
modify records.

For each protected resource:

1. Create a record as account A and verify `201`.
2. List and retrieve it as account A and verify `200`.
3. Update it and retrieve it again to confirm the saved changes.
4. Authorize as account B and verify account A's record is inaccessible.
5. Verify account B cannot create children under account A's parent records.
6. Delete a disposable record as its owner and verify `204`, then `404`.
7. Clear authorization and verify protected requests return `401`.

For shared locations, verify authenticated reads succeed and unauthenticated
requests are rejected.

## Existing repository tests

These tests require database credentials, the ODBC driver, and a working
database connection. They create, update, and delete temporary records.

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

These repository tests do not replace API authentication and ownership
checks.

## Troubleshooting

### `/health/db` returns 404

Confirm `API_ENABLE_DB_HEALTH=true` is in the root `.env` and restart
the API.

### Database endpoints return 503

Confirm:

- `.env` is at the project root.
- All `DB_*` values are configured correctly.
- ODBC Driver 18 is installed.
- The SSH tunnel is still running.
- `DB_SERVER` matches the local tunnel address and port.

Check whether the local tunnel is listening:

```powershell
Test-NetConnection 127.0.0.1 -Port 14330
```

A successful local port check does not prove the remote database is reachable.

### Protected endpoints return 401

Log in again and replace the saved token in **Authorize**. Paste the token
without quotes or a `Bearer` prefix in the Swagger authorization dialog.

### Personal tunnel script is missing

Use the direct SSH command or create your personal script. A missing script
does not prevent the API itself from starting.

### Browser requests `/favicon.ico` and receives 404

This is harmless. The API does not provide a browser tab icon.

## Current limitations

This is a local development backend. Before public deployment, add HTTPS,
authentication rate limiting, password recovery, and an appropriate token
revocation strategy.

Account recovery, admin management of shared locations, and automatic
bowling score calculation are not implemented.