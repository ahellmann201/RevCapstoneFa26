import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url))
);

const testMode = process.argv.includes("--test");

const venvPython = resolve(
    projectRoot,
    ".venv",
    "bin",
    "python"
);

if (!existsSync(venvPython)) {
    console.error("Python virtual environment not found at .venv/");
    process.exit(1);
}

const envFile = testMode ? ".env.test" : ".env";
const envPath = resolve(projectRoot, envFile);

if (!existsSync(envPath)) {
    console.error(`Missing environment file: ${envFile}`);
    process.exit(1);
}

// Load environment variables from the selected file.
const dotenv = await import("dotenv");

const parsedEnv = dotenv.config({
    path: envPath,
    quiet: true,
});

if (parsedEnv.error) {
    console.error(`Failed to load ${envFile}:`, parsedEnv.error);
    process.exit(1);
}

const environment = {
    ...process.env,
    ...parsedEnv.parsed,
};

if (testMode) {
    environment.APP_ENV = "test";
    environment.DB_TYPE = "sqlite";
} else {
    environment.APP_ENV = "development";
    environment.DB_TYPE = "sqlserver";
}

console.log(
    `Starting Capstone in ${testMode ? "TEST" : "DEVELOPMENT"} mode...`
);

const processes = [];

function startProcess(name, command, args) {
    const child = spawn(command, args, {
        cwd: projectRoot,
        env: environment,
        stdio: "inherit",
    });

    child.on("error", (error) => {
        console.error(`${name} failed to start:`, error.message);
        shutdown(1);
    });

    child.on("exit", (code) => {
        if (!shuttingDown) {
            console.error(
                `${name} exited with code ${code ?? "unknown"}`
            );
            shutdown(code || 1);
        }
    });

    processes.push(child);
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
    if (shuttingDown) return;

    shuttingDown = true;

    for (const child of processes) {
        if (child.exitCode === null && !child.killed) {
            child.kill("SIGTERM");
        }
    }

    setTimeout(() => {
        process.exit(exitCode);
    }, 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Start the Python API using the project's virtual environment.
startProcess(
    "Python API",
    venvPython,
    [
        "-m",
        "uvicorn",
        "api.main:app",
        "--reload",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]
);

// Start the Vite development server.
startProcess(
    "Vite",
    process.execPath,
    [
        resolve(projectRoot, "node_modules/vite/bin/vite.js"),
        "--host",
    ]
);