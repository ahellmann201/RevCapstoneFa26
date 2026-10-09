/** Stores and retrieves authentication tokens and exposes login/logout helpers. */
import * as Requests from "./requests.js";
import * as Cache from "./cache.js";
import * as API from "./api_client.js";

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

export async function submitAuth(type = "login") {
    const isLogin = type === "login";

    if (isLogin) {
        const emailField = document.getElementById(`${type}_email`);
        const passwordField = document.getElementById(`${type}_password`);

        if (!emailField || !passwordField) return;

        const email = emailField.value.trim()
        const password = passwordField.value;

        console.log(`email: ${email}`);
        console.log(`password: ${password}`);

        if (!email || !password) {
            console.error("Invalid email or password"); //TODO: make this actual ui feedback
            return;
        }

        try {
            const result = await API.login(email, password);
            const userID = result.User_ID;
            console.log("Authenticated User ID:", userID);
            Cache.setUserID(userID);
            setAuthToken(userID); //TODO: replace with actual auth token functionality
        } catch (error) {
            console.error("Login failed:", error.message);
        }
    }
}

window.clearAuthToken = clearAuthToken;
window.setAuthToken = setAuthToken;
window.getAuthToken = getAuthToken;
window.logOut = logOut;
