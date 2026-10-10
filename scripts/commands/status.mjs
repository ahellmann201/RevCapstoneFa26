import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
);

const isWindows = process.platform === "win32";

const paths = {
    packageJson: resolve(projectRoot, "package.json"),
    packageLock: resolve(projectRoot, "package-lock.json"),
    requirements: resolve(projectRoot, "requirements.txt"),
    requirementsDev: resolve(projectRoot, "requirements-dev.txt"),
    environment: resolve(projectRoot, ".env"),
    testEnvironment: resolve(projectRoot, ".env.test"),
    environmentExample: resolve(projectRoot, ".env.example"),
    pythonEnvironment: resolve(projectRoot, ".venv"),
    pythonExecutable: resolve(
        projectRoot,
        ".venv",
        ...(isWindows
            ? ["Scripts", "python.exe"]
            : ["bin", "python"]),
    ),
    nodeModules: resolve(projectRoot, "node_modules"),
    vite: resolve(projectRoot, "node_modules", "vite"),
    vitest: resolve(projectRoot, "node_modules", "vitest"),
    typescript: resolve(projectRoot, "node_modules", "typescript"),
    api: resolve(projectRoot, "api", "main.py"),
    testDatabase: resolve(
        projectRoot,
        "test_database",
        "capstone_test.db",
    ),
    databaseSchema: resolve(
        projectRoot,
        "test_database",
        "schema.sql",
    ),
    databaseSeed: resolve(
        projectRoot,
        "test_database",
        "seed.sql",
    ),
};

let warningCount = 0;
let failureCount = 0;

function printSection(title) {
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
}

function printStatus(label, status, details = "") {
    const symbols = {
        ok: "[OK]",
        warning: "[WARN]",
        error: "[MISSING]",
        info: "[INFO]",
    };

    console.log(
        `${symbols[status]} ${label}${details ? ` — ${details}` : ""}`,
    );

    if (status === "warning") warningCount++;
    if (status === "error") failureCount++;
}

function checkFile(label, path, required = true) {
    const found = existsSync(path);

    if (found) {
        printStatus(label, "ok", path.replace(projectRoot, "."));
    } else {
        printStatus(
            label,
            required ? "error" : "warning",
            required ? "Required file not found" : "Not configured",
        );
    }

    return found;
}

function checkDirectory(label, path) {
    const found = existsSync(path);

    printStatus(
        label,
        found ? "ok" : "warning",
        found ? "Available" : "Not installed",
    );

    return found;
}

function getPythonVersion() {
    if (!existsSync(paths.pythonExecutable)) {
        return null;
    }

    const result = spawnSync(
        paths.pythonExecutable,
        ["--version"],
        {
            cwd: projectRoot,
            encoding: "utf8",
            timeout: 5000,
        },
    );

    if (result.error || result.status !== 0) {
        return null;
    }

    return (result.stdout || result.stderr).trim();
}

function checkPackageJson() {
    if (!existsSync(paths.packageJson)) {
        printStatus("package.json", "error", "Missing");
        return null;
    }

    try {
        const packageJson = JSON.parse(
            readFileSync(paths.packageJson, "utf8"),
        );

        printStatus(
            "package.json",
            "ok",
            packageJson.name || "Project package",
        );

        return packageJson;
    } catch (error) {
        printStatus(
            "package.json",
            "error",
            `Invalid JSON: ${error.message}`,
        );

        return null;
    }
}

function checkEnvironmentFiles() {
    const hasExample = existsSync(paths.environmentExample);
    const hasDevelopment = existsSync(paths.environment);
    const hasTest = existsSync(paths.testEnvironment);

    printStatus(
        ".env.example",
        hasExample ? "ok" : "warning",
        hasExample ? "Example configuration exists" : "Recommended for team setup",
    );

    printStatus(
        ".env",
        hasDevelopment ? "ok" : "warning",
        hasDevelopment
            ? "Local development configuration exists"
            : "Remote database mode may not be configured",
    );

    printStatus(
        ".env.test",
        hasTest ? "ok" : "warning",
        hasTest
            ? "Test configuration exists"
            : "Test mode may need configuration",
    );
}

function checkNodeVersion() {
    const version = process.version;
    const major = Number(version.slice(1).split(".")[0]);

    printStatus(
        "Node.js",
        major >= 20 ? "ok" : "warning",
        version,
    );
}

function checkPackageLock() {
    checkFile("package-lock.json", paths.packageLock);
}

function checkPython() {
    const version = getPythonVersion();

    if (version) {
        printStatus("Project Python environment", "ok", version);
    } else {
        printStatus(
            "Project Python environment",
            "warning",
            "Run `npm run cap -- setup` to create or repair it",
        );
    }

    const pythonRequirementsExist =
        existsSync(paths.requirements) ||
        existsSync(paths.requirementsDev);

    printStatus(
        "Python dependency manifests",
        pythonRequirementsExist ? "ok" : "warning",
        pythonRequirementsExist
            ? "At least one requirements file exists"
            : "No requirements files found",
    );
}

function checkNpmDependencies(packageJson) {
    checkDirectory("node_modules", paths.nodeModules);

    if (!existsSync(paths.nodeModules)) return;

    checkDirectory("Vite", paths.vite);
    checkDirectory("Vitest", paths.vitest);
    checkDirectory("TypeScript", paths.typescript);

    if (!packageJson) return;

    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };

    for (const packageName of [
        "vite",
        "vitest",
        "typescript",
    ]) {
        if (!dependencies[packageName]) {
            printStatus(
                `${packageName} declaration`,
                "warning",
                "Package is not declared in package.json",
            );
        }
    }
}

function checkDatabase() {
    checkFile("Database schema", paths.databaseSchema);
    checkFile("Database seed file", paths.databaseSeed);

    const databaseExists = existsSync(paths.testDatabase);

    printStatus(
        "Local SQLite database",
        databaseExists ? "ok" : "warning",
        databaseExists
            ? "Database file exists"
            : "Run `npm run cap -- db init` to create it",
    );
}

function checkApi() {
    checkFile("Python API entry point", paths.api);
}

function main() {
    console.log("========================================");
    console.log(" RevCapstone Environment Status");
    console.log("========================================");

    printSection("Runtime");

    checkNodeVersion();
    checkPackageLock();

    const packageJson = checkPackageJson();

    printSection("JavaScript Dependencies");

    checkNpmDependencies(packageJson);

    printSection("Python Environment");

    checkPython();

    printSection("Application");

    checkApi();

    printSection("Database");

    checkDatabase();

    printSection("Environment Configuration");

    checkEnvironmentFiles();

    printSection("Summary");

    console.log(`Warnings: ${warningCount}`);
    console.log(`Missing or invalid required items: ${failureCount}`);

    if (failureCount > 0) {
        console.log(
            "\nSome required files are missing. Review the messages above.",
        );
    } else if (warningCount > 0) {
        console.log(
            "\nThe project has warnings that may need attention before use.",
        );
    } else {
        console.log("\nThe basic project structure looks good.");
    }

    console.log(
        "\nNote: this command checks local files and installed tools. " +
        "It does not verify package version compatibility or database connectivity.",
    );
}

main();