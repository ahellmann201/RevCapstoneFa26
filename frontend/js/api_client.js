// Shared backend hosted on DigitalOcean.
const API_BASE_URL = "https://api.revmetrix.io";

async function request(path, options = {}, authenticated = true) {
    const headers = new Headers(options.headers);

    if (options.body !== undefined) {
        headers.set("Content-Type", "application/json");
    }

    if (authenticated) {
        const token = sessionStorage.getItem("authentication_token");

        if (!token || token === "null") {
            throw new Error("Please log in first.");
        }

        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: "omit",
    });

    const data = response.status === 204
        ? null
        : await response.json().catch(() => null);

    if (!response.ok) {
        if (response.status === 401 && authenticated) {
            sessionStorage.clear();
        }

        const detail = data?.detail;

        const message = Array.isArray(detail)
            ? detail.map((issue) => {
                const field = (issue.loc ?? [])
                    .filter((part) => part !== "body")
                    .join(".");

                return `${field}: ${issue.msg}`;
            }).join("; ")
            : typeof detail === "string"
                ? detail
                : `Request failed (${response.status}).`;

        throw new Error(message);
    }

    return data;
}

function frontendProfile(user) {
    return {
        User_ID: user.user_id,
        Username: user.username,
        Display_Name: user.display_name,
        Email: user.email,
        Main_Hand:
            user.main_hand === "L" ? "left"
            : user.main_hand === "R" ? "right"
            : "both",
    };
}

export function checkResponse(response) {
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}).`);
    }
}

export function testPython() {
    return request("/health", {}, false);
}

// Keep the existing function signature for frontend compatibility.
// The backend identifies the account from the token, not this argument.
export async function getUser(_userID) {
    return frontendProfile(await request("/auth/me"));
}

export async function getUsername(userID) {
    return (await getUser(userID)).Username;
}

export async function getDisplayName(userID) {
    return (await getUser(userID)).Display_Name;
}

export async function getMainhand(userID) {
    return (await getUser(userID)).Main_Hand;
}

export function setDisplayName(_userID, displayName) {
    return request("/auth/me/display-name", {
        method: "PUT",
        body: JSON.stringify({ value: displayName }),
    });
}

export function login(username, password) {
    return request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    }, false);
}

export function createAccount(
    username,
    email,
    password,
    displayName = "",
) {
    return request("/auth/register", {
        method: "POST",
        body: JSON.stringify({
            username,
            email,
            password,
            display_name: displayName || username,
            main_hand: null,
        }),
    }, false);
}

window.testPython = testPython;

window.setDisplayName = (displayName) =>
    setDisplayName(
        sessionStorage.getItem("userID"),
        displayName,
    );

export { request };