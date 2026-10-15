import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const args = process.argv.slice(2);
const testMode = args.includes("--test");
const lanMode = args.includes("--lan");
const extraArgs = args.filter((arg) => arg !== "--test" && arg !== "--lan");

const apiScript = resolve(projectRoot, "scripts", "commands", "api.mjs");
const frontendScript = resolve(projectRoot, "scripts", "commands", "frontend.mjs");

const children = new Map();
let stopping = false;

function stopAll(signal = "SIGTERM", exitCode = 0) {
    if (stopping) return;
    stopping = true;

    for (const child of children.values()) {
        if (child.exitCode === null && !child.killed) child.kill(signal);
    }

    process.exitCode = exitCode;
}

function startProcess(name, script, childArgs) {
    if (!existsSync(script)) {
        console.error(`Required ${name} script was not found: ${script}`);
        stopAll("SIGTERM", 1);
        return;
    }

    console.log(`Starting ${name}...`);
    const child = spawn(process.execPath, [script, ...childArgs], {
        cwd: projectRoot,
        env: process.env,
        stdio: "inherit",
    });
    children.set(name, child);

    child.once("error", (error) => {
        console.error(`${name} failed to start: ${error.message}`);
        stopAll("SIGTERM", 1);
    });

    child.once("exit", (code, signal) => {
        children.delete(name);
        if (stopping) return;

        console.error(
            `${name} exited unexpectedly (${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}).`,
        );
        stopAll("SIGTERM", code === 0 ? 1 : code ?? 1);
    });
}

process.once("SIGINT", () => stopAll("SIGINT"));
process.once("SIGTERM", () => stopAll("SIGTERM"));

console.log(
    `Starting frontend and API in ${testMode ? "TEST" : "DEVELOPMENT"} mode${lanMode ? " on the LAN" : ""}.`,
);

const apiArgs = [...extraArgs];
const frontendArgs = [...extraArgs];
if (testMode) apiArgs.push("--test");
if (lanMode) {
    apiArgs.push("--lan");
    frontendArgs.push("--lan");
}

startProcess("Python API", apiScript, apiArgs);
startProcess("Frontend", frontendScript, frontendArgs);
