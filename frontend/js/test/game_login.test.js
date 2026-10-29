import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as Cache from "../cache.js";

vi.mock("../api_client.js", () => ({
    login: vi.fn(async () => ({ access_token: "new-token" })),
    getUser: vi.fn(async () => ({
        User_ID: 42, Username: "bowler", Display_Name: "Bowler",
        Email: "bowler@example.com", Main_Hand: "right",
    })),
}));

beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("window", { location: { reload: vi.fn() }, alert: vi.fn() });
    document.body.innerHTML = '<input id="login_email" value="bowler"><input id="login_password" value="password">';
});
afterEach(() => vi.unstubAllGlobals());

it("retains the guest game and its foul through the real login flow", async () => {
    Cache.setActiveGameId("guest-game");
    Cache.setGameState("guest-game", { gameFinished: true, finishRequested: true });
    Cache.addGameFrame("guest-game", "frame-one");
    Cache.addFrameShot("frame-one", "shot-one");
    Cache.setPinLeave("shot-one", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    Cache.setShotResult("shot-one", { pins: 0, foul: true });
    Cache.setUsername("old-profile");
    const { submitAuth } = await import("../authentication.js");
    await submitAuth("login");
    expect(Cache.getActiveGameId()).toBe("guest-game");
    expect(Cache.getGameState("guest-game").finishRequested).toBe(true);
    expect(Cache.getFrameShots("frame-one")).toEqual(["shot-one"]);
    expect(Cache.getShotResult("shot-one")).toEqual({ pins: 0, foul: true });
    expect(Cache.getUsername()).toBe("bowler");
    expect(sessionStorage.getItem("authentication_token")).toBe("new-token");
    expect(window.location.reload).toHaveBeenCalledOnce();
});
