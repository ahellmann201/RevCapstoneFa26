# RevCapstoneFa26
<<<<<<< HEAD

## Overview
This project is a mobile bowling application developed as a York College of Pennsylvania Computer Science Capstone project. The application allows users to record and track bowling games, manage bowling events and locations, view performance data, and connect with other bowlers.

The application is designed to support both casual score tracking and longer-term performance analysis. It also includes on-device video analysis using Pose3D to provide additional information about a user’s bowling performance.

The application is built using a web-based frontend and packaged for mobile devices using Capacitor, allowing the same application to be deployed to both iOS and Android.

## Features
* User Accounts — Create and manage a personal account, with support for guest users.
* Profile Customization — Customize profile information, including profile pictures, display names, and preferred bowling hand.
* Bowling Score Tracking — Record and manage bowling games and scores.
* Events — Organize and track bowling sessions and events.
* Bowling Locations — Associate games and events with bowling locations.
* Performance Tracking — View and track bowling performance and statistics over time.
* Friends — Connect with other users and manage a personal friends list.
* Pose3D Analysis — Record bowling videos and use on-device pose analysis to gather additional information about bowling technique and performance.

## Technical Overview

### UI

The user interface is built with **HTML**, **CSS**, and **JavaScript** and follows a mobile-first design.

### Client

The client is a **Vite**-based JavaScript application responsible for UI logic, client-side state, local data, and communication with the backend.

The client supports both **guest** and **authenticated** users.

### API Communication

The client communicates with the backend through an **API** for authentication and persistent application data.

API communication is used for operations involving:

- User accounts
- Bowling games and scores
- Events
- Locations
- Friendships
- Performance data

### Backend

The backend provides the application's API, business logic, authentication, authorization, and database access.

### Database

The database stores persistent application data, including users, games, events, locations, friendships, and performance information.

The client does not access the database directly.

### Video AI

The application includes an **on-device video analysis pipeline** for analyzing bowling motion.

The pipeline uses **Python**, **ONNX Runtime**, and a **Pose3D model**.

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

## Commands

### Install dependencies

Install the project dependencies listed in `package.json`. Run this after cloning the repository or when dependencies change:

```sh
npm install
```

The project already includes Vitest and jsdom as development dependencies. If you need to add them to a fresh or older checkout, use:

```sh
npm install -D vitest jsdom
```

### Run the development server

Start Vite's local development server with hot reloading. Open the local URL printed in the terminal (typically `http://localhost:5173`):

```sh
npm run dev
```

To make the server available to other devices on your local network, such as a phone used for testing, add the host flag:

```sh
npm run dev -- --host
```

### Run tests

Start the Vitest test runner:

```sh
npm run test
```

npm run test

https://lucid.app/lucidspark/b331f15c-ab04-4a91-9431-1e1df06ae60a/edit?beaconFlowId=C329386C8C156C92&page=0_0&invitationId=inv_bc223a45-ad5f-4d7e-ae88-da50ea4d7955#
