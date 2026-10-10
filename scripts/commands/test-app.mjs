import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

const databaseModule = "test_database.connection";

const developmentScript = resolve(
    projectRoot,
    "scripts",
    "dev.mjs",
);

let activeProcess = null;
let shuttingDown = false;

function fail(message) {
    console.error(`\nTest Application Error: ${message}\n`);
    process.exitCode = 1;
}

function runProcess(command, args, name) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, {
            cwd: projectRoot,
            env: process.env,
            stdio: "inherit",
        });

        activeProcess = child;

        child.once("error", (error) => {
            activeProcess = null;
            rejectPromise(
                new Error(`${name} failed to start: ${error.message}`),
            );
        });

        child.once("exit", (code, signal) => {
            activeProcess = null;

            if (shuttingDown) {
                resolvePromise(0);
                return;
            }

            if (code === 0) {
                resolvePromise(0);
                return;
            }

            rejectPromise(
                new Error(
                    `${name} exited with ${
                        signal ? `signal ${signal}` : `code ${code}`
                    }.`,
                ),
            );
        });
    });
}

function handleShutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;

    if (activeProcess && activeProcess.exitCode === null) {
        activeProcess.kill(signal);
    }
}

async function main() {
    if (!existsSync(pythonExecutable)) {
        fail(
            "The Python virtual environment was not found.\n" +
            "Run `npm run cap -- setup` first.",
        );
        return;
    }

    if (!existsSync(developmentScript)) {
        fail("The development launcher scripts/dev.mjs was not found.");
        return;
    }

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

    if (!existsSync(schemaPath) || !existsSync(seedPath)) {
        fail(
            "The test database schema or seed file is missing.\n" +
            "Expected test_database/schema.sql and test_database/seed.sql.",
        );
        return;
    }

    process.once("SIGINT", () => handleShutdown("SIGINT"));
    process.once("SIGTERM", () => handleShutdown("SIGTERM"));

    console.log("========================================");
    console.log(" RevCapstone Test Application");
    console.log("========================================");
    console.log("Database: local SQLite");
    console.log("Initializing the test database...\n");

    try {
        await runProcess(
            pythonExecutable,
            ["-m", databaseModule],
            "Test database initialization",
        );

        if (shuttingDown) return;

        console.log("\nTest database initialization completed.");
        console.log("Starting the frontend and Python API in test mode...\n");

        await runProcess(
            process.execPath,
            [developmentScript, "--test"],
            "Development environment",
        );
    } catch (error) {
        if (!shuttingDown) {
            fail(error.message);
        }
    }
}

main();