export function clearAuthToken() {
    sessionStorage.setItem("authentication_token", null); //Session storage can only hold strings, so this isnt actually null
    window.location.reload();
    return sessionStorage.getItem("authentication_token");
}

export function setAuthToken(token = null) {
    sessionStorage.setItem("authentication_token", token);
    window.location.reload();
    return sessionStorage.getItem("authentication_token");
}

export function getAuthToken(forceNoToken = false) {
    const authToken = sessionStorage.getItem("authentication_token");
    if (forceNoToken || authToken == "null") return null; //also checks for "null" string to know to return an actual null since session storage only stores strings
    return authToken;
}

export function logOut() {
    clearAuthToken();
    window.location.reload();
}

window.clearAuthToken = clearAuthToken;
window.setAuthToken = setAuthToken;
window.getAuthToken = getAuthToken;
window.logOut = logOut;