import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../database.js", () => ({ request: vi.fn() }));
import { request } from "../database.js";

function resetPage(token = null) {
    history.replaceState(null, "", "/reset_password.html");
    if (token) window.location.hash = `token=${encodeURIComponent(token)}`;
    document.body.innerHTML = `
        <form id="request-reset" style="display:grid">
            <input id="recovery-email"><button type="submit">Send reset link</button>
        </form>
        <form id="complete-reset">
            <input id="new-password"><input id="confirm-password"><button type="submit">Reset password</button>
        </form>
        <p id="recovery-status" role="status"></p>`;
}

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    sessionStorage.clear();
    resetPage();
});

it("requests a reset link with a trimmed email and reports the server message", async () => {
    request.mockResolvedValue({ message: "Check your email for a reset link." });
    await import("../password_reset.js");
    const form = document.getElementById("request-reset");
    document.getElementById("recovery-email").value = "  bowler@example.com  ";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(document.getElementById("recovery-status").textContent).toBe("Check your email for a reset link."));
    expect(request).toHaveBeenCalledWith("/auth/password-reset/request", {
        method: "POST", body: JSON.stringify({ email: "bowler@example.com" }),
    }, false);
    expect(form.querySelector("button").disabled).toBe(false);
});

it("shows request failures and re-enables the request button for retry", async () => {
    request.mockRejectedValue(new Error("Service unavailable"));
    await import("../password_reset.js");
    const form = document.getElementById("request-reset");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(document.getElementById("recovery-status").textContent).toBe("Service unavailable"));
    expect(form.querySelector("button").disabled).toBe(false);
});

it("shows the completion form for a token and rejects mismatched passwords locally", async () => {
    resetPage("secret-token");
    await import("../password_reset.js");
    const requestForm = document.getElementById("request-reset");
    const completeForm = document.getElementById("complete-reset");
    expect(requestForm.hidden).toBe(true);
    expect(requestForm.style.display).toBe("none");
    expect(completeForm.hidden).toBe(false);
    expect(window.location.hash).toBe("");

    document.getElementById("new-password").value = "long-password";
    document.getElementById("confirm-password").value = "different-password";
    completeForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.getElementById("recovery-status").textContent).toBe("Passwords do not match."));
    expect(request).not.toHaveBeenCalled();
    expect(completeForm.hidden).toBe(false);
});

it("completes a reset, clears the stored token, and resets the form", async () => {
    resetPage("secret-token");
    sessionStorage.setItem("authentication_token", "old-token");
    request.mockResolvedValue({});
    await import("../password_reset.js");
    const form = document.getElementById("complete-reset");
    document.getElementById("new-password").value = "new-password";
    document.getElementById("confirm-password").value = "new-password";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(form.hidden).toBe(true));
    expect(request).toHaveBeenCalledWith("/auth/password-reset/complete", {
        method: "POST", body: JSON.stringify({ token: "secret-token", password: "new-password" }),
    }, false);
    expect(sessionStorage.getItem("authentication_token")).toBeNull();
    expect(form.querySelector("#new-password").value).toBe("");
    expect(document.getElementById("recovery-status").textContent).toContain("log in with your new password");
});

it("keeps the reset form available after a server error", async () => {
    resetPage("secret-token");
    request.mockRejectedValue(new Error("Token expired"));
    await import("../password_reset.js");
    const form = document.getElementById("complete-reset");
    document.getElementById("new-password").value = "new-password";
    document.getElementById("confirm-password").value = "new-password";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(document.getElementById("recovery-status").textContent).toBe("Token expired"));
    expect(form.hidden).toBe(false);
    expect(form.querySelector("button").disabled).toBe(false);
});
