const API_BASE_URL = `http://${window.location.hostname}:8000`;

// All HTTP calls share response parsing and error conversion here. Returning
// parsed data keeps endpoint methods small, and throwing on non-2xx responses
// lets the request layer decide whether to show cached data or report failure.
async function request(path, options) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
        const detail = data?.detail;
        const message = Array.isArray(detail)
            ? detail.map((issue) => {
                const field = Array.isArray(issue.loc)
                    ? issue.loc.filter((part) => part !== "body").join(".")
                    : "request";
                return `${field}: ${issue.msg ?? "Invalid value"}`;
            }).join("; ")
            : typeof detail === "string"
                ? detail
                : `HTTP error: ${response.status}`;

        throw new Error(message);
    }

    return data;
}

export function checkResponse(response) {
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
}

export function testPython() {
    return request("/api/test");
}

export function getUser(userID) {
    // The backend returns the profile as one record, so the field-specific
    // methods below reuse this endpoint rather than issuing separate queries.
    return request(`/api/users/${encodeURIComponent(userID)}`);
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

export function setDisplayName(userID, displayName) {
    // Match the API's PUT contract and JSON body shape for profile updates.
    return request(`/api/users/${encodeURIComponent(userID)}/display-name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: displayName })
    });
}

export function login(email, password) {
    return request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
}

export function createAccount(name, email, password) {
    return request("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
    });
}

window.testPython = testPython;
window.setDisplayName = (displayName) =>
    setDisplayName(sessionStorage.getItem("userID"), displayName);
