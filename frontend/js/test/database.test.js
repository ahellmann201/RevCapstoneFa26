import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as Cache from "../cache.js";

vi.mock("../api_client.js", () => ({
    request: vi.fn(), checkResponse: vi.fn(), testPython: vi.fn(),
    getUser: vi.fn(), login: vi.fn(), createAccount: vi.fn(),
    getMainhand: vi.fn(), getDisplayName: vi.fn(), getUsername: vi.fn(), getBalls: vi.fn(),
    createBall: vi.fn(), deleteBall: vi.fn(), setDisplayName: vi.fn(),
}));
import * as API from "../api_client.js";

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    sessionStorage.clear();
    vi.stubGlobal("window", { location: { reload: vi.fn() } });
});
afterEach(() => vi.unstubAllGlobals());

function signIn() {
    sessionStorage.setItem("authentication_token", "token");
    sessionStorage.setItem("userID", "42");
}

it("uses guest defaults without making profile requests while signed out", async () => {
    const Database = await import("../database.js");
    expect(await Database.getCachedUsername()).toBe("Guest");
    expect(await Database.getCachedDisplayName()).toBe("Guest");
    expect(await Database.getCachedDisplayNameBlank()).toBeNull();
    expect(await Database.getCachedMainhand()).toBe("both");
    expect(await Database.getCachedBalls()).toEqual([]);
    expect(API.getUsername).not.toHaveBeenCalled();
    expect(API.getBalls).not.toHaveBeenCalled();
});

it("loads and caches the signed-in profile", async () => {
    signIn();
    API.getUsername.mockResolvedValue("taylor");
    API.getDisplayName.mockResolvedValue("Taylor Bowler");
    API.getMainhand.mockResolvedValue("left");
    const Database = await import("../database.js");

    expect(await Database.getCachedUsername()).toBe("taylor");
    expect(await Database.getCachedDisplayName()).toBe("Taylor Bowler");
    expect(await Database.getCachedDisplayNameBlank()).toBe("Taylor Bowler");
    expect(await Database.getCachedMainhand()).toBe("left");
    expect(Cache.getUsername()).toBe("taylor");
    expect(Cache.getDisplayName()).toBe("Taylor Bowler");
    expect(Cache.getMainhand()).toBe("left");
    expect(API.getUsername).toHaveBeenCalledWith("42");
    expect(API.getMainhand).toHaveBeenCalledWith("42");
});

it("falls back to cached profile values when the database is unavailable or a request fails", async () => {
    signIn();
    Cache.setUsername("cached-user");
    Cache.setDisplayName("Cached Name");
    Cache.setMainhand("right");
    sessionStorage.setItem("canReachDatabase", "false");
    const Database = await import("../database.js");
    expect(await Database.getCachedUsername()).toBe("cached-user");
    expect(await Database.getCachedDisplayName()).toBe("Cached Name");
    expect(await Database.getCachedDisplayNameBlank()).toBe("Cached Name");
    expect(await Database.getCachedMainhand()).toBe("right");
    expect(API.getUsername).not.toHaveBeenCalled();

    sessionStorage.removeItem("canReachDatabase");
    API.getUsername.mockRejectedValue(new Error("offline"));
    expect(await Database.getCachedUsername()).toBe("cached-user");
});

it("falls back from a missing display name to the username, but keeps the blank variant empty", async () => {
    signIn();
    API.getDisplayName.mockResolvedValue(null);
    API.getUsername.mockResolvedValue("taylor");
    const Database = await import("../database.js");
    expect(await Database.getCachedDisplayName()).toBe("taylor");
    expect(await Database.getCachedDisplayNameBlank()).toBeNull();
});

it("distinguishes offline operations, missing sessions, and successful profile updates", async () => {
    signIn();
    const Database = await import("../database.js");
    sessionStorage.setItem("canReachDatabase", "false");
    expect(await Database.getUsername()).toBe(Database.DB_UNAVAILABLE);
    expect(await Database.createBall({ ball_name: "Alpha" })).toBe(Database.DB_UNAVAILABLE);
    expect(await Database.deleteBall(5)).toBe(Database.DB_UNAVAILABLE);
    expect(await Database.setDisplayName("Taylor")).toBe(Database.DB_UNAVAILABLE);
    expect(API.createBall).not.toHaveBeenCalled();

    sessionStorage.removeItem("canReachDatabase");
    sessionStorage.removeItem("userID");
    await expect(Database.getUsername()).rejects.toThrow("No signed-in user is available.");
    sessionStorage.setItem("userID", "42");
    API.createBall.mockResolvedValue({ ball_id: 1 });
    API.deleteBall.mockResolvedValue(null);
    API.setDisplayName.mockResolvedValue(null);
    expect(await Database.createBall({ ball_name: "Alpha" })).toEqual({ ball_id: 1 });
    expect(await Database.deleteBall(5)).toBeNull();
    expect(await Database.setDisplayName("Taylor")).toBe(true);
    expect(API.createBall).toHaveBeenCalledWith("42", { ball_name: "Alpha" });
    expect(API.deleteBall).toHaveBeenCalledWith("42", 5);
});

it("loads only a signed-in user's balls and forwards search filters", async () => {
    const Database = await import("../database.js");
    expect(await Database.getCachedBalls()).toEqual([]);
    signIn();
    API.getBalls.mockResolvedValue([{ ball_id: 1 }]);
    expect(await Database.getCachedBalls({ name_contains: "Alpha" })).toEqual([{ ball_id: 1 }]);
    expect(API.getBalls).toHaveBeenCalledWith("42", { name_contains: "Alpha" });
});

it("requires authentication to add or delete a ball and reports an unavailable database", async () => {
    const Database = await import("../database.js");
    await expect(Database.createBallForCurrentUser({})).rejects.toThrow("Please log in to add a ball.");
    await expect(Database.deleteBallForCurrentUser(1)).rejects.toThrow("Please log in to delete a ball.");

    signIn();
    sessionStorage.setItem("canReachDatabase", "false");
    await expect(Database.createBallForCurrentUser({})).rejects.toThrow("database is currently unavailable");
    await expect(Database.deleteBallForCurrentUser(1)).rejects.toThrow("database is currently unavailable");
});

it("refreshes the connectivity flag only when requested and supports debug logout", async () => {
    signIn();
    const Database = await import("../database.js");
    expect(await Database.testDatabaseConnection()).toBe("true");
    expect(await Database.testDatabaseConnection(true)).toBe("true");
    expect(await Database.testDatabaseConnection(true, true)).toBe("false");
    expect(await Database.testDatabaseConnection(false, true)).toBe("true");

    await expect(Database.getUsername(false, true)).rejects.toThrow("Logged out due to an invalid session (debug).");
    expect(sessionStorage.getItem("userID")).toBeNull();
    expect(window.location.reload).toHaveBeenCalledOnce();
});
