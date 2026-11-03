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

const args = process.argv.slice(2);
const legacyMode = args.includes("--legacy-test");
const databaseArgument = args.find((arg) => arg.startsWith("--db="));
const testMode = legacyMode || args.includes("--test")
    || databaseArgument?.slice("--db=".length) === "test";
const lanMode = process.argv.includes("--lan") || (!testMode && !process.argv.includes("--local"));

const extraArgs = args.filter(
    (arg) => arg !== "--test" && arg !== "--legacy-test"
        && !arg.startsWith("--db=") && arg !== "--lan" && arg !== "--local"
);

function fail(message) {
    console.error(`\nAPI Error: ${message}\n`);
    process.exit(1);
}

function main() {
    if (!existsSync(pythonExecutable)) {
        fail(
            "The project's Python virtual environment was not found.\n" +
            "Run `npm run setup` first."
        );
    }

    if (legacyMode) {
        console.warn("Legacy API only: incompatible with the integrated frontend login contract.");
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
    // In test mode the checked-in test config wins over shell-level values so
    // an exported production DB_* variable cannot redirect the test run.
    const environment = testMode
        ? {
            ...process.env,
            ...loaded.parsed,
            APP_ENV: "test",
            DB_TYPE: "sqlite",
        }
        : {
            ...loaded.parsed,
            ...process.env,
            APP_ENV: "development",
            DB_TYPE: "sqlserver",
        };

    console.log(
        `Starting the Python API in ${
            legacyMode ? "LEGACY SQLITE" : testMode ? "TEST SQLITE" : "SQL SERVER"
        } mode...`
    );

    console.log(
        testMode
            ? `Database: ${environment.DB_PATH || "local SQLite test database"}`
            : "Database: configured SQL Server"
    );

    const child = spawn(
        pythonExecutable,
        [
            "-m",
            "uvicorn",
            legacyMode ? "legacy.api.main:app" : "Database.api.main:app",
            "--reload",
            "--host",
            lanMode ? "0.0.0.0" : "127.0.0.1",
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
