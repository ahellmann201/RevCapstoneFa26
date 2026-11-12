import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../authentication.js", () => ({ getAuthToken: vi.fn() }));
vi.mock("../game_persistence.js", () => ({ listAll: vi.fn() }));
vi.mock("../language.js", () => ({ getLanguage: () => "en" }));
import { getAuthToken } from "../authentication.js";
import { listAll } from "../game_persistence.js";

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    sessionStorage.clear();
    document.body.innerHTML = readFileSync("frontend/games.html", "utf8");
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
