const API_BASE_URL = "http://127.0.0.1:8000";

export function checkResponse(response) {
    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }
}

export async function testPython() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/test`);

        checkResponse(response);

        const data = await response.json();

        console.log("Response from Python:", data);

        return data;
    } catch (error) {
        console.error("Python request failed:", error);
        throw error;
    }
}

export async function getUsername(userID) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userID}`);

        checkResponse(response);

        const user = await response.json();
        console.log(user);
        const username = user.Username;

        console.log("Username: ", username);

        return username;
    } catch (error) {
        console.error("Username fetch failed:", error);
        throw error;
    }
}

export async function getDisplayName(userID) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userID}`);

        checkResponse(response);

        const user = await response.json();
        const displayName = user.Display_Name

        console.log("Display name: ", displayName);
        return displayName;
    } catch (error) {
        console.error("Display name fetch failed", error);
        throw error;
    }
}

export async function getMainhand(userID) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userID}`);

        checkResponse(response);

        const user = await response.json();
        const mainhand = user.Main_Hand

        console.log("Mainhand: ", mainhand);
        return mainhand;
    } catch (error) {
        console.error("Mainhand fetch failed", error);
        throw error;
    }
}

export async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: email,
            password: password
        })
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.detail || "Login failed.");
    }

    return result;
}

export async function setDisplayName(displayName) {
    const userID = sessionStorage.getItem("userID");
    const response = await fetch(
        `${API_BASE_URL}/api/users/${userID}/display-name`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                value: displayName
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        console.error("API Error:", error);
        throw new Error(JSON.stringify(error.detail));
    }
    else {
        return getDisplayName(userID);
    }

    return await response.json();
}

// Expose the function for development testing.
window.testPython = testPython;
window.setDisplayName = setDisplayName;