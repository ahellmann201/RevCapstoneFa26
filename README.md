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

- `api/main.py` — Defines the FastAPI application and API routes.
- `api/config.py` — Handles API and database configuration.
- `js/api_client.js` — Contains JavaScript functions for communicating with the API.
- `Database/` — Contains existing database connection, entity, and repository code.

The API acts as the intermediary between the frontend and the database. Database credentials should never be embedded in frontend code.

### Database

The project supports two database environments:

- **SQLite** — Used for local testing and development.
- **SQL Server** — Used when running against a configured SQL Server database.

The local SQLite database is initialized using the schema and seed files in `test_database/`.

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