import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const isWindows = process.platform === "win32";
const pythonExecutable = resolve(
    projectRoot,
    ".venv",
    ...(isWindows ? ["Scripts", "python.exe"] : ["bin", "python"]),
);
const action = process.argv[2];

if (!["init", "reset", "status"].includes(action)) {
    console.error("Usage: npm run db:test:<init|reset|status>");
    process.exit(2);
}

if (!existsSync(pythonExecutable)) {
    console.error("Python environment not found. Run npm run setup first.");
    process.exit(1);
}

const result = spawnSync(
    pythonExecutable,
    ["-m", "Database.scripts.test_db_admin", action],
    {
        cwd: projectRoot,
        stdio: "inherit",
        // Select SQLite before Python imports the database package.
        env: { ...process.env, DB_TYPE: "sqlite" },
    },
);

if (result.error) {
    console.error(`Could not start database manager: ${result.error.message}`);
    process.exit(1);
}

process.exit(result.status ?? 1);
