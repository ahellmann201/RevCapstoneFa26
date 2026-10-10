import {
    existsSync,
    readFileSync
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const args = process.argv.slice(2);
const testMode = args.includes("--test");

const urlArgument = args.find((arg) => arg.startsWith("--url="));
const apiUrl = (
    urlArgument?.slice("--url=".length) ||
    process.env.CAP_API_URL ||
    "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const environmentFile = path.join(
    projectRoot,
    testMode ? ".env.test" : ".env"
);

const pythonExecutable = path.join(
    projectRoot,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);

let failures = 0;
let warnings = 0;

function pass(message) {
    console.log(`[PASS] ${message}`);
}

function fail(message) {
    console.error(`[FAIL] ${message}`);
    failures++;
}

function warn(message) {
    console.warn(`[WARN] ${message}`);
    warnings++;
}

function checkFile(relativePath, required = true) {
    const fullPath = path.join(projectRoot, relativePath);

    if (existsSync(fullPath)) {
        pass(`${relativePath} exists`);
        return true;
    }

    if (required) {
        fail(`${relativePath} is missing`);
    } else {
        warn(`${relativePath} is missing`);
    }

    return false;
}

function runPythonCheck() {
    if (!existsSync(pythonExecutable)) {
        fail("Python virtual environment is missing. Run the setup command first.");
        return false;
    }

    const result = spawnSync(
        pythonExecutable,
        [
            "-c",
            "import fastapi, uvicorn; print('FastAPI and Uvicorn are available')"
        ],
        {
            cwd: projectRoot,
            encoding: "utf8",
            timeout: 15000
        }
    );

    if (result.error) {
        fail(`Could not run Python: ${result.error.message}`);
        return false;
    }

    if (result.status !== 0) {
        fail(
            `Required Python packages could not be imported.\n${
                result.stderr?.trim() || result.stdout?.trim() || ""
            }`
        );
        return false;
    }

    pass("Python virtual environment and required API packages are available");
    return true;
}

async function checkApiHealth() {
    const healthUrl = `${apiUrl}/api/health`;

    console.log(`\nChecking API endpoint: ${healthUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(healthUrl, {
            method: "GET",
            signal: controller.signal
        });

        if (!response.ok) {
            fail(`API returned HTTP ${response.status}`);
            return;
        }

        let body = "";

        try {
            body = await response.text();
        } catch {
            // The HTTP status is still useful if the response body is unreadable.
        }

        pass(`API responded with HTTP ${response.status}`);

        if (body) {
            console.log(`Response: ${body.slice(0, 300)}`);
        }
    } catch (error) {
        if (error.name === "AbortError") {
            fail("API did not respond within 5 seconds");
        } else {
            fail(
                `Could not reach the API: ${error.message}. ` +
                "Make sure the Python API is running."
            );
        }
    } finally {
        clearTimeout(timeout);
    }
}

async function main() {
    console.log("==================================");
    console.log("       Python API Diagnostics");
    console.log("==================================");
    console.log(`Mode: ${testMode ? "TEST (SQLite)" : "DEVELOPMENT (SQL Server)"}`);
    console.log(`Project: ${projectRoot}`);

    console.log("\n1. Checking project files");

    checkFile("api/main.py");
    checkFile("api/config.py");
    checkFile("requirements.txt", false);

    console.log("\n2. Checking Python environment");

    const pythonAvailable = runPythonCheck();

    console.log("\n3. Checking environment configuration");

    let environment = {};

    if (checkFile(testMode ? ".env.test" : ".env")) {
        try {
            environment = dotenv.parse(
                readFileSync(environmentFile, "utf8")
            );

            pass("Environment file can be read");
        } catch (error) {
            fail(`Could not read environment file: ${error.message}`);
        }
    }

    if (testMode) {
        const databasePath = path.join(
            projectRoot,
            "test_database",
            "capstone_test.db"
        );

        checkFile("test_database/schema.sql");
        checkFile("test_database/seed.sql");

        if (existsSync(databasePath)) {
            pass("Local SQLite test database exists");
        } else {
            warn(
                "Local SQLite database does not exist yet. " +
                "Initialize it with the database init command."
            );
        }
    } else {
        const requiredVariables = [
            "DB_SERVER",
            "DB_NAME",
            "DB_USER",
            "DB_PASSWORD"
        ];

        let missingVariables = [];

        for (const variable of requiredVariables) {
            const value = process.env[variable] || environment[variable];

            if (!value || !value.trim()) {
                missingVariables.push(variable);
            }
        }

        if (missingVariables.length > 0) {
            fail(
                `Missing SQL Server configuration: ${missingVariables.join(", ")}`
            );
        } else {
            pass("Required SQL Server configuration variables are present");
        }

        if (
            environment.DB_TYPE &&
            environment.DB_TYPE.toLowerCase() !== "sqlserver"
        ) {
            warn(
                `DB_TYPE in .env is "${environment.DB_TYPE}", not "sqlserver". ` +
                "Verify that the API is configured for the intended database."
            );
        }
    }

    console.log("\n4. Checking API connectivity");

    await checkApiHealth();

    console.log("\n==================================");
    console.log("             Summary");
    console.log("==================================");
    console.log(`Failures: ${failures}`);
    console.log(`Warnings: ${warnings}`);

    if (failures > 0) {
        console.error("\nAPI diagnostics found problems.");
        process.exitCode = 1;
    } else if (!pythonAvailable) {
        console.error("\nThe Python environment needs attention.");
        process.exitCode = 1;
    } else {
        console.log("\nAPI diagnostics completed.");
    }

    console.log(
        "\nNote: A successful /api/health response confirms HTTP API availability, " +
        "not necessarily a successful database connection."
    );
}

main().catch((error) => {
    console.error(`Unexpected diagnostic error: ${error.message}`);
    process.exitCode = 1;
});