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
    if (resource === "/game-setup/unassigned-event") {
        const existing = server.rows["/events"]?.find((row) => row.event_type === "SystemUnassigned");
        if (existing) return { event_id: existing.event_id };
        const row = { event_id: server.nextId++, event_type: "SystemUnassigned" };
        (server.rows["/events"] ??= []).push(row);
        return { event_id: row.event_id };
    }
    if (/^\/shots\/\d+$/.test(resource)) {
        const row = server.rows["/shots"].find((shot) => shot.shot_id === Number(resource.split("/")[2]));
        if (options.method === "PUT") Object.assign(row, JSON.parse(options.body));
        return row;
    }
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


    async function nextSavedShot(shortcut = "gutter_button") {
        click(shortcut);
        click("next_frame");
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
    }

    it("opens the first shot of a selected frame without changing game progress", async () => {
        await loadGame();
        document.querySelector('.pin[data-pin="1"]').click();
        click("next_frame");
        click("spare_button"); click("next_frame");
        document.querySelector('[data-frame="1"] .frame_number').click();
        expect(document.getElementById("frame_title").textContent).toBe("Frame 1 \u00b7 Shot 1");
        expect(document.querySelector('.pin[data-pin="1"]').getAttribute("aria-pressed")).toBe("true");
        expect(document.querySelector('.pin[data-pin="2"]').getAttribute("aria-pressed")).toBe("false");
        expect(document.querySelector('.pin[data-pin="2"]').disabled).toBe(true);
        expect(document.getElementById("next_frame").textContent).toBe("Return to current frame");
        click("next_frame");
        expect(document.getElementById("frame_title").textContent).toBe("Frame 2 \u00b7 Shot 1");
    });

    it("keeps guest games local and scores a perfect game", async () => {
        await loadGame();
        expect(document.getElementById("save_shot")).toBeNull();
        expect([...document.querySelectorAll("button")].some((button) => button.textContent === "Start saved game")).toBe(false);
        for (let i = 0; i < 12; i++) { click("strike_button"); click("next_frame"); }
        expect(document.querySelector(".frame_card:last-child .frame_total").textContent).toBe("300");
        expect(server.rows["/shots"]).toBeUndefined();
        click("next_frame");
        expect(document.getElementById("finish_game_popup").open).toBe(true);
    });

    it("automatically saves each confirmed shot once under the hidden event", async () => {
        sessionStorage.setItem("authentication_token", "token");
        await loadGame();
        await nextSavedShot();
        expect(server.rows["/shots"]).toHaveLength(1);
        expect(server.rows["/events"][0].event_type).toBe("SystemUnassigned");
        expect(server.rows["/sessions"][0].event_id).toBe(server.rows["/events"][0].event_id);
        await nextSavedShot();
        expect(server.rows["/shots"]).toHaveLength(2);
        expect(server.rows["/games"]).toHaveLength(1);
        expect(server.rows["/sessions"]).toHaveLength(1);
    });

    it("uses selected event and establishment", async () => {
        sessionStorage.setItem("authentication_token", "token");
        sessionStorage.setItem("pendingGameSetup", JSON.stringify({ eventId: 51, establishmentId: 12 }));
        await loadGame();
        await nextSavedShot();
        expect(server.rows["/events"]).toBeUndefined();
        expect(server.rows["/sessions"][0]).toMatchObject({ event_id: 51, establishment_id: 12 });
    });

    it("saves shot comments with Next Shot and permits later editing", async () => {
        sessionStorage.setItem("authentication_token", "token");
        await loadGame();
        click("comment_button");
        const text = document.getElementById("shot-comment");
        expect(text.maxLength).toBe(1000);
        text.value = "First shot";
        text.dispatchEvent(new Event("input"));
        click("save-comment");
        await nextSavedShot();
        expect(server.rows["/shots"][0].comment).toBe("First shot");
        click("comment_button");
        const select = document.getElementById("comment-shot");
        select.selectedIndex = 0; select.dispatchEvent(new Event("change"));
        document.getElementById("shot-comment").value = "Updated";
        click("save-comment");
        await vi.waitFor(() => expect(server.rows["/shots"][0].comment).toBe("Updated"));
    });

    it("keeps a failed shot locally and blocks duplicate submissions", async () => {
        sessionStorage.setItem("authentication_token", "token");
        await loadGame();
        server.fail = true;
        click("strike_button"); click("next_frame");
        const id = Cache.getActiveGameId();
        await vi.waitFor(() => expect(Cache.getGameState(id).database.blocked).toBe(true));
        const shot = Cache.getFrameShots(Cache.getGameFrames(id)[0])[0];
        expect(Cache.getShotResult(shot).pins).toBe(10);
        expect(document.getElementById("next_frame").disabled).toBe(true);
    });

    it("reconciles a lost response without duplicating the saved shot", async () => {
        sessionStorage.setItem("authentication_token", "token");
        await loadGame();
        server.loseShotResponse = true;
        click("strike_button"); click("next_frame");
        const id = Cache.getActiveGameId();
        await vi.waitFor(() => expect(Cache.getGameState(id).database.blocked).toBe(true));
        expect(server.rows["/shots"]).toHaveLength(1);
        await loadGame();
        await vi.waitFor(() => expect(document.getElementById("next_frame").disabled).toBe(false));
        await nextSavedShot("strike_button");
        expect(server.rows["/shots"]).toHaveLength(2);
    });

    it("saves the last shot and finishes a signed-in game", async () => {
        sessionStorage.setItem("authentication_token", "token");
        await loadGame();
        for (let i = 0; i < 12; i++) await nextSavedShot("strike_button");
        expect(server.rows["/shots"]).toHaveLength(12);
        expect(document.getElementById("next_frame").textContent).toBe("Finish");
        click("next_frame");
        expect(window.location.href).toBe("/index.html");
    });

    it("uploads guest progress after login before finishing", async () => {
        await loadGame();
        bowlGutterGame();
        click("next_frame");
        click("finish_login");
        sessionStorage.setItem("authentication_token", "token");
        await loadGame();
        await vi.waitFor(() => expect(window.location.href).toBe("/index.html"));
        expect(server.rows["/shots"]).toHaveLength(20);
    });
    it("swipes to confirm a shot, reviews history, and returns without duplicating it", async () => {
        await loadGame();
        const lane = document.querySelector(".lane_panel");
        function swipe(from, to) {
            for (const [type, x] of [["pointerdown", from], ["pointerup", to]]) {
                const event = new Event(type, { bubbles: true });
                Object.assign(event, { clientX: x, clientY: 150, pointerId: 1, pointerType: "touch", isPrimary: true });
                lane.dispatchEvent(event);
            }
        }
        click("gutter_button");
        swipe(230, 100);
        expect(document.getElementById("frame_title").textContent).toContain("Shot 2");
        const id = Cache.getActiveGameId();
        const frame = Cache.getGameFrames(id)[0];
        expect(Cache.getFrameShots(frame).filter(shot => Cache.getShotResult(shot))).toHaveLength(1);
        swipe(100, 230);
        expect(document.getElementById("frame_title").textContent).toContain("Shot 1");
        expect(document.querySelector(".pin").disabled).toBe(true);
        swipe(230, 100);
        expect(document.getElementById("frame_title").textContent).toContain("Shot 2");
        expect(Cache.getFrameShots(frame).filter(shot => Cache.getShotResult(shot))).toHaveLength(1);
    });

    it("starts a fresh game explicitly and resumes that same game after reload", async () => {
        await loadGame();
        click("gutter_button"); click("next_frame");
        const oldId = Cache.getActiveGameId();
        const state = Cache.getGameState(oldId);
        window.location.search = "?new=1";
        window.location.href = "http://localhost/game.html?new=1";
        window.history = { replaceState: vi.fn() };
        await loadGame();
        const newId = Cache.getActiveGameId();
        expect(newId).not.toBe(oldId);
        expect(document.getElementById("frame_title").textContent).toContain("Shot 1");
        expect(Cache.getGameState(oldId)).toEqual(state);
        expect(window.history.replaceState).toHaveBeenCalled();
        window.location.search = "";
        await loadGame();
        expect(Cache.getActiveGameId()).toBe(newId);
    });

});
