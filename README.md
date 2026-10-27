# RevCapstoneFa26 — RevMetrix

RevMetrix is a York College of Pennsylvania Computer Science Capstone project
for recording bowling games and tracking bowling activity. The application
uses an HTML/CSS/JavaScript frontend, a FastAPI backend, and SQL Server.
Capacitor projects are included for future Android and iOS integration.

## Current working demo

- Register an application account and log in with a username and password.
- Update a display name and retrieve it after logging out and back in.
- Start a saved practice game, creating its event, session, and game records.
- Select knocked-down pins and save each shot to SQL Server.
- Continue through frames, including tenth-frame bonus shots.
- Refresh a game page to reload its saved frames and shots.
- Restrict protected API records to their owning account.

The scorecard displays shot results, including strike and spare symbols.
Automatic bowling score totals are **not implemented**. Friends, performance
dashboards, video analysis, and additional profile controls remain planned
or incomplete. Guest UI access does not authorize database writes.

## Architecture

```text
Browser: http://localhost:5173
  HTML/CSS/JavaScript served by Vite
                 |
                 | HTTP requests with JWT bearer tokens
                 v
FastAPI: http://127.0.0.1:8000
  Database/api/main.py
                 |
                 | pyodbc + Microsoft ODBC Driver 18
                 v
Local SSH tunnel: 127.0.0.1:14330
                 |
                 v
Remote SQL Server
```

The browser calls the API; it never connects directly to SQL Server. Existing
entities and repositories are retained under `Database/`; the current API
also executes parameterized SQL directly.

## Repository layout

```text
RevCapstoneFa26/
├── frontend/
│   ├── index.html
│   ├── game.html
│   ├── account_settings.html
│   ├── schedule_event.html
│   ├── js/                  # UI modules and API client
│   │   └── test/            # Frontend tests
│   ├── css/
│   └── public/              # Images and other static assets
├── Database/
│   ├── api/                 # Integrated JWT-protected FastAPI backend
│   ├── database/            # SQL Server connection and schema
│   ├── entities/
│   ├── repositories/
│   └── scripts/             # Database helper scripts
├── legacy/
│   ├── api/                 # Earlier API implementation
│   ├── test_database/       # Earlier SQLite prototype and local data
│   └── frontend-starter/    # Unused Vite starter source
├── scripts/                 # Setup, launch, build, and diagnostic commands
├── Statistics/
├── android/
├── ios/
├── .env                     # Local configuration; ignored by Git
├── .venv/                   # Local Python environment; ignored by Git
├── package.json
├── requirements.txt
├── requirements-sqlserver.txt
├── vite.config.js
├── capacitor.config.ts
└── dist/                    # Generated build output; ignored by Git
```

Run all commands below from the **repository root**, not from `frontend/`
or `Database/`. Keep `.env`, `.venv`, and `node_modules` at the root.

## First-time Windows setup

### Prerequisites

- Node.js 24 LTS, including npm.
- Python 3.10 or newer.
- Microsoft ODBC Driver 18 for SQL Server.
- Windows OpenSSH Client and authorized SSH/database access.

[Download Microsoft ODBC Driver 18](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server).
Installing `pyodbc` with pip does not install this system driver.

In a local PowerShell terminal:

```powershell
cd C:\SCHOOL\capstone\RevCapstoneFa26
npm.cmd run setup
```

Replace the checkout path if yours differs. Setup installs JavaScript
dependencies, creates or reuses the root `.venv`, and installs the integrated
backend's Python dependencies. It does not create SQL Server tables or reset
SQLite by default.

If npm is not recognized after installing Node.js, fully close and reopen
VS Code. Verify installation with:

```powershell
node --version
npm.cmd --version
```

### Root environment file

Create a local `.env` alongside `package.json`:

```dotenv
API_ENABLE_DB_HEALTH=true
DB_SERVER=127.0.0.1,14330
DB_NAME=replace_with_database_name
DB_USER=replace_with_database_user
DB_PASSWORD="replace_with_database_password"
JWT_SECRET=replace_with_generated_secret
```

Generate the signing secret locally:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Copy the generated value into `JWT_SECRET`. Keep the same secret between
restarts; changing it invalidates existing access tokens. The backend requires
a value at least 64 characters long.

Obtain database and SSH connection details from an authorized project
administrator. Never commit `.env`, real passwords, private keys, or access
tokens. Never put database credentials or `JWT_SECRET` in frontend JavaScript
or a `VITE_*` environment variable.

## Everyday startup: two terminals

### Terminal 1 — open the database tunnel

In a **local PowerShell terminal**, run the approved SSH command:

```powershell
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:14330:DB_HOST:DB_PORT SSH_USER@SSH_HOST
```

Replace the uppercase placeholders with your authorized connection details.
`DB_HOST` and `DB_PORT` identify the SQL Server destination as reached from
the SSH server. Use the same destination as your working database tunnel.

Leave this terminal running. A connected tunnel may produce no output.
If your tunnel is already open, do not start another on port 14330.

An existing personal tunnel script may be used instead. Personal scripts
are optional and should not contain passwords or private-key contents.

### Terminal 2 — start the website and API together

In another **local PowerShell terminal**, from the project root:

```powershell
npm.cmd run dev:full
```

This starts the integrated SQL Server API and Vite frontend on all IPv4
interfaces for local-network testing. Leave the terminal running and open:

- [Website](http://localhost:5173/)
- [Interactive API documentation](http://127.0.0.1:8000/docs)
- [API health](http://127.0.0.1:8000/health)
- [Optional database health](http://127.0.0.1:8000/health/db)

You need only `dev:full` when the tunnel is already running. Do not also
start another API on port 8000 or another frontend on port 5173.

Press **Ctrl+C** in the app terminal to stop the website and API. Close the
tunnel with **Ctrl+C** in its terminal when finished. Restart the app after
editing `.env`; environment-file changes may not trigger an automatic reload.

### Start components separately

For troubleshooting, these can run in separate terminals instead of `dev:full`:

```powershell
npm.cmd run dev
```

```powershell
npm.cmd run dev:python
```

The backend can also be started directly:

```powershell
.\.venv\Scripts\python.exe -m uvicorn Database.api.main:app --reload --host 0.0.0.0 --port 8000
```

## Testing from another device on the same network

`npm.cmd run dev:full` now listens on `0.0.0.0` for both Vite (5173) and
the API (8000). Share Vite's Wi-Fi **Network** URL, for example
`http://192.168.1.20:5173`, rather than localhost or a virtual-adapter address.
The frontend automatically sends API requests to that same computer on port 8000.
Only the host computer needs the SSH database tunnel and database credentials.
Teammates open the host computer's website address and use their own application
accounts; they do not run their own frontend, backend, or SSH tunnel for this demo.

The host Wi-Fi address observed during setup was `10.127.37.132`, giving:

- Website: http://10.127.37.132:5173/
- API health: http://10.127.37.132:8000/health

This address can change when reconnecting or changing networks. Run `ipconfig`
on the host and use the IPv4 address under **Wireless LAN adapter Wi-Fi**, or
use Vite's matching Network URL. Avoid the virtual adapter address
`192.168.56.1` for Wi-Fi teammates.

Before the presentation, open the website from a second device, log in with
a demo account, and confirm a saved shot can be retrieved after refreshing.
If the website opens but API requests fail, check port 8000 as well as 5173.
CORS permits localhost and private IPv4 origins on port 5173, not arbitrary
public origins or other ports.

Allow the two ports through Windows Firewall for the trusted demo network if
needed. Campus Wi-Fi can block communication between devices even when both
are connected; check this if the host works but another device cannot connect.
The database tunnel remains bound to `127.0.0.1`; do not expose port 14330.

This is HTTP development access: use demo accounts on a trusted network, not
real personal passwords. Public internet access still needs HTTPS and the
deployment work described below. `0.0.0.0` is a listening address, not a browser URL.

To keep the combined app restricted to this computer instead:

```powershell
npm.cmd run dev:full -- --local
```

## Demo walkthrough

1. Open the website and register a unique username and email.
2. Choose an application password of 8–128 characters.
3. Verify login, update the display name, and log out and back in.
4. Select **Start Game**, then **Start saved game** on the game screen.
5. Confirm the page identifies its saved game number.
6. Tap the pins knocked down and select **Save shot**.
7. Record the next shot when applicable, then select **Next frame**.
8. Refresh the page and verify recorded shots remain.

Game pages retain their database ID in the address, for example:

```text
http://localhost:5173/game.html?game_id=6
```

Use an ID created by your account. Bookmark that address to reopen the game;
a saved-games browser is not implemented yet. Records persist in SQL Server,
not just browser storage. The browser stores the access token and some profile
preferences in session storage.

The app login uses your **registered username and password**, not `DB_USER`
and `DB_PASSWORD`. SQLite prototype accounts are separate from SQL Server
accounts. Guest mode cannot save games through protected endpoints.

## Authentication and API

Registration hashes passwords with Argon2. Login returns a JWT access token
that expires after 30 minutes. Protected calls send:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

When testing through `/docs`, paste only the token into **Authorize**, without
quotes or the word `Bearer`. Clearing authorization removes the browser's
saved token; it does not revoke issued tokens on the server.

| Resource | Operations |
| --- | --- |
| `/auth/register` | POST: create an application account |
| `/auth/login` | POST: obtain an access token |
| `/auth/me` | GET: read the authenticated profile |
| `/auth/me/display-name` | PUT: update the authenticated display name |
| `/balls` | Create, list, get, replace, and delete owned balls |
| `/locations` | Authenticated read-only access to shared locations |
| `/establishments` | CRUD for owned establishments |
| `/events` | CRUD for owned events |
| `/sessions` | CRUD for sessions under owned events |
| `/games` | CRUD for games under owned sessions |
| `/frames` | CRUD for frames under owned games |
| `/shots` | CRUD for shots under owned frames |

See `/docs` for exact request schemas and item routes. Lists use `limit` and
`offset`, with a maximum page size of 100. `PUT` replaces editable fields;
include optional values you want to retain.

Ownership follows `event → session → game → frame → shot`. Linked balls and
establishments must also belong to the requesting account. Inaccessible
records return 404. Shared locations are readable by all authenticated users.

Deleting sessions, games, or frames can cascade to their descendants under
the existing schema. Other linked records can prevent deletion and return 409.

### Health checks

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

```json
{"status":"ok"}
```

This verifies API availability without a database connection or credentials.
The optional database route requires `API_ENABLE_DB_HEALTH=true` at startup:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health/db
```

```json
{"status":"ok","database":"reachable"}
```

It runs `SELECT 1`. A generic 503 indicates a database/configuration problem;
404 means the optional route is not registered. Driver error details and
credentials are not returned in the response.

## Build and tests

From the project root:

```powershell
npm.cmd run build
npm.cmd run test -- --run
```

The build includes all four HTML pages and writes generated files to root
`dist/`. Capacitor's `webDir` still points there. The current frontend test
suite checks authentication storage/logout, profile-picture hue behavior,
and API address selection for localhost and LAN hosts;
it does not replace the manual database workflow checks.

Preview the production build with:

```powershell
npm.cmd run preview
```

Preview uses a different origin from port 5173. To call the API from preview,
add that exact origin to the backend's CORS allowlist. Use `dev:full` for the
normal integrated demo.

## Legacy SQLite prototype

The earlier API and SQLite files are preserved under `legacy/`. Their login
contract differs from the current JWT frontend, so they are not the backend
for the integrated demo.

See [legacy/README.md](legacy/README.md) for isolated legacy commands.
Do not use `dev:full -- --test` for the integrated application. Legacy database
reset commands delete local SQLite data; they are not needed for normal startup.

## Troubleshooting

| Problem | Check |
| --- | --- |
| `npm` not recognized | Install Node.js, restart VS Code, and use `npm.cmd`. |
| Port 5173 or 8000 already in use | Stop the earlier app process before restarting. |
| Database check returns 503 | Check SSH, root `.env`, credentials, and ODBC Driver 18. |
| Database check returns 404 | Enable `API_ENABLE_DB_HEALTH=true` and restart the API. |
| Login returns 401 | Use the application username/password; SQLite accounts are separate. |
| A protected request returns 401 | Log in again; the access token may have expired. |
| Browser reports a CORS error | Use localhost, 127.0.0.1, or a private LAN IPv4 address on port 5173; other origins need explicit configuration. |
| Shot saving cannot be confirmed | Refresh to reload database progress before submitting again. |
| `/favicon.ico` returns 404 | Harmless browser icon request. |

To check whether the local SSH tunnel is listening:

```powershell
Test-NetConnection 127.0.0.1 -Port 14330
```

`TcpTestSucceeded: True` confirms the local port is reachable, not that SQL
Server authentication succeeds.

## Deployment and planned work

The current integrated demo is hosted on a developer computer for local-network
access and reaches SQL Server through that computer's SSH tunnel.
A separately deployed backend container has also passed its health checks;
shared public HTTPS access is not configured yet. Teammates running their own
local backend need their own authorized database access. Once a shared backend
is securely available, frontend users will need only its API address and their
application accounts.

Planned work includes saved-game navigation, score totals, further frontend
integration, statistics, and video analysis. The intended video pipeline uses
Pose3D/ONNX, but on-device runtime integration is not implemented. Mobile
packaging needs additional work, including configuring the API address for
native mobile builds.

Before public deployment, configure HTTPS, authentication rate limiting,
password recovery, and an appropriate token-revocation strategy. Never expose
database credentials to the frontend or commit local environment files.
