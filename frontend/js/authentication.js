import * as Cache from "./cache.js";
import * as API from "./api_client.js";

export function clearAuthToken() {
    Cache.clearCache();
    window.location.reload();
    return null;
}

export function setAuthToken(token = null) {
    if (!token) {
        return clearAuthToken();
    }

    sessionStorage.setItem("authentication_token", token);
    window.location.reload();
    return token;
}

export function getAuthToken(forceNoToken = false) {
    if (forceNoToken) return null;

    const token = sessionStorage.getItem("authentication_token");

    return token && token !== "null" ? token : null;
}

export function logOut() {
    clearAuthToken();
}

export async function checkAuthToken(forceInvalid = false) {
    if (forceInvalid || !getAuthToken()) {
        return false;
    }

    try {
        await API.getUser();
        return true;
    } catch {
        return false;
    }
}

async function completeLogin(username, password) {
    const result = await API.login(username, password);

    if (!result.access_token) {
        throw new Error("The API did not return an access token.");
    }

    const guestGame = Cache.snapshotGuestGame();
    // Clear account data while retaining the guest game being signed in to save.
    Cache.clearCache();
    Cache.restoreGuestGame(guestGame);

    sessionStorage.setItem(
        "authentication_token",
        result.access_token,
    );

    try {
        const user = await API.getUser();

        Cache.setUserID(user.User_ID);
        Cache.setUsername(user.Username);
        Cache.setDisplayName(user.Display_Name);
        Cache.setEmail(user.Email);
        Cache.setMainhand(user.Main_Hand);

        sessionStorage.setItem("canReachDatabase", "true");
    } catch (error) {
        Cache.clearCache();
        Cache.restoreGuestGame(guestGame);
        throw error;
    }

    window.location.reload();
}

export async function submitAuth(type = "login") {
    const isSignup = type === "signup";
    const popup = document.getElementById(`${type}_popup`);
    const button = popup?.querySelector(".popup_primary");

    if (button?.disabled) return;

    if (button) button.disabled = true;

    let accountCreated = false;

    try {
        const password = document.getElementById(
            `${type}_password`,
        )?.value ?? "";

        if (isSignup) {
            const username = document.getElementById(
                "signup_username",
            )?.value.trim() ?? "";

            const email = document.getElementById(
                "signup_email",
            )?.value.trim().toLowerCase() ?? "";

            const displayName = document.getElementById(
                "signup_display_name",
            )?.value.trim() ?? "";

            if (!username || !email || !password) {
                throw new Error(
                    "Enter a username, email, and password.",
                );
            }

            if (password.length < 8 || password.length > 128) {
                throw new Error(
                    "Use a password between 15 and 128 characters.",
                );
            }

            await API.createAccount(
                username,
                email,
                password,
                displayName,
            );

            accountCreated = true;
            await completeLogin(username, password);
        } else {
            // Retain the existing element ID for popup compatibility.
            const username = document.getElementById(
                "login_email",
            )?.value.trim() ?? "";

            if (!username || !password) {
                throw new Error(
                    "Enter your app username and password.",
                );
            }

            await completeLogin(username, password);
        }
    } catch (error) {
        const prefix = accountCreated
            ? "Your account was created, but login failed. Try logging in. "
            : "";

        window.alert(prefix + error.message);
    } finally {
        if (button) button.disabled = false;
    }
}

window.clearAuthToken = clearAuthToken;
window.setAuthToken = setAuthToken;
window.getAuthToken = getAuthToken;
window.logOut = logOut;
