import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const args = process.argv.slice(2);
const testMode = args.includes("--test");

const apiScript = path.join(
    projectRoot,
    "scripts",
    "commands",
    "api.mjs"
);

const frontendScript = path.join(
    projectRoot,
    "scripts",
    "commands",
    "frontend.mjs"
);

const scripts = [apiScript, frontendScript];

for (const script of scripts) {
    if (!existsSync(script)) {
        console.error(`Required script not found: ${script}`);
        process.exit(1);
    }
}

const children = new Map();
let shuttingDown = false;
let failed = false;

function stopAll(exitCode = 0) {
    if (shuttingDown) return;

    shuttingDown = true;

    for (const child of children.values()) {
        if (child.exitCode === null && !child.killed) {
            child.kill("SIGTERM");
        }
    }

    const timeout = setTimeout(() => {
        for (const child of children.values()) {
            if (child.exitCode === null && !child.killed) {
                child.kill("SIGKILL");
            }
        }

        process.exit(exitCode);
    }, 5000);

    timeout.unref();

    Promise.all(
        [...children.values()].map(
            (child) =>
                new Promise((resolve) => {
                    if (child.exitCode !== null || child.signalCode !== null) {
                        resolve();
                    } else {
                        child.once("exit", resolve);
                    }
                })
        )
    ).then(() => {
        clearTimeout(timeout);
        process.exit(exitCode);
    });
}

function startProcess(name, script, childArgs = []) {
    console.log(`Starting ${name}...`);

    const child = spawn(
        process.execPath,
        [script, ...childArgs],
        {
            cwd: projectRoot,
            env: process.env,
            stdio: "inherit"
        }
    );

    children.set(name, child);

    child.on("error", (error) => {
        console.error(`${name} failed to start: ${error.message}`);
        failed = true;
        stopAll(1);
    });

    child.on("exit", (code, signal) => {
        children.delete(name);

        if (shuttingDown) return;

        if (code !== 0) {
            console.error(
                `${name} exited unexpectedly (code: ${code}, signal: ${signal}).`
            );
            failed = true;
            stopAll(1);
            return;
        }

        console.log(`${name} stopped.`);
        stopAll(failed ? 1 : 0);
    });

    return child;
}

process.on("SIGINT", () => stopAll(130));
process.on("SIGTERM", () => stopAll(143));

console.log(
    testMode
        ? "Starting frontend and API in TEST mode (SQLite)."
        : "Starting frontend and API in DEVELOPMENT mode."
);

startProcess(
    "Python API",
    apiScript,
    testMode ? ["--test"] : []
);

startProcess("Frontend", frontendScript);