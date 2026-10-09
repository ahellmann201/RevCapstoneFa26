# RevCapstoneFa26

## Overview

This project is a mobile bowling application developed as a York College of Pennsylvania Computer Science Capstone project. The application allows users to record and track bowling games, manage bowling events and locations, view performance data, and connect with other bowlers.

The application is designed to support both casual score tracking and longer-term performance analysis. It also includes on-device video analysis using Pose3D to provide additional information about a user’s bowling performance.

The application is built using a web-based frontend and packaged for mobile devices using Capacitor, allowing the same application to be deployed to both iOS and Android.

## Features

- **User Accounts** — Create and manage a personal account, with support for guest users.
- **Profile Customization** — Customize profile information, including profile pictures, display names, and preferred bowling hand.
- **Bowling Score Tracking** — Record and manage bowling games and scores.
- **Events** — Organize and track bowling sessions and events.
- **Bowling Locations** — Associate games and events with bowling locations.
- **Performance Tracking** — View and track bowling performance and statistics over time.
- **Friends** — Connect with other users and manage a personal friends list.
- **Pose3D Analysis** — Record bowling videos and use on-device pose analysis to gather additional information about bowling technique and performance.

## Technical Overview

### UI

The user interface is built with **HTML**, **CSS**, and **JavaScript** and follows a mobile-first design.

### Client

The client is a **Vite**-based JavaScript application responsible for UI logic, client-side state, local data, and communication with the API. The client supports both guest and authenticated users.

### API Communication

The JavaScript client communicates with the Python API through HTTP requests. The API exposes routes such as `/api/test`; JavaScript uses `fetch()` to call a route, and Python returns JSON that JavaScript can parse and use.

The current local API setup is intended for development and testing. It does not, by itself, mean that Python has been packaged into the iOS or Android app.

### Python API

The Python API uses **FastAPI** to define HTTP endpoints and **Uvicorn** to run the local development server.

- `api/main.py` defines the FastAPI application and its routes.
- `js/api_client.js` contains JavaScript functions for calling the API.
- `Database/` contains the existing Python database connection, entity, and repository code.

The intended request flow is:

```text
JavaScript frontend
        |
        | HTTP request (fetch)
        v
Python API (FastAPI / Uvicorn)
        |
        v
Python database repositories
        |
        v
DigitalOcean database
```

The initial `/api/test` endpoint is a connectivity test. Database-backed API endpoints must be implemented separately using the project's existing database code.

### Database

The database stores persistent application data, including users, games, events, locations, friendships, and performance information.

The JavaScript client should communicate with the API rather than connecting directly to the database. Database credentials must not be embedded in frontend code or committed to the repository.

### Video AI

The application includes an on-device video analysis pipeline for analyzing bowling motion. The planned pipeline uses Python, ONNX Runtime, and a Pose3D model.

```text
Video Capture
      ↓
Preprocessing
      ↓
Pose3D Model
      ↓
Postprocessing
      ↓
Bowling Analysis
```

Running Python locally on a development computer is separate from packaging a Python runtime inside the mobile application. Mobile runtime integration and compatibility with Python dependencies must be addressed before relying on this approach in packaged iOS and Android builds.

## Development Setup

These instructions describe local development on a developer computer. They assume Python 3, Node.js, and npm are installed.

### 1. Clone the repository and install JavaScript dependencies

From the repository root:

```sh
npm install
```

### 2. Create and activate a Python virtual environment

Create the environment once:

```sh
python3 -m venv .venv
```

Activate it whenever opening a new terminal session for Python development.

**macOS / Linux:**

```sh
source .venv/bin/activate
```

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

The terminal prompt usually shows `(.venv)` when the environment is active. To leave the environment, run:

```sh
deactivate
```

### 3. Install Python API dependencies

With the virtual environment activated, run:

```sh
python -m pip install fastapi uvicorn
```

If the project adds a `requirements.txt` file, prefer installing the complete Python dependency list with:

```sh
python -m pip install -r requirements.txt
```

The existing database layer may require additional dependencies and system drivers. Install those according to the database setup instructions. In particular, if the configured database connection uses `pyodbc` and Microsoft's ODBC Driver 18 for SQL Server, those components must be available on the development machine for database connectivity to work.

### 4. Confirm the API entry point exists

The API entry point is `api/main.py`. A minimal development API can look like this:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Capstone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Capstone API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/test")
def test():
    return {
        "message": "Hello from Python!",
        "language": "Python",
    }
```

Keep the existing application code when adding or updating routes; do not replace other routes with this example. CORS origins should be restricted to the development origins actually used by the frontend.

### 5. Configure npm scripts to run both servers

Install `concurrently` if it is not already installed:

```sh
npm install --save-dev concurrently
```

Add the following entries to the existing `scripts` section of `package.json`, preserving the other scripts:

```json
"dev": "vite",
"dev:host": "vite --host",
"dev:python": "python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000",
"dev:full": "concurrently -k -n FRONTEND,API \"npm run dev:host\" \"npm run dev:python\""
```

These scripts assume the Python virtual environment has been activated in the terminal. On macOS or Linux, activate it with `source .venv/bin/activate` before starting the combined command. On Windows, activate it using the PowerShell command above.

### 6. Start the frontend and API

From the repository root, with the Python virtual environment activated:

```sh
npm run dev:full
```

This starts both processes:

- **Vite frontend:** typically available at port `5173`.
- **Python API:** available at port `8000`.

The `--host` setting makes Vite available to other devices on the local network. Uvicorn uses `0.0.0.0` to listen on the machine's available network interfaces.

To run only one service:

```sh
npm run dev
```

```sh
npm run dev:python
```

Press `Ctrl+C` in the terminal running `dev:full` to stop both processes.

### 7. Test the API

On the same computer, open these addresses in a browser:

- Frontend: `http://localhost:5173/`
- API health check: `http://127.0.0.1:8000/api/health`
- API test endpoint: `http://127.0.0.1:8000/api/test`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

The test endpoint should return JSON similar to:

```json
{
  "message": "Hello from Python!",
  "language": "Python"
}
```

### 8. Call the API from the browser console

The JavaScript API client is in `js/api_client.js`. It can define functions that use `fetch()` to call Python routes and parse JSON responses.

For console-based testing, the client can expose a development helper on `window`, for example:

```javascript
window.testPython = testPython;
```

The module must be loaded by the application before `testPython()` will be available in the browser console. If `navbar.js` imports `api_client.js`, navigate to a page that loads the navbar and then run:

```javascript
await testPython();
```

This should log the response from Python. If a request fails, check that both servers are running and inspect the browser console and Python terminal for errors.

### 9. Test from a phone on the same Wi-Fi network

1. Connect the phone and development computer to the same Wi-Fi network.
2. Start the services with `npm run dev:full`.
3. On macOS, find the computer's local IP address with:

   ```sh
   ipconfig getifaddr en0
   ```

4. On the phone, open `http://<computer-ip>:5173/`, replacing `<computer-ip>` with the IP address returned by the command.
5. If JavaScript on the phone needs to call the API on the computer, configure the API base URL to use `http://<computer-ip>:8000`, not `127.0.0.1`. On the phone, `127.0.0.1` refers to the phone itself.
6. Add the Vite origin used by the phone to FastAPI's CORS allowlist if needed, and make sure the computer's firewall permits local network connections to the development ports.

The phone and computer must be able to communicate over the local network. This setup is for development only; do not expose an unauthenticated API or database operations to untrusted networks.

## Commands

### Install JavaScript dependencies

```sh
npm install
```

### Start Vite only

```sh
npm run dev
```

### Start Vite with local network access

```sh
npm run dev:host
```

### Start the Python API only

Activate `.venv` first, then run:

```sh
npm run dev:python
```

### Start both Vite and Python

Activate `.venv` first, then run:

```sh
npm run dev:full
```

### Run tests

```sh
npm run test
```

### Build the frontend

```sh
npm run build
```

## Notes and Limitations

- The `.venv/` directory is local to each developer's machine and should not be committed. Each developer creates their own virtual environment and installs the required dependencies.
- Python packages should eventually be recorded in a committed `requirements.txt` so all developers can install the same dependencies.
- `127.0.0.1` refers to the device making the request. Use the development computer's LAN IP when testing from a phone.
- The current local HTTP API setup is a development arrangement. Packaging and launching an embedded Python runtime inside Capacitor on iOS and Android is a separate task and is not accomplished by the npm scripts above.
- Do not commit `.env` files, passwords, database credentials, or other secrets.
- The client must not be trusted to authorize access to private records. API endpoints that access or modify user data must validate authentication and enforce authorization on the Python side.
