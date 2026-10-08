import { Request } from "./objects/request.js"
import { DummyAccount } from "./defaults/dummy_account.js";
import * as Cache from "./cache.js";
import * as Authentication from "./authentication.js";
/** Returns the database's mainhand value. */

export const DB_UNAVAILABLE = Symbol("Database Unavailable");

/** Provides the application's current user profile values from its data source. */
export function getMainhand(forceDatabaseUnavailableParam = false, forceInvalidSessionParam = false) {
    const request = new Request({
        operation: "get",
        resource: "mainhand",
        debug: {
            forceDatabaseUnavailable: forceDatabaseUnavailableParam,
            forceInvalidSession: forceInvalidSessionParam
        }
    });

    return sendRequest(request);
}

/** Returns the database's display name. */
export function getDisplayName(forceDatabaseUnavailableParam = false, forceInvalidSessionParam = false) {
    const request = new Request({
        operation: "get",
        resource: "displayName",
        debug: {
            forceDatabaseUnavailable: forceDatabaseUnavailableParam,
            forceInvalidSession: forceInvalidSessionParam
        }
    });

    return sendRequest(request);
}

/** Returns the database's username. */
export function getUsername(forceDatabaseUnavailableParam = false, forceInvalidSessionParam = false) {
    const request = new Request({
        operation: "get",
        resource: "username",
        debug: {
            forceDatabaseUnavailable: forceDatabaseUnavailableParam,
            forceInvalidSession: forceInvalidSessionParam
        }
    });

    return sendRequest(request);
}

//TODO: make this function actually communicate to the db. for now, it just has some dummy output
export function sendRequest(request = null) {
    testDatabaseConnection(true);
    const connected = sessionStorage.getItem("canReachDatabase") !== "false";

    if (request == null) {
        console.log("Invalid request call");
        return null;
    }

    if (request.forceDatabaseUnavailable || !connected) {
        return DB_UNAVAILABLE;
    }
    if (request.forceInvalidSession) {
        Authentication.logOut();
        return "Logged Out due to invalid auth token (debug)";
    }

    if (request.operation == "get") {
        if (request.resource == "mainhand") return DummyAccount.mainhand;
        if (request.resource == "username") return DummyAccount.username;
        if (request.resource == "displayName") return DummyAccount.displayName;
    }
}

/**
 * Checks whether the database is reachable and stores the result in
 * `sessionStorage` under `canReachDatabase`. The check is currently simulated;
 * it runs only when that session value has not been set and records `"true"`
 * or `"false"` for later requests. This function resolves without a value.
 *
 * @returns {Promise<void>} A promise that resolves after the simulated check,
 * or immediately if a connection result is already stored.
 */
export async function testDatabaseConnection(forceFail = false, testAnyway = false) {
    if (sessionStorage.getItem("canReachDatabase") === null || testAnyway) {

        const controller = new AbortController();

        //code waits 5 seconds for a valid response from db before aborting and putting "false" in session storage
        const timeout = setTimeout(() => {
            controller.abort()
        }, 5000);


        try {
            //this is a fake check, will be an actual check later. it just simulates a response that takes a second to get back
            const response = await new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (forceFail) {
                        reject();
                    } else {
                        resolve();
                    }
                }, 1000);
            });

            sessionStorage.setItem("canReachDatabase", "true");
        } catch(error) {
            sessionStorage.setItem("canReachDatabase", "false")
        }
    }

    return sessionStorage.getItem("canReachDatabase");
}

window.getMainhand = getMainhand;
window.getUsername = getUsername;
window.getDisplayName = getDisplayName;
window.testDatabaseConnection = testDatabaseConnection;
