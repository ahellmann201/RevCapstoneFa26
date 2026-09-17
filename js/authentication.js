let authToken = sessionStorage.getItem("authentication_token");

export function clearAuthToken() {
    sessionStorage.setItem("authentication_token", null);
}

export function setAuthToken(token = null) {
    authToken = token;
    sessionStorage.setItem("authentication_token", token);
}

export function getAuthToken() {
    return authToken;
}

window.clearAuthToken = clearAuthToken;
window.setAuthToken = setAuthToken;
window.getAuthToken = getAuthToken;