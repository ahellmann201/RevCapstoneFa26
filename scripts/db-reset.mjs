import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const python = resolve(
    projectRoot,
    ".venv",
    isWindows ? "Scripts" : "bin",
    isWindows ? "python.exe" : "python",
);
const database = resolve(projectRoot, "test_database", "capstone_test.db");

if (!existsSync(python)) {
    console.error("Python environment not found. Run `npm run setup` first.");
    process.exit(1);
}

rmSync(database, { force: true });
const result = spawnSync(python, ["-m", "test_database.connection"], {
    cwd: projectRoot,
    stdio: "inherit",
});

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}
process.exit(result.status ?? 1);
