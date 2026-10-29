import html from "../../game.html?raw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Cache from "../cache.js";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../authentication.js", () => ({
    getAuthToken: () => sessionStorage.getItem("authentication_token"),
}));
vi.mock("../popups.js", () => ({ openAuthPopup: vi.fn() }));
const server = vi.hoisted(() => ({ rows: {}, nextId: 1, fail: false, loseShotResponse: false }));
vi.mock("../api_client.js", () => ({ request: vi.fn(async (path, options = {}) => {
    if (server.fail) throw new Error("Connection lost");
    const resource = path.split("?")[0];
    if (resource === "/auth/me") return { user_id: 1 };
    if (options.method === "POST") {
        const singular = resource.slice(1, -1);
        const row = { ...JSON.parse(options.body), [`${singular}_id`]: server.nextId++ };
        (server.rows[resource] ??= []).push(row);
        if (resource === "/shots" && server.loseShotResponse) {
            server.loseShotResponse = false;
            throw new Error("Response lost after commit");
        }
        return row;
    }
    if (/^\/games\/\d+$/.test(resource)) {
        return server.rows["/games"].find((row) => row.game_id === Number(resource.split("/")[2]));
    }
    return server.rows[resource] ?? [];
}) }));

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
        server.rows = {};
        server.nextId = 1;
        server.fail = false;
        server.loseShotResponse = false;
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
        expect(Cache.getActiveGameId()).toBe(gameId);
        expect(document.getElementById("game_status")).toBeTruthy();
        click("save_shot");
        await vi.waitFor(() => expect(document.getElementById("save_shot").disabled).toBe(true));
        await vi.waitFor(() => expect(server.rows["/shots"]).toHaveLength(20));
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        click("next_frame");
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
        expect(Cache.getActiveGameId()).toBe(firstId);
        click("save_shot");
        await vi.waitFor(() => expect(server.rows["/shots"]).toHaveLength(20));
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        click("next_frame");
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

    it("keeps Next Shot local and uploads confirmed shots only once with Save Shot", async () => {
        sessionStorage.setItem("authentication_token", "user-token");
        await loadGame();
        click("strike_button");
        click("next_frame");
        click("foul_button");
        click("next_frame");
        expect(server.rows["/shots"]).toBeUndefined();
        click("save_shot");
        await vi.waitFor(() => expect(server.rows["/shots"]).toHaveLength(2));
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        expect(server.rows["/shots"][0].throw_type).toBe("strike");
        expect(server.rows["/shots"][1]).toMatchObject({ throw_type: null, comment: null });
        const id = Cache.getActiveGameId();
        const localShot = Cache.getFrameShots(Cache.getGameFrames(id)[1])[0];
        expect(Cache.getShotResult(localShot)).toEqual({ pins: 0, foul: true });
        click("save_shot");
        expect(server.rows["/shots"]).toHaveLength(2);
        await loadGame();
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        expect(Cache.getShotResult(localShot).foul).toBe(true);
        expect(document.querySelectorAll(".frame_card")).toHaveLength(10);
        click("gutter_button");
        click("next_frame");
        click("save_shot");
        await vi.waitFor(() => expect(server.rows["/shots"]).toHaveLength(3));
    });

    it("keeps cached shots and blocks blind retries after a save failure", async () => {
        sessionStorage.setItem("authentication_token", "user-token");
        await loadGame();
        click("strike_button");
        click("next_frame");
        const id = Cache.getActiveGameId();
        server.fail = true;
        click("save_shot");
        await vi.waitFor(() => expect(Cache.getGameState(id).database.blocked).toBe(true));
        expect(Cache.getShotResult(Cache.getFrameShots(Cache.getGameFrames(id)[0])[0]).pins).toBe(10);
        expect(document.getElementById("save_shot").disabled).toBe(true);
    });

    it("reconciles a committed shot after a lost response without uploading it twice", async () => {
        sessionStorage.setItem("authentication_token", "user-token");
        await loadGame();
        click("strike_button");
        click("next_frame");
        server.loseShotResponse = true;
        click("save_shot");
        const id = Cache.getActiveGameId();
        await vi.waitFor(() => expect(Cache.getGameState(id).database.blocked).toBe(true));
        expect(server.rows["/shots"]).toHaveLength(1);
        await loadGame();
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        expect(Cache.getGameState(id).database.blocked).toBe(false);
        click("strike_button");
        click("next_frame");
        click("save_shot");
        await vi.waitFor(() => expect(server.rows["/shots"]).toHaveLength(2));
        expect(server.rows["/shots"][0].shot_id).not.toBe(server.rows["/shots"][1].shot_id);
    });

    it("loads a saved game from its URL into a fresh browser cache", async () => {
        sessionStorage.setItem("authentication_token", "user-token");
        await loadGame();
        for (let index = 0; index < 12; index++) {
            click("strike_button");
            click("next_frame");
        }
        click("save_shot");
        await vi.waitFor(() => expect(server.rows["/shots"]).toHaveLength(12));
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        const remoteId = server.rows["/games"][0].game_id;
        sessionStorage.clear();
        sessionStorage.setItem("authentication_token", "user-token");
        window.location.search = `?game_id=${remoteId}`;
        await loadGame();
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        expect(document.querySelector(".frame_card:last-child .frame_total").textContent).toBe("300");
        expect(document.getElementById("next_frame").textContent).toBe("Finish");
        expect(document.getElementById("save_shot").disabled).toBe(true);
    });

    it("supports spare scoring and reviewing prior frames without adding shots", async () => {
        await loadGame();
        document.querySelector('.pin[data-pin="1"]').click();
        click("next_frame");
        expect(document.getElementById("spare_button").disabled).toBe(false);
        click("spare_button");
        click("next_frame");
        click("strike_button");
        click("next_frame");
        expect(document.querySelector(".frame_total").textContent).toBe("20");
        document.querySelector('.frame_card[data-frame="1"]').click();
        expect(document.getElementById("frame_title").textContent).toContain("Frame 1");
        expect(document.getElementById("strike_button").disabled).toBe(true);
        click("next_frame");
        expect(document.getElementById("frame_title").textContent).toContain("Frame 3");
        expect(Cache.getFrameShots(Cache.getGameFrames(Cache.getActiveGameId())[0])).toHaveLength(2);
    });
});
