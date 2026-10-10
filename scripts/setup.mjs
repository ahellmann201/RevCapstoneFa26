import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wantsSqlServer = process.argv.includes("--sqlserver");
const isWindows = process.platform === "win32";

function run(command, args, options = {}) {
    console.log(`\n> ${command} ${args.join(" ")}`);
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: "inherit",
        shell: isWindows && command.toLowerCase().endsWith(".cmd"),
        ...options,
    });

    if (result.error) {
        throw new Error(result.error.message);
    }

    if (result.status !== 0) {
        throw new Error(`Command failed with exit code ${result.status ?? "unknown"}.`);
    }
}

function commandWorks(command, args) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: "ignore",
        shell: false,
    });
    return result.status === 0;
}

function findPython() {
    const candidates = isWindows
        ? [
            { command: "py", args: ["-3", "--version"], prefix: ["-3"] },
            { command: "python", args: ["--version"], prefix: [] },
        ]
        : [
            { command: "python3", args: ["--version"], prefix: [] },
            { command: "python", args: ["--version"], prefix: [] },
        ];

    for (const candidate of candidates) {
        if (commandWorks(candidate.command, candidate.args)) {
            return candidate;
        }
    }

    return null;
}

function getVenvPython() {
    return resolve(
        projectRoot,
        ".venv",
        isWindows ? "Scripts" : "bin",
        isWindows ? "python.exe" : "python",
    );
}

try {
    console.log("Setting up RevCapstoneFa26...\n");

    // Install JavaScript dependencies as part of the same setup command.
    const npmCommand = isWindows ? "npm.cmd" : "npm";
    run(npmCommand, ["install", "--no-audit", "--no-fund"]);

    const python = findPython();
    if (!python) {
        throw new Error(
            "Python 3.10 or newer was not found. Install Python, then run `npm run setup` again.",
        );
    }

    const pythonVersionCheck = spawnSync(
        python.command,
        [...python.prefix, "--version"],
        { cwd: projectRoot, encoding: "utf8" },
    );
    const versionText = `${pythonVersionCheck.stdout ?? ""} ${pythonVersionCheck.stderr ?? ""}`;
    const versionMatch = versionText.match(/Python\s+(\d+)\.(\d+)/);
    if (!versionMatch || Number(versionMatch[1]) < 3 ||
        (Number(versionMatch[1]) === 3 && Number(versionMatch[2]) < 10)) {
        throw new Error(`Python 3.10 or newer is required. Detected: ${versionText.trim()}`);
    }

    const venvPython = getVenvPython();
    if (!existsSync(venvPython)) {
        run(python.command, [...python.prefix, "-m", "venv", ".venv"]);
    } else {
        console.log("Existing .venv found; reusing it.");
    }

    run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"]);
    run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"]);

    if (wantsSqlServer) {
        run(venvPython, ["-m", "pip", "install", "-r", "requirements-sqlserver.txt"]);
        console.log(
            "\nSQL Server Python dependencies installed. You must also install the Microsoft ODBC Driver 18 for SQL Server for your operating system and configure .env.",
        );
    }

    // Create the local SQLite test database from the committed schema and seed data.
    run(venvPython, ["-m", "test_database.connection"]);

    console.log("\nSetup complete.");
    console.log("Start local test mode with: npm run dev:full -- --test");
    if (!wantsSqlServer) {
        console.log("For SQL Server dependencies, run: npm run setup -- --sqlserver");
    }
} catch (error) {
    console.error(`\nSetup failed: ${error.message}`);
    process.exit(1);
}
