const API_BASE_URL = "http://127.0.0.1:8000";

export async function testPython() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/test`);

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        console.log("Response from Python:", data);

        return data;
    } catch (error) {
        console.error("Python request failed:", error);
        throw error;
    }
}

// Expose the function for development testing.
window.testPython = testPython;