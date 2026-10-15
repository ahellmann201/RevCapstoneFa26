import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
);

const isWindows = process.platform === "win32";

const pythonExecutable = resolve(
    projectRoot,
    ".venv",
    ...(isWindows
        ? ["Scripts", "python.exe"]
        : ["bin", "python"]),
);

const vitestCli = resolve(
    projectRoot,
    "node_modules",
    "vitest",
    "vitest.mjs",
);

const testType = process.argv[2];
const extraArgs = process.argv.slice(3);

function fail(message) {
    console.error(`\nTest Error: ${message}\n`);
    process.exitCode = 1;
}

function runProcess(command, args, name) {
    return new Promise((resolvePromise) => {
        console.log(`\n========================================`);
        console.log(`Running ${name}`);
        console.log(`========================================\n`);

        const child = spawn(command, args, {
            cwd: projectRoot,
            env: process.env,
            stdio: "inherit",
        });

        child.once("error", (error) => {
            console.error(`Failed to start ${name}: ${error.message}`);
            resolvePromise(1);
        });

        child.once("exit", (code, signal) => {
            if (signal) {
                console.error(`${name} terminated with signal ${signal}.`);
                resolvePromise(1);
                return;
            }

            resolvePromise(code ?? 1);
        });
    });
}

async function runJavaScriptTests() {
    if (!existsSync(vitestCli)) {
        console.error(
            "Vitest was not found. Run `npm run cap -- setup` first.",
        );
        return 1;
    }

    return runProcess(
        process.execPath,
        [vitestCli, "run", ...extraArgs],
        "JavaScript/TypeScript tests",
    );
}

async function runPythonTests() {
    if (!existsSync(pythonExecutable)) {
        console.error(
            "The Python virtual environment was not found. " +
            "Run `npm run cap -- setup` first.",
        );
        return 1;
    }

    const result = await runProcess(
        pythonExecutable,
        ["-m", "pytest", ...extraArgs],
        "Python tests",
    );

    return result;
}

async function main() {
    if (!["js", "python", "all"].includes(testType)) {
        console.error(`
Usage:
  npm run cap -- test js
  npm run cap -- test python
  npm run cap -- test all
`);
        process.exitCode = 1;
        return;
    }

    if (testType === "js") {
        process.exitCode = await runJavaScriptTests();
        return;
    }

    if (testType === "python") {
        process.exitCode = await runPythonTests();
        return;
    }

    const jsResult = await runJavaScriptTests();

    if (jsResult !== 0) {
        console.error(
            "\nJavaScript tests failed. Python tests will still run.\n",
        );
    }

    const pythonResult = await runPythonTests();

    if (jsResult !== 0 || pythonResult !== 0) {
        console.error("\nOne or more test suites failed.");
        process.exitCode = 1;
        return;
    }

    console.log("\nAll test suites passed.");
    process.exitCode = 0;
}

main().catch((error) => {
    console.error(`Unexpected test runner error: ${error.message}`);
    process.exitCode = 1;
});