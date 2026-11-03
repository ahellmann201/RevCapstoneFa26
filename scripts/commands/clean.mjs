import {
    existsSync,
    readdirSync,
    rmSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const generatedDirectories = [
    "dist",
    "dist-ssr",
    "coverage",
    "htmlcov",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache"
];

const excludedDirectories = new Set([
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "android",
    "ios"
]);

let removedCount = 0;

function removeDirectory(relativePath) {
    const fullPath = path.join(projectRoot, relativePath);

    if (!existsSync(fullPath)) {
        return;
    }

    rmSync(fullPath, {
        recursive: true,
        force: true
    });

    console.log(`Removed: ${relativePath}`);
    removedCount++;
}

function removePythonCaches(directory, relativeDirectory = "") {
    if (!existsSync(directory)) {
        return;
    }

    let entries;

    try {
        entries = readdirSync(directory, {
            withFileTypes: true
        });
    } catch (error) {
        console.warn(
            `Could not inspect ${relativeDirectory || "."}: ${error.message}`
        );
        return;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const relativePath = path.join(relativeDirectory, entry.name);
        const fullPath = path.join(directory, entry.name);

        if (excludedDirectories.has(entry.name)) {
            continue;
        }

        if (entry.name === "__pycache__") {
            rmSync(fullPath, {
                recursive: true,
                force: true
            });

            console.log(`Removed: ${relativePath}`);
            removedCount++;
            continue;
        }

        removePythonCaches(fullPath, relativePath);
    }
}

console.log("Cleaning generated files...\n");

for (const directory of generatedDirectories) {
    removeDirectory(directory);
}

removePythonCaches(projectRoot);

console.log(
    `\nCleanup complete. Removed ${removedCount} generated director${
        removedCount === 1 ? "y" : "ies"
    }.`
);

console.log(
    "Source files, dependencies, virtual environments, and local databases were preserved."
);