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
    if (request == null) {
        console.log("Invalid request call");
        return null;
    }

    if (request.forceDatabaseUnavailable) {
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

window.getMainhand = getMainhand;
window.getUsername = getUsername;
window.getDisplayName = getDisplayName;