import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const args = process.argv.slice(2);
const databaseArgument = args.find((arg) => arg.startsWith("--db="));
const databaseMode = databaseArgument?.slice("--db=".length)
    ?? (args.includes("--test") ? "test" : "real");
if (!["test", "real"].includes(databaseMode)) {
    console.error("Choose a database with --db=test or --db=real.");
    process.exit(1);
}
const testMode = databaseMode === "test";
const lanMode = !args.includes("--local");
const extraArgs = args.filter((arg) =>
    arg !== "--test" && !arg.startsWith("--db=")
    && arg !== "--lan" && arg !== "--local"
);

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
apiArgs.push(`--db=${databaseMode}`);
if (lanMode) {
    apiArgs.push("--lan");
    frontendArgs.push("--lan");
} else {
    apiArgs.push("--local");
    frontendArgs.push("--local");
}

startProcess("Python API", apiScript, apiArgs);
startProcess("Frontend", frontendScript, frontendArgs);
