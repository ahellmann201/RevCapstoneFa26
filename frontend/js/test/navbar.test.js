import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../theme.js", () => ({}));
vi.mock("../api_client.js", () => ({}));
vi.mock("../language.js", () => ({ initializeLanguage: vi.fn(), syncAccountLanguage: vi.fn() }));
vi.mock("../authentication.js", () => ({
    clearAuthToken: vi.fn(), getAuthToken: () => null, logOut: vi.fn(), setAuthToken: vi.fn(),
}));
vi.mock("../data_handling.js", () => ({ addPfpToContainer: vi.fn() }));
vi.mock("../popups.js", () => ({
    createAuthPopup: vi.fn(), openAuthPopup: vi.fn(), createLogoutPopup: vi.fn(), showLogOutPopup: vi.fn(),
}));
vi.mock("../reconnect.js", () => ({ retryConnection: vi.fn() }));
import { loadNavbar, openSidebar } from "../navbar.js";

let media;
beforeEach(() => {
    document.body.className = "";
    document.body.innerHTML = "<navbar></navbar><main>Content</main>";
    media = { matches: false, addEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => media);
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

it("opens the mobile drawer and closes it with Escape or its backdrop", () => {
    loadNavbar();
    const sidebar = document.getElementById("sidebar");
    const toggle = document.getElementById("hamburger-button");
    expect(sidebar.inert).toBe(true);
    toggle.click();
    expect(sidebar.inert).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("sidebar-backdrop").hidden).toBe(false);
    document.getElementById("close-sidebar-button").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(sidebar.inert).toBe(true);
    expect(document.activeElement).toBe(toggle);
    openSidebar();
    document.getElementById("sidebar-backdrop").click();
    expect(document.body.classList.contains("navigation-open")).toBe(false);
});

it("keeps desktop navigation accessible and resets the drawer on resize", () => {
    media.matches = true;
    loadNavbar();
    expect(document.getElementById("sidebar").inert).toBe(false);
    expect(document.getElementById("sidebar-backdrop").hidden).toBe(true);
    media.matches = false;
    media.addEventListener.mock.calls[0][1]();
    expect(document.getElementById("sidebar").inert).toBe(true);
    expect(document.body.classList.contains("navigation-open")).toBe(false);
});

it("marks the active page and keeps keyboard focus inside the open mobile drawer", () => {
    window.history.replaceState(null, "", "/events.html");
    loadNavbar();
    expect(document.getElementById("events-button").getAttribute("aria-current")).toBe("page");
    openSidebar();
    document.getElementById("sidebar-login-button").focus();
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement.id).toBe("close-sidebar-button");
});

it("shows working destinations and marks game screens under Games", () => {
    window.history.replaceState(null, "", "/game.html");
    loadNavbar();
    expect(document.getElementById("games-button").getAttribute("aria-current")).toBe("page");
    expect(document.getElementById("start-game-nav-button")).not.toBeNull();
    for (const id of ["sessions-button", "ciclops-button", "smart-button", "smart-watch-button"]) {
        expect(document.getElementById(id)).toBeNull();
    }
});
