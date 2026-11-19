import { beforeEach, describe, expect, it } from "vitest";
import * as Cache from "../cache.js";

beforeEach(() => sessionStorage.clear());

describe("profile preferences", () => {
    it("returns null for missing profile values and defaults mainhand to both", () => {
        expect(Cache.getUsername()).toBeNull();
        expect(Cache.getDisplayName()).toBeNull();
        expect(Cache.getEmail()).toBeNull();
        expect(Cache.getMainhand()).toBe("both");
        expect(Cache.getShowFullDisplayName()).toBe(false);
        expect(Cache.getUserID()).toBeNull();
    });

    it("round trips profile values and boolean preferences", () => {
        Cache.setUsername("bowler");
        Cache.setDisplayName("Taylor Bowler");
        Cache.setEmail("taylor@example.com");
        Cache.setMainhand("left");
        Cache.setShowFullDisplayName(true);
        Cache.setUserID(42);

        expect(Cache.getUsername()).toBe("bowler");
        expect(Cache.getDisplayName()).toBe("Taylor Bowler");
        expect(Cache.getEmail()).toBe("taylor@example.com");
        expect(Cache.getMainhand()).toBe("left");
        expect(Cache.getShowFullDisplayName()).toBe(true);
        expect(Cache.getUserID()).toBe("42");
        Cache.setShowFullDisplayName(false);
        expect(Cache.getShowFullDisplayName()).toBe(false);
    });

    it("clears all cached data", () => {
        Cache.setUsername("bowler");
        Cache.setActiveGameId("game-1");
        Cache.clearCache();
        expect(sessionStorage.length).toBe(0);
    });
});

describe("cached game relationships", () => {
    it("stores shot leaves, results, and unique frame/game links", () => {
        Cache.setPinLeave("shot-1", [1, 3, 5]);
        Cache.setShotResult("shot-1", { pins: 7, foul: false });
        Cache.addFrameShot("frame-1", "shot-1");
        Cache.addFrameShot("frame-1", "shot-1");
        Cache.addGameFrame("game-1", "frame-1");
        Cache.addGameFrame("game-1", "frame-1");

        expect(Cache.getPinLeave("shot-1")).toEqual([1, 3, 5]);
        expect(Cache.getShotResult("shot-1")).toEqual({ pins: 7, foul: false });
        expect(Cache.getFrameShots("frame-1")).toEqual(["shot-1"]);
        expect(Cache.getGameFrames("game-1")).toEqual(["frame-1"]);
        expect(Cache.getFrameShots("missing")).toEqual([]);
        expect(Cache.getGameFrames("missing")).toEqual([]);
    });

    it("round trips game state and manages the active game", () => {
        const state = { currentFrame: 3, database: { game: null } };
        Cache.setGameState("game-1", state);
        Cache.setActiveGameId("game-1");
        expect(Cache.getGameState("game-1")).toEqual(state);
        expect(Cache.getGameState("missing")).toBeNull();
        expect(Cache.getActiveGameId()).toBe("game-1");
        Cache.setActiveGameId(null);
        expect(Cache.getActiveGameId()).toBeNull();
    });

    it("snapshots unfinished guest games and restores them after session clearing", () => {
        Cache.setActiveGameId("guest-1");
        Cache.setGameState("guest-1", { currentFrame: 2 });
        Cache.addGameFrame("guest-1", "frame-1");
        Cache.addFrameShot("frame-1", "shot-1");
        Cache.setPinLeave("shot-1", [2, 4]);
        Cache.setShotResult("shot-1", { pins: 8, foul: false });

        const snapshot = Cache.snapshotGuestGame();
        expect(snapshot.map(([key]) => key)).toEqual(expect.arrayContaining([
            "activeGameId", "gameguest-1:state", "gameguest-1:frames",
            "frameframe-1:shots", "shotshot-1:leave", "shot:shot-1:result",
        ]));
        sessionStorage.clear();
        Cache.restoreGuestGame(snapshot);
        expect(Cache.getActiveGameId()).toBe("guest-1");
        expect(Cache.getGameState("guest-1")).toEqual({ currentFrame: 2 });
        expect(Cache.getShotResult("shot-1")).toEqual({ pins: 8, foul: false });
    });

    it("excludes a signed-in game from guest snapshots unless explicitly requested", () => {
        Cache.setActiveGameId("saved-1");
        Cache.setGameState("saved-1", { userID: 4 });
        expect(Cache.snapshotGuestGame()).toEqual([]);
        expect(Cache.snapshotGuestGame(false)).not.toEqual([]);
    });

    it("removes only the selected game's cached progress", () => {
        Cache.setActiveGameId("game-1");
        Cache.setGameState("game-1", { currentFrame: 1 });
        Cache.addGameFrame("game-1", "frame-1");
        Cache.addFrameShot("frame-1", "shot-1");
        Cache.setPinLeave("shot-1", [1]);
        Cache.setShotResult("shot-1", { pins: 9, foul: false });
        Cache.setGameState("game-2", { currentFrame: 2 });

        Cache.removeGame("game-1");

        expect(Cache.getGameState("game-1")).toBeNull();
        expect(Cache.getGameFrames("game-1")).toEqual([]);
        expect(Cache.getFrameShots("frame-1")).toEqual([]);
        expect(Cache.getPinLeave("shot-1")).toBeNull();
        expect(Cache.getShotResult("shot-1")).toBeNull();
        expect(Cache.getActiveGameId()).toBeNull();
        expect(Cache.getGameState("game-2")).toEqual({ currentFrame: 2 });
    });
});
