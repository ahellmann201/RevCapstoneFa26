import { afterEach, describe, expect, it, vi } from "vitest";
import * as Cache from "../cache.js";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("API requests use the local backend on the website's host", () => {
    for (const hostname of ["localhost", "10.127.37.132", "192.168.1.20"]) {
        it(`uses the local API when the website runs on ${hostname}`, async () => {
            vi.stubGlobal("window", { location: { hostname } });
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ status: "ok" }),
            });
            vi.stubGlobal("fetch", fetchMock);
            const { testPython } = await import("../api_client.js");
            await testPython();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toBe(`http://${hostname}:8000/health`);
        });
    }
});

it("keeps local game progress when an expired token clears account data", async () => {
    sessionStorage.clear();
    Cache.setActiveGameId("local-game");
    Cache.setGameState("local-game", { currentFrame: 1 });
    Cache.addGameFrame("local-game", "frame");
    Cache.addFrameShot("frame", "shot");
    Cache.setShotResult("shot", { pins: 10, foul: false });
    sessionStorage.setItem("authentication_token", "expired");
    Cache.setUsername("old-account");
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: false, status: 401, json: async () => ({ detail: "Expired token" }),
    })));
    const { request } = await import("../api_client.js");
    await expect(request("/auth/me")).rejects.toThrow("Expired token");
    expect(sessionStorage.getItem("authentication_token")).toBeNull();
    expect(Cache.getUsername()).toBeNull();
    expect(Cache.getActiveGameId()).toBe("local-game");
    expect(Cache.getShotResult("shot").pins).toBe(10);
});
