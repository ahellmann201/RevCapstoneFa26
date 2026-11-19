import { request } from "./database.js";
import { getAuthToken } from "./authentication.js";
import { loadNavbar } from "./navbar.js";
import { bindPasswordVisibility, setPasswordVisibilityButton } from "./password_visibility.js";

loadNavbar();

const form = document.querySelector("#change-password-form");
const currentPassword = document.querySelector("#current-password");
const newPassword = document.querySelector("#new-password");
const confirmPassword = document.querySelector("#confirm-password");
const submitButton = document.querySelector("#submit-password-change");
const status = document.querySelector("#password-status");

for (const button of document.querySelectorAll(".password_visibility")) {
    const password = document.getElementById(button.getAttribute("aria-controls"));
    bindPasswordVisibility(button, password);
}

function hidePasswords() {
    for (const button of document.querySelectorAll(".password_visibility")) {
        const password = document.getElementById(button.getAttribute("aria-controls"));
        password.type = "password";
        setPasswordVisibilityButton(button, false);
    }
}

document.querySelector("#cancel-password-change").addEventListener("click", () => {
    window.location.href = "/account_settings.html";
});

if (!getAuthToken()) {
    form.hidden = true;
    status.textContent = "Please log in to change your password.";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;

    if (newPassword.value !== confirmPassword.value) {
        status.dataset.state = "error";
        status.textContent = "The new passwords do not match.";
        confirmPassword.setAttribute("aria-invalid", "true");
        confirmPassword.focus();
        return;
    }

    confirmPassword.removeAttribute("aria-invalid");
    status.removeAttribute("data-state");
    status.textContent = "";
    submitButton.disabled = true;

    try {
        const result = await request("/auth/me/password", {
            method: "PUT",
            body: JSON.stringify({
                current_password: currentPassword.value,
                new_password: newPassword.value,
            }),
        });

        if (!result?.access_token) {
            throw new Error("The password was changed, but the session could not be refreshed. Please log in again.");
        }

        sessionStorage.setItem("authentication_token", result.access_token);
        form.reset();
        hidePasswords();
        status.dataset.state = "success";
        status.textContent = "Your password has been changed.";
    } catch (error) {
        status.dataset.state = "error";
        status.textContent = error.message;
        if (!getAuthToken()) {
            form.hidden = true;
            status.textContent = "Your session expired. Please log in to change your password.";
        }
    } finally {
        submitButton.disabled = false;
    }
});
