# RevMetrix

RevMetrix is a York College of Pennsylvania CS400 capstone project for recording
bowling games and tracking performance. The frontend uses HTML, CSS, JavaScript,
Vite, and Capacitor. FastAPI connects to SQL Server for shared use or SQLite for
local development and integration tests.

## Start the frontend with the shared backend

Install Node.js with npm (development currently uses Node.js 24), then run from
the repository root in Windows PowerShell:

```powershell
cd C:\SCHOOL\capstone\RevCapstoneFa26
npm.cmd install
npm.cmd run dev
```

Use your own checkout path. Open [http://localhost:5173](http://localhost:5173).
Normal frontend startup calls **https://api.revmetrix.io** and needs no Python,
database credentials, ODBC driver, or personal SSH tunnel.

The hosted API accepts localhost and private IPv4 frontend origins on port 5173.
Preview servers on other ports and other public origins need CORS configuration.
If npm is not recognized, install Node.js and fully reopen VS Code.

## Run everything locally with SQLite

Install Python 3.10 or newer as well as Node.js. From the repository root:

```powershell
npm.cmd run setup
npm.cmd run db:test:init
npm.cmd run dev:full:test
```

Setup installs JavaScript dependencies and creates/reuses root `.venv` with
backend and test dependencies. It does not reset a database. Initialization
creates or upgrades `test_database/revmetrix_test.db` using the SQLite schema
and starter locations. It does not create a starter login; register your own
test account in the UI. SQLite accounts and data are separate from SQL Server.

The combined launcher sets `VITE_API_BASE_URL=/api`. Vite forwards `/api/*` to
the local FastAPI service on port 8000, so the website uses the local database
without editing source files. SQLite mode binds to loopback by default.
Stop both processes with Ctrl+C in the launcher terminal.

The checked-in `.env.test` contains **local-only test settings**, including a
public development signing key. Never use those settings on a public deployment.
No SQL credentials, SQL Server, system ODBC driver, or SSH tunnel is needed for
SQLite mode.

```powershell
npm.cmd run db:test:status
```

To erase local test records and recreate the test database, stop the app first:

```powershell
npm.cmd run db:test:reset
```

Reset deletes data only at the dedicated local SQLite path. The manager refuses
other configured paths. `db:test:init` preserves existing records; it applies
missing establishment columns without deleting the database.

## Current workflows

- Register, log in, log out, and update the display name.
- Record a guest game locally, including strike, spare, gutter, and foul shortcuts.
- Use **Next Shot** to confirm shots in browser session storage.
- Use **Start saved game** to create a database game, or **Save shot** to create
  it and upload all confirmed shots. Authentication is required for database writes.
- Reload the saved game URL to retrieve database progress. Cached unuploaded shots
  remain available in the same browser session. Ambiguous saves block blind retries
  until progress is reconciled; an uncertain initial game creation may need manual
  inspection before retrying.
- Display cumulative scores, including tenth-frame bonus shots, in the scorecard.
- On Finish, guests can log in/sign up to preserve progress or discard the local
  game. Signed-in users must upload confirmed shots before finishing.
- Add and edit owned establishments, including nickname, type, phone, home-house,
  enabled status, lane count, and address.

Browser caching is **sessionStorage**, not an offline synchronization service.
Closing the browser session can lose unuploaded progress. Foul markers are retained
locally; the database currently records their zero credited pinfall without a
separate foul flag. Do not assume unuploaded shots are in SQL Server or SQLite.

Saved game URLs look like `http://localhost:5173/game.html?game_id=6`. Use an ID
owned by your application account and bookmark it while saved-game browsing is
unfinished. Application credentials are distinct from database credentials.

The sidebar also contains Ball Arsenal, Events, Sessions, Stats, Ciclops, Smart
Dot, and Smart Watch destinations. Several are navigation placeholders, not
complete interfaces. Their presence does not imply the corresponding UI or device
integration is implemented. Stats calculations exist in the API; the Stats page
does not yet display them.

## Architecture and API selection

```text
Normal startup:
Browser → local Vite frontend → HTTPS api.revmetrix.io
                                    ↓
                           Nginx Proxy Manager
                                    ↓
                              FastAPI container
                                    ↓
                         SQL Server over private Docker network

Combined local startup:
Browser → Vite /api proxy → local FastAPI → SQLite or SQL Server
```

`frontend/js/api_client.js` defaults to `https://api.revmetrix.io` and supports a
non-secret `VITE_API_BASE_URL` override. The combined launcher selects `/api` for
local development automatically. `npm.cmd run dev` alone always uses the hosted
default unless you explicitly provide an override. Vite environment values are
included in client code: never put database credentials or JWT signing secrets in
`VITE_*` values. Restart Vite after changing an override.

Existing entities/repositories remain in `Database/`. The current API also uses
parameterized SQL directly, with separate SQL Server and SQLite syntax where needed.
Ownership is validated through event → session → game → frame → shot. Shared
locations are authenticated read-only reference data. Other users' records return
404; linked-record conflicts return 409. Deletes can cascade to descendants.

## API documentation and statistics

- Hosted docs: https://api.revmetrix.io/docs
- Local docs: http://127.0.0.1:8000/docs when running a local API
- Health: `/health`; optional database check: `/health/db`

Registration hashes passwords using Argon2. Passwords must have 8–128 characters.
Login returns a JWT access token with a 30-minute expiry. Protected calls use
`Authorization: Bearer TOKEN`. In Swagger Authorize, paste the token without quotes
or the word Bearer. Log in again when changing backends; their signing keys/accounts
may differ. Browser logout clears local authorization but does not revoke issued tokens.

| Routes | Purpose |
| --- | --- |
| `POST /auth/register`, `POST /auth/login` | Application accounts and access tokens |
| `GET /auth/me`, `PUT /auth/me/display-name` | Authenticated profile |
| `/balls` | Owned bowling-ball CRUD |
| `/locations` | Authenticated reads of shared locations |
| `/establishments`, `/events` | Owned establishment/event CRUD |
| `/sessions`, `/games`, `/frames`, `/shots` | Owned bowling hierarchy CRUD |
| `GET /statistics` | Completed-game count, average, high score, and recent games |

Resource lists accept `limit`/`offset` with maximum page size 100. PUT replaces
editable fields. Statistics accept `recent_limit` from 1 to 100, default 10; it
limits only the recent list, not all-time totals. Scores are calculated from
recorded remaining pins, not editable score fields. Incomplete games are excluded;
invalid games are excluded and counted by `invalid_games`. Empty average/highest
are null, while completed zero games count normally. Recent games use session date
descending, then game ID; undated games are last. See [statistics notes](Statistics/README.md).

`/health` requires no database connection. `/health/db` runs SELECT 1 only if enabled
with `API_ENABLE_DB_HEALTH=true` at startup. A generic 503 means connectivity is
unavailable; 404 means the optional route is disabled. No raw database errors or
credentials are returned.

## Test and build

After setup, run **all frontend, backend, statistics, and SQLite integration tests**:

```powershell
npm.cmd run test
```

The runner executes both suites once, streams console messages, shows Python
warning details, and exits unsuccessfully if either suite fails. It still runs
the backend tests after frontend failures. Warnings alone do not fail the command.

```powershell
npm.cmd run test:frontend
npm.cmd run test:backend
npm.cmd run test:watch
npm.cmd run build
```

`test:js`/`test:python` are aliases for individual suites; `test:all` runs both.
No running server, SSH tunnel, credentials, or initialized persistent test database
is needed for tests. Backend unit tests block real pyodbc connections. SQLite
integration tests create temporary databases and exercise actual registration,
CRUD, scoring, account isolation, and deletion cascades. SQL Server syntax,
production constraints, and concurrency still require dedicated SQL Server
integration verification. Tests do not write to the hosted database.

For manual dependency setup:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Reuse `.venv` if it exists. The development requirements include pyodbc for SQL
Server mock tests; SQLite runtime itself does not import pyodbc.
Build type-checks source and emits all 12 HTML pages to root `dist/`, also used
by Capacitor. Backend test instructions are in [Database/tests/README.md](Database/tests/README.md).

## Optional local SQL Server development

Install [Microsoft ODBC Driver 18](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
as a system dependency. Installing pyodbc with pip does not install this driver.
Use authorized development credentials in an ignored root `.env`:

```dotenv
DB_TYPE=sqlserver
DB_SERVER=127.0.0.1,14330
DB_NAME=replace_with_database_name
DB_USER=replace_with_database_user
DB_PASSWORD="replace_with_database_password"
JWT_SECRET=replace_with_generated_local_secret
API_ENABLE_DB_HEALTH=true
```

Generate a local signing secret (at least 64 characters) and keep it stable:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

For access to the remote private database, keep an authorized tunnel running:

```powershell
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:14330:DB_HOST:DB_PORT SSH_USER@SSH_HOST
```

Replace placeholders with administrator-provided values. The SQL destination is
reached from the SSH server. Leave the tunnel running and do not expose port 14330.

```powershell
npm.cmd run dev:full:real
```

This starts both local processes and points the frontend at the local SQL-backed API.
`npm.cmd run dev:full` defaults to the same mode. `dev:api`/`dev:python` start only
the local SQL-backed API; `dev:frontend` starts only Vite. Combined real mode allows
LAN access unless `-- --local` is supplied. Use `ipconfig`/Vite's Wi-Fi URL to share
port 5173; campus Wi-Fi/firewalls may block peer devices. The local proxy forwards
API calls, so participants need not connect directly to port 8000.

## Important SQL Server migration before deploying this merge

The establishment form now uses five additional columns: `nickname`, `type`,
`phone`, `home_house`, and `enabled`. Fresh schemas include these fields; an
existing SQL Server database needs the additive migration before the merged API
is deployed. Back up the intended database and confirm the configured target first.

```powershell
.\.venv\Scripts\python.exe -m Database.scripts.migrate_establishments
.\.venv\Scripts\python.exe -m Database.scripts.migrate_establishments --apply
```

The first command only describes the plan. `--apply` adds missing columns in a
transaction, preserves records, and can be repeated. It requires ALTER permission.
No schema modification occurs automatically at API startup. SQLite initialization
handles the equivalent migration with `npm.cmd run db:test:init`.

**Merging/pushing main does not update the running DigitalOcean container or
apply its database migration.** Until deployment, hosted behavior remains at the
previous release; new establishment fields will not save through the old API.

## Server deployment

The server checkout is `/opt/revmetrix/RevCapstoneFa26`. Its Dockerfile and Compose
files currently live on the server rather than in a fresh clone. Nginx Proxy
Manager forwards HTTPS `api.revmetrix.io` to `revmetrix-fastapi:8000`; SQL Server
is on a private Docker network. The API host port remains loopback-only.

An authorized administrator must back up/migrate SQL Server as described above,
update the server checkout to **main**, and build the image. Using the current
server's older Docker/Compose installation:

```bash
git fetch origin main
git switch main
git pull --ff-only origin main
DOCKER_API_VERSION=1.43 docker build -f Dockerfile.api -t revmetrix-fastapi:dev .
```

Run the migration using the intended server database credentials, with a login
authorized for schema changes. Never copy local tunnel settings into the server
configuration. Only after migration and a successful image build, recreate the API:

```bash
DOCKER_API_VERSION=1.43 docker-compose -p revmetrix-fastapi -f docker-compose.fastapi.yml up -d --no-deps --force-recreate api
```

The Dockerfile must install `requirements-sqlserver.txt` and copy `Database/` and
`Statistics/`. Compose references a prebuilt image, so `docker-compose build` skips
it. Keep environment files out of the image. Verify health, authenticated saves,
establishments, and statistics after updating. The older .NET API container remains
available, but the public API hostname forwards to FastAPI.

## Repository layout

```text
frontend/                 HTML pages, CSS, public assets, JavaScript and JS tests
Database/api/             FastAPI routes and validation
Database/database/        Connections, SQL Server/SQLite schemas, SQLite seed data
Database/entities/        Domain data classes
Database/repositories/    Existing SQL Server repositories
Database/scripts/         Explicit schema and database lifecycle utilities
Database/tests/           Unit, schema, scoring, and isolated SQLite API tests
Statistics/               Pure scoring/statistics calculations
scripts/commands/         Development, test, build, and diagnostic launchers
test_database/            Generated local SQLite data, ignored by Git
legacy/                   Earlier API/SQLite starter and superseded game scripts
android/, ios/            Capacitor platform projects
dist/                     Generated frontend build, ignored by Git
```

Generated Gradle caches and build reports are ignored. Historical duplicate game
scripts are archived under `legacy/frontend-game/`; active game persistence lives
in `frontend/js/game_persistence.js`. The old `npm run cap` command was removed in
favor of the direct package scripts above. Root `.env`, `.venv`, and `node_modules`
stay local. Never commit real credentials, tokens, private keys, or database files.

## Remaining work and troubleshooting

Remaining work includes frontend statistics integration, saved-game browsing,
remote SQL Server integration tests, durable foul flags, video analysis/mobile
validation, rate limiting, password recovery, and token revocation. Imported
Ciclopes notes/platform scaffolding do not mean end-to-end inference works.

| Problem | Check |
| --- | --- |
| npm is not recognized | Install Node.js and reopen VS Code. |
| API test dependencies missing | Run setup or install requirements-dev.txt in root .venv. |
| Test database missing | Run db:test:init before starting dev:full:test. |
| Changes seem saved to the wrong database | Check the launcher mode; normal dev uses hosted API, dev:full:test uses local SQLite. |
| Establishments return 422 or 503 on hosted API | Deploy the merged backend and apply the SQL Server migration first. |
| Protected calls return 401 | Log in again with that backend's application account. |
| CORS failure | Use port 5173 and an allowed origin; configure others explicitly. |
| Uncertain shot save | Reload/reconcile before resubmitting; do not blindly duplicate writes. |
| Empty statistics | Only complete legal games count; Stats UI is still a placeholder. |
| jsdom navigation messages in tests | The simulated browser does not navigate; inspect the test results separately. |
