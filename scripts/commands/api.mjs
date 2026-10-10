import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const projectRoot = resolve(
    fileURLToPath(new URL("../../", import.meta.url))
);

const isWindows = process.platform === "win32";

const pythonExecutable = resolve(
    projectRoot,
    ".venv",
    ...(isWindows
        ? ["Scripts", "python.exe"]
        : ["bin", "python"])
);

const testMode = process.argv.includes("--test");

const extraArgs = process.argv.slice(2).filter(
    (arg) => arg !== "--test"
);

function fail(message) {
    console.error(`\nAPI Error: ${message}\n`);
    process.exit(1);
}

function main() {
    if (!existsSync(pythonExecutable)) {
        fail(
            "The project's Python virtual environment was not found.\n" +
            "Run `npm run cap -- setup` first."
        );
    }

    const envFile = resolve(
        projectRoot,
        testMode ? ".env.test" : ".env"
    );

    if (!existsSync(envFile)) {
        fail(
            `Environment file not found: ${
                testMode ? ".env.test" : ".env"
            }`
        );
    }

    const loaded = dotenv.config({
        path: envFile,
        quiet: true
    });

    if (loaded.error) {
        fail(
            `Could not load environment configuration: ${
                loaded.error.message
            }`
        );
    }

    // Preserve terminal overrides while using the environment file
    // for variables that have not already been defined.
    const environment = {
        ...loaded.parsed,
        ...process.env,
        APP_ENV: testMode ? "test" : "development",
        DB_TYPE: testMode ? "sqlite" : "sqlserver"
    };

    console.log(
        `Starting the Python API in ${
            testMode ? "TEST" : "DEVELOPMENT"
        } mode...`
    );

    console.log(
        testMode
            ? "Database: local SQLite test database"
            : "Database: configured SQL Server"
    );

    const child = spawn(
        pythonExecutable,
        [
            "-m",
            "uvicorn",
            "api.main:app",
            "--reload",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
            ...extraArgs
        ],
        {
            cwd: projectRoot,
            env: environment,
            stdio: "inherit"
        }
    );

    let shuttingDown = false;

    function shutdown(signal = "SIGTERM") {
        if (shuttingDown) return;

        shuttingDown = true;

        if (child.exitCode === null && !child.killed) {
            child.kill(signal);
        }
    }

    function handleSigint() {
        shutdown("SIGINT");
    }

    function handleSigterm() {
        shutdown("SIGTERM");
    }

    process.once("SIGINT", handleSigint);
    process.once("SIGTERM", handleSigterm);

    child.on("error", (error) => {
        console.error(
            `Failed to start the Python API: ${error.message}`
        );

        process.exitCode = 1;
    });

    child.on("exit", (code, signal) => {
        process.removeListener("SIGINT", handleSigint);
        process.removeListener("SIGTERM", handleSigterm);

        if (signal && !shuttingDown) {
            console.error(
                `The Python API terminated with signal ${signal}.`
            );

            process.exitCode = 1;
            return;
        }

        process.exitCode = code ?? (shuttingDown ? 0 : 1);
    });
}

main();