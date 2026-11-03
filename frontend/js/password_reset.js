import { request } from "./api_client.js";

let token = new URLSearchParams(window.location.hash.slice(1)).get("token");
if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname);
}
const requestForm = document.querySelector("#request-reset");
const completeForm = document.querySelector("#complete-reset");
const status = document.querySelector("#recovery-status");
requestForm.hidden = Boolean(token);
// The request form uses inline display:grid, so apply hidden explicitly.
if (token) requestForm.style.display = "none";
completeForm.hidden = !token;

function bind(form, action) {
    const button = form.querySelector("button");
    button.disabled = false;
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (button.disabled) return;
        button.disabled = true;
        status.textContent = "";
        try {
            await action();
        } catch (error) {
            status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
}

function submit(path, payload) {
    return request(`/auth/password-reset/${path}`, {
        method: "POST", body: JSON.stringify(payload),
    }, false);
}

bind(requestForm, async () => {
    const result = await submit("request", { email: document.querySelector("#recovery-email").value.trim() });
    status.textContent = result.message;
});

bind(completeForm, async () => {
    const password = document.querySelector("#new-password").value;
    if (password !== document.querySelector("#confirm-password").value) {
        throw new Error("Passwords do not match.");
    }
    await submit("complete", { token, password });
    token = null;
    sessionStorage.removeItem("authentication_token");
    completeForm.reset();
    completeForm.hidden = true;
    status.textContent = "Password reset. Return to RevMetrix and log in with your new password.";
});
