import * as Authentication from "./authentication.js";
import * as API from "./api_client.js";

// Use a Symbol so callers can distinguish an unavailable backend from valid
// values such as null, an empty string, or false.
export const DB_UNAVAILABLE = Symbol("Database Unavailable");

// The connectivity flag is a session-level shortcut. Network failures still
// propagate from api_client.js, where the shared HTTP response handling lives.
function isUnavailable(forceDatabaseUnavailable = false) {
    return forceDatabaseUnavailable || sessionStorage.getItem("canReachDatabase") === "false";
}

function getUserID() {
    const userID = sessionStorage.getItem("userID");
    if (userID == null) throw new Error("No signed-in user is available.");
    return userID;
}

// Keep profile lookup policy here: reject known-unavailable requests, apply
// debug-only invalid-session behavior, then let the API client perform HTTP.
// Passing the reader in avoids repeating this policy for each profile field.
async function readProfileValue(read, forceDatabaseUnavailable, forceInvalidSession) {
    if (isUnavailable(forceDatabaseUnavailable)) return DB_UNAVAILABLE;
    if (forceInvalidSession) {
        Authentication.logOut();
        throw new Error("Logged out due to an invalid session (debug).");
    }
    return read(getUserID());
}

export function getMainhand(forceDatabaseUnavailable = false, forceInvalidSession = false) {
    return readProfileValue(API.getMainhand, forceDatabaseUnavailable, forceInvalidSession);
}

export function getDisplayName(forceDatabaseUnavailable = false, forceInvalidSession = false) {
    return readProfileValue(API.getDisplayName, forceDatabaseUnavailable, forceInvalidSession);
}

export function getUsername(forceDatabaseUnavailable = false, forceInvalidSession = false) {
    return readProfileValue(API.getUsername, forceDatabaseUnavailable, forceInvalidSession);
}

export async function setDisplayName(displayName) {
    if (isUnavailable()) return DB_UNAVAILABLE;
    // Await the write so true means the server accepted it; otherwise the
    // caller could report success before the database update completes.
    await API.setDisplayName(getUserID(), displayName);
    return true;
}

/**
 * Stores the result of the current simulated connectivity check in session
 * storage. This is a development placeholder until the app checks the API.
 * `testAnyway` forces a refresh; otherwise an existing session result is kept.
 */
export async function testDatabaseConnection(forceFail = false, testAnyway = false) {
    if (sessionStorage.getItem("canReachDatabase") === null || testAnyway) {
        sessionStorage.setItem("canReachDatabase", forceFail ? "false" : "true");
    }
    return sessionStorage.getItem("canReachDatabase");
}

window.getMainhand = getMainhand;
window.getUsername = getUsername;
window.getDisplayName = getDisplayName;
window.testDatabaseConnection = testDatabaseConnection;
