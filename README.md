# RevCapstoneFa26

## Overview

RevCapstoneFa26 is a mobile bowling application developed as a York College of Pennsylvania Computer Science Capstone project. The application allows users to record and track bowling games, manage bowling events and locations, view performance data, and connect with other bowlers.

The application supports casual score tracking and longer-term performance analysis. It also includes planned on-device video analysis using Pose3D to provide additional information about bowling technique and performance.

The frontend is built using web technologies and packaged for mobile devices using Capacitor, allowing the application to target both iOS and Android.

## Features

- **User Accounts** — Create and manage accounts, with support for guest users.
- **Profile Customization** — Manage profile information, including profile pictures, display names, and preferred bowling hand.
- **Bowling Score Tracking** — Record and manage bowling games and scores.
- **Events** — Organize and track bowling sessions and events.
- **Bowling Locations** — Associate games and events with bowling locations.
- **Performance Tracking** — View bowling performance and statistics over time.
- **Friends** — Connect with other users and manage a friends list.
- **Pose3D Analysis** — Analyze bowling motion using video and pose estimation.

## Technology Stack

### Frontend

The frontend uses HTML, CSS, JavaScript, and Vite. It handles the user interface, client-side state, and communication with the Python API.

The application follows a mobile-first design and supports both guest and authenticated users.

### Python API

The backend uses FastAPI to define HTTP endpoints and Uvicorn to run the API server.

The JavaScript frontend communicates with the API through HTTP requests using `fetch()`. The API processes requests and returns JSON responses.

Important files include:

- `Database/api/main.py` — Defines the FastAPI application and API routes.
- `Database/database/connection.py` — Opens the configured SQL Server connection.
- `frontend/js/api_client.js` — Contains JavaScript functions for communicating with the API.
- `Database/` — Contains existing database connection, entity, and repository code.

The API acts as the intermediary between the frontend and the database. Database credentials should never be embedded in frontend code.

### Database

The integrated application uses SQL Server. The earlier SQLite prototype is archived:

- **SQLite** — Archived prototype only; it does not implement the integrated JWT API contract.
- **SQL Server** — Used when running against a configured SQL Server database.

The local SQLite database is initialized using the schema and seed files in `legacy/test_database/`.

Database configuration is supplied through environment files. The frontend should communicate with the API rather than connecting directly to the database.

### Video AI

The application includes a planned video analysis pipeline for analyzing bowling motion.

The intended processing flow is:

1. Capture bowling video.
2. Preprocess the video and prepare model input.
3. Run the Pose3D model.
4. Postprocess the model output.
5. Generate bowling analysis.

The planned pipeline uses Python, ONNX Runtime, and a Pose3D model.

Running Python on a development computer does not automatically package a Python runtime into the mobile application. Mobile runtime integration and compatibility with Python dependencies must be addressed separately before this pipeline can run as intended in packaged iOS and Android builds.

## Project Architecture

The intended request flow is:

```text
JavaScript Frontend
        |
        | HTTP requests
        v
Python API
(FastAPI / Uvicorn)
        |
        v
Database Connection
        |
        v
Database Repositories
        |
        v
SQLite or SQL Server

## Repository layout and integrated development

```text
frontend/                HTML pages, js/, css/, and public assets
Database/api/            Integrated JWT-protected FastAPI backend
Database/database/       SQL Server connection and schema
Database/entities/       Existing database entities
Database/repositories/   Existing database repositories
Database/scripts/        Database helper scripts
legacy/                  Earlier API, SQLite files, unused starter source
scripts/                 Project setup, startup, diagnostics, and build commands
Statistics/              Statistics work
android/, ios/           Capacitor native projects
dist/                    Generated frontend build (ignored)
```

Run commands from the repository root. Keep `.env` and `.venv` here;
never copy database passwords or the JWT secret into `frontend/`.

### Setup

```powershell
npm.cmd run setup
```

This installs JavaScript and integrated SQL Server Python dependencies.
It does not modify database tables or initialize/reset SQLite by default.
Install Microsoft ODBC Driver 18 separately and configure the existing root
`.env` with `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `JWT_SECRET`.
The optional database health route uses `API_ENABLE_DB_HEALTH=true`.

### Start

Keep your existing SSH database tunnel running in a separate terminal when
using its local forwarded database address. Then:

```powershell
npm.cmd run dev:full
```

Or start the components separately:

```powershell
npm.cmd run dev
npm.cmd run dev:python
```

- Website: http://localhost:5173
- API docs: http://127.0.0.1:8000/docs
- API health: http://127.0.0.1:8000/health
- Optional DB health: http://127.0.0.1:8000/health/db

Login uses the application username and password, not SQL Server credentials.
The integrated frontend uses JWT bearer tokens. Logout clears its saved token.
The game screen saves events, sessions, games, frames, and shots to SQL Server
and restores recorded shots after a refresh. It does not calculate scores yet.

After pulling this reorganization, restart existing Vite/API processes so
they load the new configuration. URLs such as `/game.html` remain unchanged.

### Build, preview, and checks

```powershell
npm.cmd run build
npm.cmd run preview
npm.cmd run test -- --run
```

Vite builds all four HTML pages into root `dist/`; Capacitor continues to use
that directory. Preview is on a different origin from the development server;
authenticated API use there requires an explicit CORS entry for that origin.
The default SQL Server API command is still:

```powershell
.\.venv\Scripts\python.exe -m uvicorn Database.api.main:app --reload --host 127.0.0.1 --port 8000
```

See `legacy/README.md` for the isolated SQLite prototype. Do not run
`dev:full -- --test` with the integrated frontend; those login contracts differ.
