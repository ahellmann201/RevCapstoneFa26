import html from "../../game.html?raw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Cache from "../cache.js";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../authentication.js", () => ({
    getAuthToken: () => sessionStorage.getItem("authentication_token"),
}));
vi.mock("../popups.js", () => ({ openAuthPopup: vi.fn() }));

const click = (id) => document.getElementById(id).click();

async function loadGame() {
    vi.resetModules();
    document.body.innerHTML = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
    await import("../game.js");
}

function bowlGutterGame() {
    for (let shot = 0; shot < 20; shot++) {
        click("gutter_button");
        click("next_frame");
    }
}

describe("cached game and Finish flow", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.clearAllMocks();
        // Keep navigation observable without leaving jsdom's document.
        vi.stubGlobal("window", {
            location: { href: "/game.html" },
            matchMedia: () => ({ matches: true }),
        });
        HTMLElement.prototype.scrollTo = vi.fn();
        HTMLDialogElement.prototype.showModal = vi.fn(function () {
            this.open = true;
        });
        HTMLDialogElement.prototype.close = vi.fn(function () {
            this.open = false;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("links all frames and confirmed shots to a game and offers Finish after 20 gutters", async () => {
        await loadGame();
        const gameId = Cache.getActiveGameId();
        expect(gameId).toMatch(/^[0-9a-f-]{36}$/);
        bowlGutterGame();
        const frames = Cache.getGameFrames(gameId);
        expect(frames).toHaveLength(10);
        for (const frameId of frames) {
            const shots = Cache.getFrameShots(frameId);
            expect(shots).toHaveLength(2);
            expect(shots.map(Cache.getShotResult)).toEqual([
                { pins: 0, foul: false }, { pins: 0, foul: false },
            ]);
        }
        expect(Cache.getGameState(gameId).gameFinished).toBe(true);
        expect(document.getElementById("next_frame").textContent).toBe("Finish");
        expect(document.getElementById("next_frame").disabled).toBe(false);
        expect(document.querySelector(".frame_card:last-child .frame_total").textContent).toBe("0");
        click("next_frame");
        expect(document.getElementById("finish_game_popup").open).toBe(true);
        expect(window.location.href).toBe("/game.html");
    });

    it("retains bonus shots and the 300 score for a perfect game", async () => {
        await loadGame();
        for (let shot = 0; shot < 12; shot++) {
            click("strike_button");
            click("next_frame");
        }
        const frames = Cache.getGameFrames(Cache.getActiveGameId());
        expect(Cache.getFrameShots(frames[9])).toHaveLength(3);
        expect(document.querySelector(".frame_card:last-child .frame_total").textContent).toBe("300");
        expect(document.getElementById("next_frame").textContent).toBe("Finish");
    });

    it("resumes the same frames, shots, pin selection, and foul across reloads", async () => {
        await loadGame();
        click("gutter_button");
        click("next_frame");
        document.querySelector('.pin[data-pin="1"]').click();
        const gameId = Cache.getActiveGameId();
        const frameIds = Cache.getGameFrames(gameId);
        const shotIds = Cache.getFrameShots(frameIds[0]);
        await loadGame();
        expect(Cache.getActiveGameId()).toBe(gameId);
        expect(Cache.getGameFrames(gameId)).toEqual(frameIds);
        expect(Cache.getFrameShots(frameIds[0])).toEqual(shotIds);
        expect(document.getElementById("frame_title").textContent).toContain("Shot 2");
        expect(document.querySelector('.pin[data-pin="1"]').getAttribute("aria-pressed")).toBe("true");
        click("foul_button");
        await loadGame();
        expect(document.getElementById("foul_button").getAttribute("aria-pressed")).toBe("true");
    });

    it.each(["login", "signup"])("keeps the completed game through %s and its reload", async (type) => {
        await loadGame();
        bowlGutterGame();
        const gameId = Cache.getActiveGameId();
        const frameIds = Cache.getGameFrames(gameId);
        click("next_frame");
        click(`finish_${type}`);
        const { openAuthPopup } = await import("../popups.js");
        expect(openAuthPopup).toHaveBeenCalledWith(`${type}_popup`);
        expect(Cache.getGameState(gameId).finishRequested).toBe(true);
        // Closing or failing authentication must leave the finished game intact.
        await loadGame();
        expect(Cache.getActiveGameId()).toBe(gameId);
        expect(document.getElementById("next_frame").textContent).toBe("Finish");
        sessionStorage.setItem("authentication_token", "user-token");
        Cache.setUserID("user-1");
        await loadGame();
        expect(Cache.getGameFrames(gameId)).toEqual(frameIds);
        expect(Cache.getGameState(gameId)).toMatchObject({ userID: "user-1", finishRequested: false });
        expect(Cache.getGameState(gameId).finishedAt).toBeTruthy();
        expect(Cache.getActiveGameId()).toBeNull();
        expect(window.location.href).toBe("/index.html");
    });

    it("discards only the declined game and goes home when staying signed out", async () => {
        Cache.setUsername("keep-me");
        Cache.addGameFrame("other-game", "other-frame");
        Cache.addFrameShot("other-frame", "other-shot");
        Cache.setPinLeave("other-shot", [1]);
        await loadGame();
        bowlGutterGame();
        const gameId = Cache.getActiveGameId();
        const frameIds = Cache.getGameFrames(gameId);
        const shotId = Cache.getFrameShots(frameIds[0])[0];
        click("next_frame");
        click("stay_signed_out");
        expect(Cache.getGameState(gameId)).toBeNull();
        expect(Cache.getGameFrames(gameId)).toEqual([]);
        expect(Cache.getFrameShots(frameIds[0])).toEqual([]);
        expect(Cache.getPinLeave(shotId)).toBeNull();
        expect(Cache.getShotResult(shotId)).toBeNull();
        expect(Cache.getActiveGameId()).toBeNull();
        expect(Cache.getUsername()).toBe("keep-me");
        expect(Cache.getPinLeave("other-shot")).toEqual([1]);
        expect(window.location.href).toBe("/index.html");
    });

    it("keeps a signed-in game locally and creates distinct game, frame, and shot IDs next time", async () => {
        sessionStorage.setItem("authentication_token", "user-token");
        Cache.setUserID("user-1");
        await loadGame();
        const firstId = Cache.getActiveGameId();
        const firstFrames = Cache.getGameFrames(firstId);
        const firstShot = Cache.getFrameShots(firstFrames[0])[0];
        bowlGutterGame();
        click("next_frame");
        expect(document.getElementById("finish_game_popup").open).toBe(false);
        expect(Cache.getGameState(firstId).userID).toBe("user-1");
        expect(Cache.getActiveGameId()).toBeNull();
        expect(window.location.href).toBe("/index.html");
        await loadGame();
        const secondId = Cache.getActiveGameId();
        expect(secondId).not.toBe(firstId);
        expect(Cache.getGameFrames(secondId).some((id) => firstFrames.includes(id))).toBe(false);
        expect(Cache.getFrameShots(Cache.getGameFrames(secondId)[0])[0]).not.toBe(firstShot);
        expect(Cache.getShotResult(firstShot)).toEqual({ pins: 0, foul: false });
    });
});
