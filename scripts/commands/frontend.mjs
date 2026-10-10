import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
);

const viteCli = resolve(
    projectRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
);

function fail(message) {
    console.error(`\nFrontend Error: ${message}\n`);
    process.exit(1);
}

function main() {
    if (!existsSync(viteCli)) {
        fail(
            "Vite is not installed.\n" +
            "Run `npm run cap -- setup` to install the project dependencies.",
        );
    }

    const extraArgs = process.argv.slice(2);

    console.log("Starting the RevCapstone frontend...");
    console.log("Vite will display the local development URL below.\n");

    const child = spawn(
        process.execPath,
        [viteCli, ...extraArgs],
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
            `Failed to start the Vite frontend: ${error.message}`,
        );

        process.exitCode = 1;
    });

    child.on("exit", (code, signal) => {
        process.removeListener("SIGINT", handleSigint);
        process.removeListener("SIGTERM", handleSigterm);

        if (signal && !shuttingDown) {
            console.error(
                `Vite terminated unexpectedly with signal ${signal}.`,
            );

            process.exitCode = 1;
            return;
        }

        if (code !== null) {
            process.exitCode = code;
        } else if (shuttingDown) {
            process.exitCode = 0;
        } else {
            process.exitCode = 1;
        }
    });
}

main();