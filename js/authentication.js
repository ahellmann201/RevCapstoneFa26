/** Stores and retrieves authentication tokens and exposes login/logout helpers. */
import * as Requests from "./requests.js";
import * as Cache from "./cache.js";

/** Clears the stored authentication token, reloads the page, and returns its stored value. */
export function clearAuthToken() {
    sessionStorage.setItem("authentication_token", null); //Session storage can only hold strings, so this isnt actually null
    window.location.reload();
    return sessionStorage.getItem("authentication_token");
}

/** Stores an authentication token, reloads the page, and returns its stored value.
 * @param {string|null} token
 */
export function setAuthToken(token = null) {
    sessionStorage.setItem("authentication_token", token);
    window.location.reload();
    return sessionStorage.getItem("authentication_token");
}

/** Returns the stored token, or null when absent or forceNoToken is true.
 * @param {boolean} forceNoToken
 */
export function getAuthToken(forceNoToken = false) {
    const authToken = sessionStorage.getItem("authentication_token");
    if (forceNoToken || authToken == "null") return null; //also checks for "null" string to know to return an actual null since session storage only stores strings
    return authToken;
}

/** Clears authentication and cached data, then reloads the page. */
export function logOut() {
    clearAuthToken();
    Cache.clearCache()
}

/** Checks auth token against db to verify a valid session */
//TODO: implement fully when db is connected
export function checkAuthToken(forceInvalid = false) {
    if (forceInvalid) return false;

    return true; //Just standin for now
}

window.clearAuthToken = clearAuthToken;
window.setAuthToken = setAuthToken;
window.getAuthToken = getAuthToken;
window.logOut = logOut;
