import * as Cache from "./cache.js";
import * as API from "./api_client.js";
import { GuestAccount } from "./defaults/guest_account.js";

// Use a Symbol so callers can distinguish an unavailable backend from valid
// values such as null, an empty string, or false.
export const DB_UNAVAILABLE = Symbol("Database Unavailable");

// Keep API access behind this module. Page code uses these database functions,
// while api_client.js owns HTTP details and response handling.
export function request(path, options = {}, authenticated = true) {
    return API.request(path, options, authenticated);
}

export function checkResponse(response) {
    return API.checkResponse(response);
}

export function testPython() {
    return API.testPython();
}

export function getUser(userID) {
    // The backend identifies the account from the bearer token; it ignores the
    // legacy user ID argument. Passing it through keeps the API signature stable.
    return API.getUser(userID);
}

export function login(username, password) {
    return API.login(username, password);
}

export function createAccount(username, email, password, displayName = "", mainLanguage = "en") {
    return API.createAccount(username, email, password, displayName, mainLanguage);
}

function getUserID() {
    const userID = sessionStorage.getItem("userID");
    if (userID == null) throw new Error("No signed-in user is available.");
    return userID;
}

function hasAuthToken() {
    const token = sessionStorage.getItem("authentication_token");
    return Boolean(token && token !== "null");
}

// The connectivity flag is a session-level shortcut. Network failures still
// propagate from api_client.js, where the shared HTTP response handling lives.
function isUnavailable(forceDatabaseUnavailable = false) {
    return forceDatabaseUnavailable || sessionStorage.getItem("canReachDatabase") === "false";
}

// Keep profile lookup policy here: reject known-unavailable requests, apply
// debug-only invalid-session behavior, then let the API client perform HTTP.
async function readProfileValue(read, forceDatabaseUnavailable, forceInvalidSession) {
    if (isUnavailable(forceDatabaseUnavailable)) return DB_UNAVAILABLE;
    if (forceInvalidSession) {
        Cache.clearCache();
        window.location.reload();
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

export function getBalls(
    forceDatabaseUnavailable = false,
    forceInvalidSession = false,
    filters = {},
) {
    return readProfileValue(
        (userID) => API.getBalls(userID, filters),
        forceDatabaseUnavailable,
        forceInvalidSession,
    );
}

export async function createBall(ball) {
    if (isUnavailable()) return DB_UNAVAILABLE;
    return API.createBall(getUserID(), ball);
}

export async function deleteBall(ballID) {
    if (isUnavailable()) return DB_UNAVAILABLE;
    return API.deleteBall(getUserID(), ballID);
}

export async function setDisplayName(displayName) {
    if (isUnavailable()) return DB_UNAVAILABLE;
    // Await the write so true means the server accepted it; otherwise the
    // caller could report success before the database update completes.
    await API.setDisplayName(getUserID(), displayName);
    return true;
}

export function setLanguage(language) {
    return request("/auth/me/language", {
        method: "PUT",
        body: JSON.stringify({ main_language: language }),
    });
}

/** Returns the signed-in user's username, falling back to the guest username or cache. */
export async function getCachedUsername() {
    if (!hasAuthToken()) return GuestAccount.username;
    try {
        const username = await getUsername();
        if (username === DB_UNAVAILABLE) return Cache.getUsername();
        Cache.setUsername(username);
        return username;
    } catch {
        return Cache.getUsername();
    }
}

/** Returns the signed-in user's display name, falling back to username or cached data. */
export async function getCachedDisplayName() {
    if (!hasAuthToken()) return GuestAccount.username;
    try {
        const displayName = await getDisplayName();
        if (displayName === DB_UNAVAILABLE) return Cache.getDisplayName() ?? getCachedUsername();
        if (displayName == null) return getCachedUsername();
        Cache.setDisplayName(displayName);
        return displayName;
    } catch {
        return Cache.getDisplayName() ?? getCachedUsername();
    }
}

/** Returns the signed-in user's display name, or null when unavailable. */
export async function getCachedDisplayNameBlank() {
    if (!hasAuthToken()) return null;
    try {
        const displayName = await getDisplayName();
        if (displayName === DB_UNAVAILABLE) return Cache.getDisplayName();
        if (displayName == null) return null;
        Cache.setDisplayName(displayName);
        return displayName;
    } catch {
        return Cache.getDisplayName();
    }
}

/** Returns the signed-in user's mainhand, falling back to the guest setting or cache. */
export async function getCachedMainhand() {
    if (!hasAuthToken()) return GuestAccount.mainhand;
    try {
        const mainhand = await getMainhand();
        if (mainhand === DB_UNAVAILABLE) return Cache.getMainhand();
        Cache.setMainhand(mainhand);
        return mainhand;
    } catch {
        return Cache.getMainhand();
    }
}

/** Returns the signed-in user's balls, or an empty list when unavailable. */
export async function getCachedBalls(filters = {}) {
    if (!hasAuthToken()) return [];
    const balls = await getBalls(false, false, filters);
    return balls === DB_UNAVAILABLE ? [] : balls;
}

/** Creates a ball for the signed-in user. */
export async function createBallForCurrentUser(ball) {
    if (!hasAuthToken()) throw new Error("Please log in to add a ball.");
    const createdBall = await createBall(ball);
    if (createdBall === DB_UNAVAILABLE) {
        throw new Error("The database is currently unavailable.");
    }
    return createdBall;
}

/** Deletes one of the signed-in user's balls. */
export async function deleteBallForCurrentUser(ballID) {
    if (!hasAuthToken()) throw new Error("Please log in to delete a ball.");
    const result = await deleteBall(ballID);
    if (result === DB_UNAVAILABLE) {
        throw new Error("The database is currently unavailable.");
    }
    return result;
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
window.requestUsername = getCachedUsername;
window.requestBalls = getCachedBalls;
