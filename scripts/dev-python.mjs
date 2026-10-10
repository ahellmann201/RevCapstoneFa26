import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

if (!existsSync(python)) {
    console.error("Python environment not found. Run `npm run setup` first.");
    process.exit(1);
}

const child = spawn(python, [
    "-m", "uvicorn", "api.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000",
], { cwd: projectRoot, stdio: "inherit" });

child.on("error", (error) => {
    console.error(`Could not start Python API: ${error.message}`);
    process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
