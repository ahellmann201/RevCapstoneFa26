import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

const isWindows = process.platform === "win32";

const commands = {
    frontend: {
        description: "Start the Vite frontend.",
        script: "scripts/commands/frontend.mjs",
    },

    api: {
        description: "Start the Python HTTP API.",
        script: "scripts/commands/api.mjs",
    },

    dev: {
        description: "Start the frontend and Python API.",
        script: "scripts/commands/dev.mjs",
    },

    "test-app": {
        description: "Start the frontend, API, and SQLite test database configuration.",
        script: "scripts/commands/test-app.mjs",
    },

    remote: {
        description: "Start the frontend and API configured for SQL Server.",
        script: "scripts/commands/remote.mjs",
    },

    "remote-rollback": {
        description: "Launch the future database rollback mode placeholder.",
        script: "scripts/commands/remote-rollback.mjs",
    },

    setup: {
        description: "Check dependencies and prepare the development environment.",
        script: "scripts/setup.mjs",
    },

    build: {
        description: "Type-check and build the frontend.",
        script: "scripts/commands/build.mjs",
    },

    status: {
        description: "Display development environment and dependency status.",
        script: "scripts/commands/status.mjs",
    },

    clean: {
        description: "Remove generated build artifacts and caches.",
        script: "scripts/commands/clean.mjs",
    },

    "api-check": {
        description: "Check whether the Python API is responding.",
        script: "scripts/commands/api-check.mjs",
    },
};

const databaseCommands = {
    init: "Initialize the local SQLite test database.",
    reset: "Delete and recreate the local SQLite test database.",
    check: "Check the configured database connection.",
};

const testCommands = {
    js: "Run JavaScript and TypeScript tests.",
    python: "Run Python tests.",
    all: "Run both JavaScript and Python tests.",
};

function printHelp() {
    console.log(`
RevCapstone Development CLI

Usage:
  npm run cap -- <command> [arguments]

APPLICATION
  frontend             ${commands.frontend.description}
  api                  ${commands.api.description}
  dev                  ${commands.dev.description}
  test-app             ${commands["test-app"].description}
  remote               ${commands.remote.description}
  remote-rollback      ${commands["remote-rollback"].description}

TESTING
  test js              ${testCommands.js}
  test python          ${testCommands.python}
  test all             ${testCommands.all}

DATABASE
  db init              ${databaseCommands.init}
  db reset             ${databaseCommands.reset}
  db check             ${databaseCommands.check}

PROJECT
  setup                ${commands.setup.description}
  build                ${commands.build.description}
  status               ${commands.status.description}
  clean                ${commands.clean.description}
  api-check            ${commands["api-check"].description}

GENERAL
  help                 Display this help message.

Examples:
  npm run cap -- setup
  npm run cap -- frontend
  npm run cap -- api
  npm run cap -- dev
  npm run cap -- test-app
  npm run cap -- test js
  npm run cap -- test python
  npm run cap -- test all
  npm run cap -- db init
  npm run cap -- db reset
  npm run cap -- remote
  npm run cap -- remote-rollback
  npm run cap -- build
`);
}

function fail(message) {
    console.error(`\nError: ${message}\n`);
    process.exitCode = 1;
}

function runScript(relativePath, args = []) {
    const scriptPath = resolve(projectRoot, relativePath);

    if (!existsSync(scriptPath)) {
        fail(
            `Command implementation not found: ${relativePath}\n` +
            "This command will become available once its module is added.",
        );
        return;
    }

    console.log(`\n> ${relativePath}${args.length ? ` ${args.join(" ")}` : ""}\n`);

    const child = spawn(
        process.execPath,
        [scriptPath, ...args],
        {
            cwd: projectRoot,
            stdio: "inherit",
            env: process.env,
        },
    );

    let shuttingDown = false;

    function stopChild(signal = "SIGTERM") {
        if (shuttingDown) return;

        shuttingDown = true;

        if (child.exitCode === null && !child.killed) {
            child.kill(signal);
        }
    }

    const handleSigint = () => stopChild("SIGINT");
    const handleSigterm = () => stopChild("SIGTERM");

    process.once("SIGINT", handleSigint);
    process.once("SIGTERM", handleSigterm);

    child.on("error", (error) => {
        console.error(`\nFailed to start command: ${error.message}`);
        process.exitCode = 1;
    });

    child.on("exit", (code, signal) => {
        process.removeListener("SIGINT", handleSigint);
        process.removeListener("SIGTERM", handleSigterm);

        if (signal && !shuttingDown) {
            console.error(`\nCommand terminated by signal ${signal}.`);
            process.exitCode = 1;
            return;
        }

        if (code !== null) {
            process.exitCode = code;
        } else if (shuttingDown) {
            process.exitCode = 0;
        } else {
            process.exitCode = 1;
        }
    });
}

function main() {
    const args = process.argv.slice(2);
    const [category, ...remainingArgs] = args;

    if (!category || category === "help" || category === "--help" || category === "-h") {
        printHelp();
        return;
    }

    if (category === "test") {
        const [testType, ...extraArgs] = remainingArgs;

        if (!testType || testType === "help") {
            console.log(`
Usage:
  npm run cap -- test js
  npm run cap -- test python
  npm run cap -- test all
`);
            return;
        }

        if (!(testType in testCommands)) {
            fail(
                `Unknown test type "${testType}". ` +
                "Supported types: js, python, all.",
            );
            return;
        }

        runScript("scripts/commands/test.mjs", [
            testType,
            ...extraArgs,
        ]);

        return;
    }

    if (category === "db") {
        const [databaseAction, ...extraArgs] = remainingArgs;

        if (!databaseAction || databaseAction === "help") {
            console.log(`
Usage:
  npm run cap -- db init
  npm run cap -- db reset
  npm run cap -- db check
`);
            return;
        }

        if (!(databaseAction in databaseCommands)) {
            fail(
                `Unknown database action "${databaseAction}". ` +
                "Supported actions: init, reset, check.",
            );
            return;
        }

        runScript("scripts/commands/database.mjs", [
            databaseAction,
            ...extraArgs,
        ]);

        return;
    }

    const command = commands[category];

    if (!command) {
        fail(
            `Unknown command "${category}". ` +
            'Run "npm run cap -- help" to see available commands.',
        );
        return;
    }

    runScript(command.script, remainingArgs);
}

main();