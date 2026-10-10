import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const projectRoot = resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
);

const environmentFile = resolve(projectRoot, ".env");

const developmentScript = resolve(
    projectRoot,
    "scripts",
    "dev.mjs",
);

const requiredVariables = [
    "DB_SERVER",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
];

function fail(message) {
    console.error(`\nRemote Development Error: ${message}\n`);
    process.exit(1);
}

function validateEnvironment() {
    if (!existsSync(environmentFile)) {
        fail(
            "The .env file was not found.\n" +
            "Create it using .env.example as a reference, then configure your SQL Server connection.",
        );
    }

    const result = dotenv.config({
        path: environmentFile,
        quiet: true,
    });

    if (result.error) {
        fail(`Could not read .env: ${result.error.message}`);
    }

    const environment = result.parsed ?? {};

    const missingVariables = requiredVariables.filter((name) => {
        return !environment[name] || !environment[name].trim();
    });

    if (missingVariables.length > 0) {
        fail(
            "The following SQL Server settings are missing or empty in .env:\n" +
            missingVariables.map((name) => `  - ${name}`).join("\n") +
            "\n\nConfigure these values before starting remote mode.",
        );
    }

    if (
        environment.DB_TYPE &&
        environment.DB_TYPE.toLowerCase() !== "sqlserver"
    ) {
        fail(
            "Your .env file specifies a database type other than SQL Server.\n" +
            "Remote mode requires DB_TYPE=sqlserver.",
        );
    }

    return environment;
}

function main() {
    const environment = validateEnvironment();

    if (!existsSync(developmentScript)) {
        fail("The development launcher scripts/dev.mjs was not found.");
    }

    console.log("========================================");
    console.log(" RevCapstone Remote Development");
    console.log("========================================");
    console.log("Database: SQL Server");
    console.log(`Server: ${environment.DB_SERVER}`);
    console.log(`Database name: ${environment.DB_NAME}`);
    console.log("Credentials: configured");
    console.log("\nStarting the frontend and Python API...");
    console.log("Database writes may persist on the remote server.\n");

    const child = spawn(
        process.execPath,
        [developmentScript, ...process.argv.slice(2)],
        {
            cwd: projectRoot,
            env: process.env,
            stdio: "inherit",
        },
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
            `Failed to start remote development: ${error.message}`,
        );

        process.exitCode = 1;
    });

    child.on("exit", (code, signal) => {
        process.removeListener("SIGINT", handleSigint);
        process.removeListener("SIGTERM", handleSigterm);

        if (signal && !shuttingDown) {
            console.error(
                `Remote development terminated with signal ${signal}.`,
            );

            process.exitCode = 1;
            return;
        }

        process.exitCode = code ?? (shuttingDown ? 0 : 1);
    });
}

main();