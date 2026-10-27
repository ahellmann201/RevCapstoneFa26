# RevCapstoneFa26 — RevMetrix

RevMetrix is a York College of Pennsylvania Computer Science Capstone project
for recording bowling games and tracking bowling activity. It uses an
HTML/CSS/JavaScript frontend, FastAPI, and SQL Server. Capacitor projects are
included for Android and iOS development.

## Quick start for frontend developers

The shared backend is available at **https://api.revmetrix.io**. Teammates do
not need a local Python server, SSH tunnel, ODBC driver, database credentials,
or JWT signing secret to use it.

Install Node.js with npm (the project has been developed with Node.js 24).
Open PowerShell at your checkout root:

```powershell
cd C:\SCHOOL\capstone\RevCapstoneFa26
npm.cmd install
npm.cmd run dev
```

Replace the checkout path if yours differs. Open
[http://localhost:5173](http://localhost:5173), register an application account,
and log in. Leave Vite running while using the website.

The API address in `frontend/js/api_client.js` is:

```javascript
const API_BASE_URL = "https://api.revmetrix.io";
```

Requests from localhost and private IPv4 frontend addresses on port **5173**
are allowed by the backend's current CORS configuration. Other origins,
including preview servers on different ports, need explicit backend configuration.

If npm is not recognized after installing Node.js, fully close and reopen VS Code:

```powershell
node --version
npm.cmd --version
```

## Architecture

```text
Browser → Vite frontend on localhost or LAN, port 5173
   |
   | HTTPS / JSON, JWT bearer token for protected requests
   v
https://api.revmetrix.io
   |
   v
Nginx Proxy Manager → FastAPI container on DigitalOcean
                            |
                            | Private Docker network, pyodbc + ODBC Driver 18
                            v
                        SQL Server
```

The browser calls the API and never connects directly to SQL Server. The
DigitalOcean backend uses its server-side database configuration; teammates
do not depend on a developer computer or personal SSH tunnel being online.
Existing entities and repositories remain under `Database/`; current API
routes also execute parameterized SQL directly.

## Current functionality

- Register and log in using an application username and password.
- Update the authenticated profile's display name.
- Create saved practice games and record their frames and shots.
- Reload a game URL to retrieve saved progress.
- Restrict protected records to their owning account.
- Manage bowling equipment and other bowling resources through the API.
- Retrieve completed-game count, average score, highest score, and recent
  completed games through the authenticated `/statistics` endpoint.

Statistics calculate ten-pin scores from recorded shots, including strike,
spare, and tenth-frame bonuses. Incomplete games are excluded. Invalid saved
sequences are excluded and reported by `invalid_games`. An empty average or
highest score is `null`; a completed zero-score game still counts.

The game scorecard displays shot marks. The statistics calculations do not
write totals back into `game_score`, and frontend statistics display remains
separate work. Saved-game browsing, friends, additional profile controls,
and complete video-analysis/mobile integration remain incomplete.

## Repository layout

```text
RevCapstoneFa26/
├── frontend/                # HTML pages, JavaScript, CSS, public assets
│   └── js/test/             # Frontend tests
├── Database/
│   ├── api/                 # JWT-protected FastAPI routes
│   ├── database/            # SQL Server connection and schema
│   ├── entities/
│   ├── repositories/
│   ├── Queries/
│   ├── scripts/
│   └── tests/               # Offline backend tests
├── Statistics/              # Pure scoring/statistics calculations and notes
├── scripts/                 # Setup, launch, build, diagnostic commands
├── legacy/                  # Earlier API and SQLite prototype
├── android/
├── ios/
├── requirements.txt
├── requirements-sqlserver.txt
├── requirements-dev.txt
├── package.json
├── vite.config.js
└── dist/                    # Generated frontend build output
```

Run commands from the project root. Local `.env`, `.venv`, and `node_modules`
belong at the root and must not be committed.

## Demo workflow

1. Run `npm.cmd run dev` and open the website.
2. Register a unique username and email with an 8–128-character password.
3. Log in, change the display name, and confirm it persists after logging in again.
4. Start a saved game and confirm its saved game ID appears.
5. Select knocked-down pins and save a shot.
6. Continue through the shots and frames, then refresh to check persistence.

Game URLs retain the database ID, for example:

```text
http://localhost:5173/game.html?game_id=6
```

Use your own account's game ID. Bookmark the URL to reopen it while a saved-games
browser is unfinished. Application logins are not SQL Server accounts. Access
tokens are stored in browser session storage; saved game data lives in SQL Server.
The legacy SQLite accounts and database are separate from this hosted system.

## API documentation and authentication

- [Interactive API documentation](https://api.revmetrix.io/docs)
- [API health](https://api.revmetrix.io/health)
- [Optional database health](https://api.revmetrix.io/health/db)

Registration hashes passwords with Argon2. Login returns a JWT access token
that expires after 30 minutes. Protected requests include:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

In Swagger's **Authorize** dialog, paste only the token, without quotes or
the word `Bearer`. Do not share tokens. Clearing browser authorization does
not revoke an already issued token on the server.

| Resource | Operations |
| --- | --- |
| `/health` | GET: API availability without connecting to the database |
| `/health/db` | GET: optional SQL connectivity check |
| `/auth/register` | POST: create an application account |
| `/auth/login` | POST: obtain an access token |
| `/auth/me` | GET: authenticated profile |
| `/auth/me/display-name` | PUT: update the authenticated display name |
| `/balls` | Create, list, get, replace, and delete owned balls |
| `/locations` | Authenticated read-only access to shared locations |
| `/establishments` | CRUD for owned establishments |
| `/events` | CRUD for owned events |
| `/sessions` | CRUD under owned events |
| `/games` | CRUD under owned sessions |
| `/frames` | CRUD under owned games |
| `/shots` | CRUD under owned frames |
| `/statistics` | GET: owned completed-game statistics; `recent_limit` defaults to 10, maximum 100 |

See Swagger for exact request schemas and item routes. Resource lists use
`limit` and `offset`, with a maximum page size of 100. `PUT` replaces editable
fields, so include optional values you want to retain. The statistics recent
limit affects only the recent list, not all-time totals. Recent games are
ordered by session date, then game ID; undated games appear last.

Ownership follows event → session → game → frame → shot. Linked balls and
establishments must also belong to the requesting account. Inaccessible
records return 404. Deletes may cascade to child records or return 409 when
other linked records prevent deletion.

Check the hosted service from PowerShell:

```powershell
Invoke-RestMethod https://api.revmetrix.io/health
Invoke-RestMethod https://api.revmetrix.io/health/db
```

Expected responses are `{"status":"ok"}` and
`{"status":"ok","database":"reachable"}`. Database health is registered
only when `API_ENABLE_DB_HEALTH=true` at API startup; 404 means it is disabled.
A generic 503 means the database check is unavailable. Raw driver errors and
credentials are not returned.

## Optional local backend development on Windows

Use this when changing or debugging Python backend code. It is not required
for normal frontend development against the hosted API.

Install Python 3.10 or newer and Microsoft ODBC Driver 18 for SQL Server.
The ODBC driver is a system dependency; installing `pyodbc` does not install it.
[Download ODBC Driver 18](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server).

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-sqlserver.txt
```

Reuse the root `.venv` if it already exists. Alternatively, `npm.cmd run setup`
installs both JavaScript and backend Python dependencies; it does not configure
database access or create SQL Server tables.

Create an ignored root `.env` using authorized development database details:

```dotenv
API_ENABLE_DB_HEALTH=true
DB_SERVER=127.0.0.1,14330
DB_NAME=replace_with_database_name
DB_USER=replace_with_database_user
DB_PASSWORD="replace_with_database_password"
JWT_SECRET=replace_with_generated_secret
```

Generate your own local signing secret:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Keep it at least 64 characters long and stable between restarts. Local and
hosted signing secrets can differ: log in again when switching backends.
Never put credentials, private keys, tokens, or `JWT_SECRET` in frontend code
or `VITE_*` variables.

For local access to the private remote SQL Server, keep an authorized SSH
tunnel running in a separate PowerShell terminal:

```powershell
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:14330:DB_HOST:DB_PORT SSH_USER@SSH_HOST
```

Replace the uppercase placeholders. The database destination is reached from
the SSH server; obtain current details from the project administrator. A
working tunnel can be silent. Do not expose local port 14330 to the network.

Start the local backend:

```powershell
npm.cmd run dev:python
```

Or bind directly to this computer only:

```powershell
.\.venv\Scripts\python.exe -m uvicorn Database.api.main:app --reload --host 127.0.0.1 --port 8000
```

Local docs are at http://127.0.0.1:8000/docs. The frontend still targets the
hosted API unless you temporarily change `API_BASE_URL` to
`"http://127.0.0.1:8000"` for same-computer testing. For LAN testing, use the
local backend computer's reachable IPv4 address instead. Restore the shared
HTTPS address before sharing the frontend change.

`npm.cmd run dev:full` starts both local processes but does not change that API
address. Use it only when intentionally testing a local backend. Restart the
backend after changing `.env`. The local `/health` endpoint needs no SQL
credentials, ODBC system driver, or SSH tunnel; database endpoints do.

## Sharing the frontend over the LAN

Vite listens on all IPv4 interfaces on port 5173. Share its Wi-Fi Network URL,
such as `http://192.168.1.20:5173`, with devices on the same trusted network.
Those browsers still call the shared HTTPS backend, not a local port 8000.
Only the Vite host needs to run the frontend; no participant needs an SQL tunnel.

If needed, allow Vite through Windows Firewall for the trusted network. Campus
Wi-Fi may block connections between devices. Avoid virtual-adapter addresses.
`0.0.0.0` is a listening address, not a browser URL.

## Build and tests

Frontend build and tests:

```powershell
npm.cmd run build
npm.cmd run test -- --run
```

The build writes to root `dist/`, which Capacitor also uses. Frontend tests
mock API requests. The existing API-address tests still expect the earlier
hostname-based local backend and need updating for the shared HTTPS address.
That mismatch is not a live connectivity test.

Backend tests, with no SSH tunnel or database credentials:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest Database/tests -q
```

Skip virtual-environment creation if it already exists. The initial suite
passed 126 tests covering authentication, CRUD behavior, validation, error
handling, cleanup, and scoring/statistics. Database connections are mocked
and real pyodbc connections are blocked. These tests still need the Python
dependencies, but do not need the system ODBC driver or a running SQL Server.
They do not prove SQL syntax, live account isolation, database constraints,
or concurrency; those need a dedicated SQL Server integration test database.

For statistics behavior and limitations, see [Statistics/README.md](Statistics/README.md).
Backend test instructions are in [Database/tests/README.md](Database/tests/README.md).

`npm.cmd run preview` uses a different frontend origin; configure CORS for it
before using it with the hosted API. Use Vite port 5173 for normal development.

## Hosted deployment

The API currently runs as a Docker container on DigitalOcean. Nginx Proxy
Manager forwards `api.revmetrix.io` over HTTPS to `revmetrix-fastapi:8000` on
their shared Docker network. SQL Server is reached through its private Docker
network. The host's API port 8000 remains bound to loopback.

The server checkout was updated from `integration-demo`. The deployment
Dockerfile installs `requirements-sqlserver.txt` and copies both `Database/`
and `Statistics/`. Server deployment files currently exist only on the server;
they are not supplied by a fresh repository clone.

The Compose service uses a prebuilt `revmetrix-fastapi:dev` image, so its
`docker-compose build` command skips the service. An authorized administrator
can rebuild and replace just the API from the server checkout:

```bash
git pull --ff-only origin integration-demo
DOCKER_API_VERSION=1.43 docker build -f Dockerfile.api -t revmetrix-fastapi:dev .
DOCKER_API_VERSION=1.43 docker-compose -p revmetrix-fastapi -f docker-compose.fastapi.yml up -d --no-deps --force-recreate api
```

Proceed to container recreation only if the build succeeds. These commands
reflect the current server's older Docker/Compose installation. Preserve its
ignored configuration and exclude environment files from the image. Verify
health and authenticated behavior after an update. The older API container
has been kept available for rollback; the domain now forwards to FastAPI.

## Legacy prototype and remaining work

The earlier API and SQLite data are retained under `legacy/`. They use a
different login contract and are not the backend for the current application.
See [legacy/README.md](legacy/README.md) for isolated legacy commands. Do not
use `dev:full -- --test` or legacy database reset commands for normal startup.

Remaining work includes statistics UI integration, saved-game browsing,
expanded SQL Server integration tests, video-analysis/mobile integration,
authentication rate limiting, password recovery, and token revocation.

## Troubleshooting

| Problem | Check |
| --- | --- |
| npm is not recognized | Install Node.js, reopen VS Code, and use `npm.cmd`. |
| Frontend still calls local port 8000 | Check `API_BASE_URL`, refresh, and restart Vite if needed. |
| Hosted `/health` fails | Check server/proxy availability and HTTPS; a personal SQL tunnel is not involved. |
| Hosted database health returns 503 | An administrator must check server-side SQL connectivity/configuration. |
| Local database health returns 503 | Check the local tunnel, root `.env`, credentials, and ODBC Driver 18. |
| Database health returns 404 | The optional route is disabled on that backend. |
| Login or protected calls return 401 | Use the application username/password and log in again; tokens expire. |
| Browser reports CORS failure | Use an allowed frontend origin on port 5173; other origins need configuration. |
| Shot save is uncertain | Reload saved progress before submitting the shot again. |
| Statistics are empty | Only complete, valid ten-frame games count; incomplete games are excluded. |
| API-address frontend tests fail | Their old local-URL expectations need updating for the hosted backend. |

Never commit real secrets or share proxy-administrator credentials with frontend
clients. Frontend users need only the public API address and application accounts.
