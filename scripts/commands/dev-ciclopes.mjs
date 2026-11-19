import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const ciclopesRoot = resolve(projectRoot, "Ciclopes-API");
const apiPort = Number(process.env.CICLOPES_PORT || 8001);
const clientPort = Number(process.env.VITE_PORT || 5173);
const databasePort = 8000;
const args = process.argv.slice(2);
const dbArgument = args.find((arg) => arg.startsWith("--db="));
const databaseMode = dbArgument?.slice("--db=".length) || "real";
const extraArgs = args.filter((arg) => !arg.startsWith("--db="));

if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    console.error("CICLOPES_PORT must be a valid TCP port number.");
    process.exit(1);
}
if (apiPort === databasePort || apiPort === clientPort || clientPort === databasePort) {
    console.error("Vite, the database API, and Ciclopes must use three different ports.");
    process.exit(1);
}

if (!["test", "real"].includes(databaseMode)) {
    console.error("Choose a database with --db=test or --db=real.");
    process.exit(1);
}

const children = new Map();
let stopping = false;

function run(command, commandArgs) {
    try {
        return execFileSync(command, commandArgs, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return "";
    }
}

function listeners(port) {
    if (process.platform === "win32") {
        const output = run("powershell", [
            "-NoProfile", "-Command",
            `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique | ForEach-Object { $_ }`,
        ]);
        return output.split(/\s+/).filter((pid) => /^\d+$/.test(pid));
    }

    const output = run("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"]);
    return [...new Set(output.split(/\s+/).filter((pid) => /^\d+$/.test(pid)))];
}

function processInfo(pid) {
    if (process.platform === "win32") {
        const output = run("powershell", [
            "-NoProfile", "-Command",
            `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object -ExpandProperty CommandLine)`,
        ]);
        return { command: output.toLowerCase(), cwd: "" };
    }

    const command = run("ps", ["-p", pid, "-o", "command="]).toLowerCase();
    const cwdOutput = run("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]);
    const cwd = cwdOutput.split("\n").find((line) => line.startsWith("n"))?.slice(1) || "";
    return { command, cwd: cwd.toLowerCase() };
}

function ownsKnownSession(pid, port) {
    const { command, cwd } = processInfo(pid);
    const normalizedRoot = projectRoot.toLowerCase();
    const normalizedCiclopes = ciclopesRoot.toLowerCase();
    const isProjectCwd = cwd === normalizedRoot || cwd.startsWith(`${normalizedRoot}/`);
    const isCiclopesCwd = cwd === normalizedCiclopes
        || cwd.startsWith(`${normalizedCiclopes}/`)
        || cwd.includes("/ciclopes/ciclopes-api");

    if (port === clientPort) return command.includes("vite") && isProjectCwd;
    if (port === databasePort) {
        return (command.includes("database.api.main") && isProjectCwd)
            || ((command.includes("uvicorn") || command.includes("ciclopes")) && isCiclopesCwd);
    }
    return (command.includes("uvicorn") && isCiclopesCwd)
        || (command.includes("ciclopes_local_frame_api.py") && isCiclopesCwd);
}

function terminate(pid) {
    try {
        if (process.platform === "win32") {
            execFileSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
        } else {
            process.kill(Number(pid), "SIGTERM");
        }
    } catch {
        // The process may have exited between discovery and shutdown.
    }
}

async function closePreviousSessions() {
    const managedPorts = [...new Set([clientPort, databasePort, apiPort])];
    const stale = [];

    for (const port of managedPorts) {
        for (const pid of listeners(port)) {
            if (!ownsKnownSession(pid, port)) {
                console.error(`Port ${port} is occupied by an unrelated process (PID ${pid}); leaving it untouched.`);
                process.exitCode = 1;
                return false;
            }
            stale.push({ pid, port });
        }
    }

    if (stale.length) {
        console.log("Stopping previous RevCapstone client and Ciclopes sessions...");
        for (const { pid } of stale) terminate(pid);

        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            const stillListening = managedPorts.some((port) => listeners(port).length > 0);
            if (!stillListening) break;
            await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
        }

        const occupied = managedPorts.flatMap((port) => listeners(port).map((pid) => ({ port, pid })));
        if (occupied.length) {
            console.error(`Could not close previous session(s): ${occupied.map(({ port, pid }) => `${port} (PID ${pid})`).join(", ")}`);
            process.exitCode = 1;
            return false;
        }
    }
    return true;
}

function selectPython() {
    const candidates = process.env.CICLOPES_PYTHON
        ? [process.env.CICLOPES_PYTHON]
        : [
            resolve(ciclopesRoot, ".venv", "bin", "python"),
            resolve(ciclopesRoot, ".venv-api", "bin", "python"),
            "python3.11",
            "python3",
            "python",
        ];

    for (const candidate of candidates) {
        if (candidate.includes("/") && !existsSync(candidate)) continue;
        const version = run(candidate, ["-c", "import sys; print('%d.%d' % sys.version_info[:2])"]);
        const [major, minor] = version.split(".").map(Number);
        if (major > 3 || (major === 3 && minor >= 10)) return candidate;
    }
    return null;
}

function validateCiclopesEnvironment(python) {
    const envPath = resolve(ciclopesRoot, ".env");
    if (!existsSync(envPath)) {
        console.error(`Ciclopes configuration is missing: ${envPath}`);
        console.error("Copy Ciclopes-API/.env.example to Ciclopes-API/.env and configure the required model settings first.");
        return false;
    }

    const envText = readFileSync(envPath, "utf8");
    const tokenInFile = envText.match(/^\s*HF_TOKEN\s*=\s*(.*?)\s*$/m)?.[1]
        ?.replace(/^['"]|['"]$/g, "") || "";
    const effectiveToken = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN || tokenInFile;
    const hasToken = Boolean(effectiveToken);
    const placeholderToken = ["hf_token", "your_token", "your_hf_token", "changeme"]
        .includes(effectiveToken.toLowerCase());
    const localModelReady = existsSync(resolve(ciclopesRoot, "core", "weights", "sam3d_body", "model.ckpt"))
        && existsSync(resolve(ciclopesRoot, "core", "weights", "sam3d_body", "assets", "mhr_model.pt"));
    if ((!hasToken || placeholderToken) && !localModelReady) {
        console.error("SAM 3D Body needs an approved Hugging Face HF_TOKEN or local SAM3D model weights.");
        console.error("Set HF_TOKEN in Ciclopes-API/.env, then run this command again.");
        return false;
    }

    const importArgs = [
        "-c",
        "import sys; sys.path[:0] = ['core', '.']; from core.InferenceEngine.InferenceEngine import InferenceEngine",
    ];
    try {
        execFileSync(python, importArgs, { cwd: ciclopesRoot, stdio: "ignore" });
    } catch {
        // Show the import traceback so a missing dependency is actionable.
        try {
            execFileSync(python, importArgs, { cwd: ciclopesRoot, stdio: "inherit" });
        } catch {
            console.error("Ciclopes Python dependencies are incomplete. Install Ciclopes-API/requirements-macos.txt in this Python environment.");
            return false;
        }
    }
    return true;
}

function stopAll(signal = "SIGTERM", exitCode = 0) {
    if (stopping) return;
    stopping = true;
    console.log("Stopping Ciclopes and RevCapstone...");

    for (const child of children.values()) {
        if (child.exitCode !== null || child.killed) continue;
        try {
            if (process.platform === "win32") child.kill(signal);
            else process.kill(-child.pid, signal);
        } catch {
            child.kill(signal);
        }
    }
    process.exitCode = exitCode;
}

function start(name, command, commandArgs, cwd, env = process.env) {
    console.log(`Starting ${name}...`);
    const child = spawn(command, commandArgs, {
        cwd,
        env,
        stdio: "inherit",
        detached: process.platform !== "win32",
    });
    children.set(name, child);

    child.once("error", (error) => {
        console.error(`${name} failed to start: ${error.message}`);
        stopAll("SIGTERM", 1);
    });
    child.once("exit", (code, signal) => {
        children.delete(name);
        if (!stopping) {
            console.error(`${name} exited unexpectedly (${signal || `code ${code ?? "unknown"}`}).`);
            stopAll("SIGTERM", code === 0 ? 1 : code ?? 1);
        }
    });
    return child;
}

process.once("SIGINT", () => stopAll("SIGINT"));
process.once("SIGTERM", () => stopAll("SIGTERM"));

async function main() {
    const python = selectPython();
    if (!python) {
        console.error(
            "Ciclopes needs Python 3.10 or newer (the macOS setup recommends 3.11).\n"
            + "Create Ciclopes-API/.venv with Python 3.11 and install requirements-macos.txt,\n"
            + "or set CICLOPES_PYTHON to that environment's Python executable.",
        );
        process.exitCode = 1;
        return;
    }
    if (!validateCiclopesEnvironment(python)) {
        process.exitCode = 1;
        return;
    }
    if (!(await closePreviousSessions())) return;

    const frontendAndBackend = resolve(projectRoot, "scripts", "dev.mjs");
    const ciclopesEnv = {
        ...process.env,
        PYTHONPATH: [resolve(ciclopesRoot, "core"), ciclopesRoot, process.env.PYTHONPATH]
            .filter(Boolean).join(process.platform === "win32" ? ";" : ":"),
    };

    start("Ciclopes API", python, [
        "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0",
        "--port", String(apiPort),
    ], ciclopesRoot, ciclopesEnv);
    start("RevCapstone environment", process.execPath, [frontendAndBackend, ...extraArgs, `--db=${databaseMode}`, "--local"], projectRoot, {
        ...process.env,
        CICLOPES_API_BASE: `/ciclopes`,
    });

    console.log(`Ciclopes API: http://127.0.0.1:${apiPort}/docs`);
    console.log("RevCapstone starts Vite on port 5173 and its database API on port 8000.");
    console.log("Press Ctrl+C to stop all three services.");
}

main().catch((error) => {
    console.error(`Could not start the development environment: ${error.message}`);
    stopAll("SIGTERM", 1);
});
