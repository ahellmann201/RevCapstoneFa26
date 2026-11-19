import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../authentication.js", () => ({ getAuthToken: vi.fn() }));
vi.mock("../game_persistence.js", () => ({ listAll: vi.fn() }));
vi.mock("../language.js", () => ({ getLanguage: () => "en", translate: key => key }));
import { getAuthToken } from "../authentication.js";
import { listAll } from "../game_persistence.js";
vi.mock("../api_client.js", () => ({ request: vi.fn() }));
import { request } from "../api_client.js";

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    sessionStorage.clear();
    document.body.innerHTML = readFileSync("frontend/games.html", "utf8");
    document.getElementById("rename-game-dialog").showModal = vi.fn();
    document.getElementById("rename-game-dialog").close = vi.fn();
});
it("offers guest play without requesting another account's games", async () => {
    getAuthToken.mockReturnValue(null);
    await import("../games.js");
    expect(listAll).not.toHaveBeenCalled();
    expect(document.getElementById("games-status").textContent).toContain("Log in");
    expect(document.querySelector(".start-game-link").getAttribute("href")).toBe("/index.html?start_game=1");
});
it("lists saved games, including unassigned games, and filters without changing ids", async () => {
    getAuthToken.mockReturnValue("token");
    listAll.mockImplementation(async path => ({
        "/games": [{ game_id: 3, session_id: 1, game_number: 1 }, { game_id: 8, session_id: 2, game_number: 2 }],
        "/sessions": [{ session_id: 1, event_id: 5, date_time: "2026-11-12T12:00:00" }, { session_id: 2, event_id: 99 }],
        "/events": [{ event_id: 5, event_name: "Thursday League" }],
    })[path]);
    await import("../games.js");
    await vi.waitFor(() => expect(document.querySelectorAll(".saved-game-link")).toHaveLength(2));
    expect(document.querySelector(".saved-game-link").getAttribute("href")).toBe("/game.html?game_id=8");
    const search = document.getElementById("game-search");
    search.value = "Thursday";
    search.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll(".saved-game-link")).toHaveLength(1);
    expect(document.querySelector(".saved-game-link").getAttribute("href")).toBe("/game.html?game_id=3");
});
it("shows load failures without pretending the account has no games", async () => {
    getAuthToken.mockReturnValue("token");
    listAll.mockRejectedValue(new Error("Offline"));
    await import("../games.js");
    await vi.waitFor(() => expect(document.getElementById("games-status").textContent).toContain("Could not load"));
});


async function loadDeletableGame() {
    getAuthToken.mockReturnValue("token");
    listAll.mockImplementation(async path => path === "/games" ? [{ game_id: 7, session_id: 1, game_number: 1 }] : []);
    await import("../games.js");
    await vi.waitFor(() => expect(document.querySelector(".delete-game")).not.toBeNull());
    return document.querySelector(".delete-game");
}
it("deletes only the selected game after confirmation and removes its card", async () => {
    const button = await loadDeletableGame();
    expect(button.closest("a")).toBeNull();
    expect(button.getAttribute("aria-label")).toBe("Delete game #7");
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    button.click();
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(null);
    button.click();
    await vi.waitFor(() => expect(document.querySelector(".saved-game-card")).toBeNull());
    expect(request).toHaveBeenCalledExactlyOnceWith("/games/7", { method: "DELETE" });
    vi.restoreAllMocks();
});
it("keeps the game and allows retrying when deletion fails", async () => {
    const button = await loadDeletableGame();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    request.mockRejectedValue(new Error("Offline"));
    button.click();
    await vi.waitFor(() => expect(document.getElementById("games-status").textContent).toContain("Could not delete"));
    expect(document.querySelectorAll(".saved-game-card")).toHaveLength(1);
    expect(button.disabled).toBe(false);
    vi.restoreAllMocks();
});


it("saves a trimmed game nickname, displays it safely, and includes it in search", async () => {
    await loadDeletableGame();
    document.querySelector(".rename-game").click();
    expect(document.getElementById("rename-game-dialog").showModal).toHaveBeenCalledOnce();
    document.getElementById("game-nickname").value = "  Friday <practice>  ";
    request.mockResolvedValueOnce({ game_id: 7, nickname: "Friday <practice>" });
    document.getElementById("rename-game-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector(".saved-game-link h2").textContent).toBe("Friday <practice>"));
    expect(request).toHaveBeenCalledWith("/games/7/nickname", { method: "PUT", body: JSON.stringify({ nickname: "Friday <practice>" }) });
    expect(document.querySelector(".saved-game-link h2").getAttribute("translate")).toBe("no");
    expect(document.querySelector("practice")).toBeNull();
    const search = document.getElementById("game-search");
    search.value = "Friday"; search.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll(".saved-game-card")).toHaveLength(1);
});

it("retains the previous game name and leaves the dialog open on save failure", async () => {
    await loadDeletableGame();
    document.querySelector(".rename-game").click();
    document.getElementById("game-nickname").value = "League";
    request.mockRejectedValueOnce(new Error("Offline"));
    document.getElementById("rename-game-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(document.getElementById("rename-game-status").textContent).toContain("Could not save"));
    expect(document.querySelector(".saved-game-link h2").textContent).toBe("Game #7");
    expect(document.getElementById("rename-game-dialog").close).not.toHaveBeenCalled();
    expect(document.getElementById("save-game-nickname").disabled).toBe(false);
});


it("clears a nickname back to the game-number fallback", async () => {
    await loadDeletableGame();
    document.querySelector(".rename-game").click();
    document.getElementById("game-nickname").value = "  ";
    request.mockResolvedValueOnce({ game_id: 7, nickname: null });
    document.getElementById("rename-game-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(document.getElementById("rename-game-dialog").close).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith("/games/7/nickname", { method: "PUT", body: JSON.stringify({ nickname: null }) });
    expect(document.querySelector(".saved-game-link h2").textContent).toBe("Game #7");
});
