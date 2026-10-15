import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
);

const typeScriptCli = resolve(
    projectRoot,
    "node_modules",
    "typescript",
    "bin",
    "tsc",
);

const viteCli = resolve(
    projectRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
);

function fail(message) {
    console.error(`\nBuild Error: ${message}\n`);
    process.exitCode = 1;
}

function runCommand(command, args, name) {
    return new Promise((resolvePromise) => {
        console.log(`\n> ${name}\n`);

        const child = spawn(command, args, {
            cwd: projectRoot,
            env: process.env,
            stdio: "inherit",
        });

        child.once("error", (error) => {
            console.error(
                `Failed to start ${name}: ${error.message}`,
            );

            resolvePromise(1);
        });

        child.once("exit", (code, signal) => {
            if (signal) {
                console.error(
                    `${name} terminated with signal ${signal}.`,
                );

                resolvePromise(1);
                return;
            }

            resolvePromise(code ?? 1);
        });
    });
}

async function main() {
    if (!existsSync(typeScriptCli)) {
        fail(
            "TypeScript is not installed.\n" +
            "Run `npm run cap -- setup` first.",
        );
        return;
    }

    if (!existsSync(viteCli)) {
        fail(
            "Vite is not installed.\n" +
            "Run `npm run cap -- setup` first.",
        );
        return;
    }

    console.log("========================================");
    console.log(" RevCapstone Production Build");
    console.log("========================================");

    console.log("\nStep 1: Checking TypeScript...");

    const typeCheckResult = await runCommand(
        process.execPath,
        [typeScriptCli],
        "TypeScript compiler",
    );

    if (typeCheckResult !== 0) {
        fail(
            "TypeScript checking failed. " +
            "Fix the reported errors before building.",
        );
        return;
    }

    console.log("\nStep 2: Building the frontend...");

    const buildResult = await runCommand(
        process.execPath,
        [viteCli, "build"],
        "Vite production build",
    );

    if (buildResult !== 0) {
        fail("The Vite production build failed.");
        return;
    }

    console.log("\nBuild completed successfully.");
    console.log("Production files are available in dist/.");
}

main().catch((error) => {
    fail(error.message);
});