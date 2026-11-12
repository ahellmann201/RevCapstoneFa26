import { readFileSync } from "node:fs";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../game_persistence.js", () => ({ listAll: vi.fn() }));
vi.mock("../weekly_events.js", () => ({ loadWeeklyEvents: vi.fn() }));
vi.mock("../authentication.js", () => ({ getAuthToken: vi.fn() }));
vi.mock("../requests.js", () => ({ getDisplayName: vi.fn() }));
vi.mock("../data_handling.js", () => ({ parseDisplayName: vi.fn() }));
vi.mock("../cache.js", () => ({ getActiveGameId: vi.fn(), getGameState: vi.fn() }));
import { getActiveGameId, getGameState } from "../cache.js";
import { getAuthToken } from "../authentication.js";
import { listAll } from "../game_persistence.js";
beforeEach(() => {
    vi.resetModules(); vi.resetAllMocks(); sessionStorage.clear();
    document.body.innerHTML = readFileSync("frontend/index.html", "utf8");
    vi.stubGlobal("window", { location: { search: "", href: "/index.html" } });
    for (const dialog of document.querySelectorAll("dialog")) { dialog.showModal = vi.fn(); dialog.close = vi.fn(); }
    getActiveGameId.mockReturnValue("active"); getGameState.mockReturnValue({ currentFrame: 3 });
});
afterEach(() => vi.unstubAllGlobals());
it("offers a choice and continues without replacing existing setup", async () => {
    const { startGame } = await import("../index.js");
    await startGame();
    expect(document.getElementById("resume-game-dialog").showModal).toHaveBeenCalledOnce();
    sessionStorage.setItem("pendingGameSetup", "stale");
    document.getElementById("continue-game-choice").click();
    expect(window.location.href).toBe("/game.html");
    expect(sessionStorage.getItem("pendingGameSetup")).toBeNull();
});
it("preserves the weekly event choice when choosing a new game", async () => {
    getAuthToken.mockReturnValue("token");
    listAll.mockImplementation(async (path) => path === "/events" ? [{ event_id: 7, event_name: "League", enabled: true }] : []);
    const { startGame } = await import("../index.js");
    await startGame(7);
    document.getElementById("new-game-choice").click();
    await vi.waitFor(() => expect(document.getElementById("game-setup-event").value).toBe("7"));
    document.getElementById("game-setup-form").dispatchEvent(new Event("submit", { cancelable: true }));
    expect(window.location.href).toBe("/game.html?new=1");
    expect(JSON.parse(sessionStorage.getItem("pendingGameSetup")).eventId).toBe(7);
});
it("starts a new guest game directly when there is nothing to resume", async () => {
    getActiveGameId.mockReturnValue(null);
    const { startGame } = await import("../index.js");
    await startGame();
    expect(document.getElementById("resume-game-dialog").showModal).not.toHaveBeenCalled();
    expect(window.location.href).toBe("/game.html?new=1");
});
