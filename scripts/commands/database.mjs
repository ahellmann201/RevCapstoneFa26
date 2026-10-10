import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
);

const isWindows = process.platform === "win32";

const pythonExecutable = resolve(
    projectRoot,
    ".venv",
    ...(isWindows
        ? ["Scripts", "python.exe"]
        : ["bin", "python"]),
);

const databasePath = resolve(
    projectRoot,
    "test_database",
    "capstone_test.db",
);

const schemaPath = resolve(
    projectRoot,
    "test_database",
    "schema.sql",
);

const seedPath = resolve(
    projectRoot,
    "test_database",
    "seed.sql",
);

const action = process.argv[2];

function fail(message) {
    console.error(`\nDatabase Error: ${message}\n`);
    process.exitCode = 1;
}

function requirePython() {
    if (!existsSync(pythonExecutable)) {
        fail(
            "The Python virtual environment was not found.\n" +
            "Run `npm run cap -- setup` first.",
        );

        return false;
    }

    return true;
}

function runPython(args) {
    return new Promise((resolvePromise) => {
        const child = spawn(
            pythonExecutable,
            args,
            {
                cwd: projectRoot,
                env: process.env,
                stdio: "inherit",
            },
        );

        child.once("error", (error) => {
            console.error(
                `Failed to start Python: ${error.message}`,
            );

            resolvePromise(1);
        });

        child.once("exit", (code, signal) => {
            if (signal) {
                console.error(
                    `Python terminated with signal ${signal}.`,
                );

                resolvePromise(1);
                return;
            }

            resolvePromise(code ?? 1);
        });
    });
}

async function initializeDatabase() {
    if (!requirePython()) return;

    if (!existsSync(schemaPath) || !existsSync(seedPath)) {
        fail(
            "The SQLite schema or seed file is missing.\n" +
            "Expected test_database/schema.sql and test_database/seed.sql.",
        );

        return;
    }

    console.log("Initializing the local SQLite test database...");
    console.log("Existing test data will be preserved where supported.\n");

    const result = await runPython([
        "-m",
        "test_database.connection",
    ]);

    if (result !== 0) {
        process.exitCode = result;
        return;
    }

    console.log("\nSQLite database initialization completed.");
}

async function resetDatabase() {
    if (!requirePython()) return;

    if (!existsSync(schemaPath) || !existsSync(seedPath)) {
        fail(
            "The SQLite schema or seed file is missing.\n" +
            "Expected test_database/schema.sql and test_database/seed.sql.",
        );

        return;
    }

    if (process.env.CAP_CONFIRM_RESET !== "yes") {
        fail(
            "Database reset requires explicit confirmation.\n" +
            "This deletes the local SQLite test database and its data.\n\n" +
            "To confirm, run:\n" +
            (isWindows
                ? '  $env:CAP_CONFIRM_RESET="yes"; npm run cap -- db reset'
                : '  CAP_CONFIRM_RESET=yes npm run cap -- db reset'),
        );

        return;
    }

    console.log("Resetting the local SQLite test database...");
    console.log(`Database file: ${databasePath}`);

    try {
        rmSync(databasePath, { force: true });
        rmSync(`${databasePath}-journal`, { force: true });
        rmSync(`${databasePath}-wal`, { force: true });
        rmSync(`${databasePath}-shm`, { force: true });
    } catch (error) {
        fail(`Could not remove the local database: ${error.message}`);
        return;
    }

    const result = await runPython([
        "-m",
        "test_database.connection",
    ]);

    if (result !== 0) {
        process.exitCode = result;
        return;
    }

    console.log("\nSQLite database reset completed.");
}

async function checkDatabase() {
    const baseUrl = (
        process.env.CAP_API_URL || "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");

    const healthUrl = `${baseUrl}/api/health`;

    console.log(`Checking API health at ${healthUrl}...`);

    try {
        const response = await fetch(healthUrl, {
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            fail(
                `The API returned HTTP ${response.status}.\n` +
                "This does not confirm database connectivity.",
            );

            return;
        }

        const result = await response.json();

        console.log("Python API is responding.");
        console.log(`Response: ${JSON.stringify(result)}`);
        console.log(
            "Note: the health endpoint confirms API availability, " +
            "not that a database query succeeded.",
        );
    } catch (error) {
        fail(
            `Could not reach the Python API: ${error.message}\n` +
            "Start the API and try again.",
        );
    }
}

async function main() {
    switch (action) {
        case "init":
            await initializeDatabase();
            break;

        case "reset":
            await resetDatabase();
            break;

        case "check":
            await checkDatabase();
            break;

        default:
            fail(
                'Unknown database action. Use "init", "reset", or "check".',
            );
    }
}

main().catch((error) => {
    fail(error.message);
});