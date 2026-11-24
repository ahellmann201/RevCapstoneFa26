import { readFileSync } from "node:fs";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("../database.js", () => ({ request: vi.fn() }));
import { request } from "../database.js";
import { initHomeLayout, validHomeLayout, moduleCells, moveHomeModule, resizeHomeModule } from "../home_layout.js";
beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = readFileSync("frontend/index.html", "utf8");
    vi.stubGlobal("window", { location: { search: "?edit_home=1", href: "http://localhost/index.html?edit_home=1" }, history: { replaceState: vi.fn() } });
    const picker = document.getElementById("home-module-picker"); picker.showModal = vi.fn(); picker.close = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());
it("validates module sizes, collisions, and boundaries", () => {
    expect(moduleCells("week", 2)).toEqual([2, 3, 4, 5]);
    expect(validHomeLayout([{ id: "week", slot: 3 }])).toBe(false);
    expect(validHomeLayout([{ id: "week", slot: 10 }])).toBe(false);
    expect(validHomeLayout([{ id: "week", slot: 2 }, { id: "game", slot: 4 }])).toBe(false);
    expect(validHomeLayout([{ id: "game", slot: 0 }, { id: "game", slot: 1 }])).toBe(false);
});
it("removes a module and saves per account, preserving the original button and its handler", () => {
    sessionStorage.setItem("userID", "42");
    const start = document.getElementById("start-game-button"), handler = vi.fn(); start.addEventListener("click", handler);
    initHomeLayout();
    document.querySelector(".home-edit-module").click();
    [...document.querySelectorAll("#home-module-options button")].find((button) => button.textContent === "Remove module").click();
    document.querySelector('[data-action="save"]').click();
    expect(document.getElementById("schedule-event-button").hidden).toBe(true);
    expect(document.querySelector(".home-editor").hidden).toBe(true);
    start.click(); expect(handler).toHaveBeenCalledOnce();
    const saved = JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:42"));
    expect(saved.map((item) => item.id)).toEqual(["game", "week"]);
    document.body.innerHTML = readFileSync("frontend/index.html", "utf8");
    window.location.search = "";
    initHomeLayout();
    expect(document.getElementById("schedule-event-button").hidden).toBe(true);
    expect(document.getElementById("start-game-button").hidden).toBe(false);
});
it("cancel discards changes and bad stored layouts fall back to defaults", () => {
    localStorage.setItem("revmetrix:home-layout:v1:guest", '[{"id":"week","slot":11}]');
    initHomeLayout();
    expect(document.querySelectorAll(".home-edit-module")).toHaveLength(3);
    document.querySelector(".home-edit-module").click();
    [...document.querySelectorAll("#home-module-options button")].find((button) => button.textContent === "Remove module").click();
    document.querySelector('[data-action="cancel"]').click();
    expect(document.getElementById("schedule-event-button").hidden).toBe(false);
});

it("adds an optional page shortcut and persists it without changing defaults", () => {
    initHomeLayout();
    expect(document.querySelectorAll(".home-edit-module")).toHaveLength(3);
    document.querySelector('[data-action="add"]').click();
    const add = [...document.querySelectorAll("#home-module-options button")].find((button) => button.textContent.startsWith("Ball Arsenal"));
    expect(add.disabled).toBe(false); add.click();
    document.querySelector('[data-action="save"]').click();
    const link = document.querySelector('.home-shortcut[href="/ball_arsenal.html"]');
    expect(link.hidden).toBe(false);
    expect(document.querySelector('.home-shortcut[href="/stats.html"]').hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:guest"))).toHaveLength(4);
});


it("loads the account layout from the server even on a different browser", async () => {
    sessionStorage.setItem("userID", "42"); sessionStorage.setItem("authentication_token", "token");
    request.mockResolvedValueOnce({ layout_version: 1, layout_json: [{ id: "stats", slot: 0 }], updated_at: "2026-11-17T12:00:00Z" });
    initHomeLayout();
    await vi.waitFor(() => expect(document.querySelector('[data-action="save"]').disabled).toBe(false));
    expect(document.querySelectorAll(".home-edit-module")).toHaveLength(1);
    expect(document.querySelector('.home-shortcut[href="/stats.html"]').hidden).toBe(false);
    expect(document.getElementById("start-game-button").hidden).toBe(true);
    expect(request).toHaveBeenCalledWith("/auth/me/home-layout");
});

it("keeps failed account saves open and only caches after a successful retry", async () => {
    sessionStorage.setItem("userID", "42"); sessionStorage.setItem("authentication_token", "token");
    request.mockResolvedValueOnce({ layout_version: 1, layout_json: [], updated_at: null });
    initHomeLayout();
    await vi.waitFor(() => expect(document.querySelector('[data-action="save"]').disabled).toBe(false));
    document.querySelector(".home-edit-module").click();
    [...document.querySelectorAll("#home-module-options button")].find(button => button.textContent === "Remove module").click();
    request.mockRejectedValueOnce(new Error("Offline"));
    document.querySelector('[data-action="save"]').click();
    await vi.waitFor(() => expect(document.querySelector(".home-layout-status").textContent).toContain("Could not save"));
    expect(localStorage.getItem("revmetrix:home-layout:v1:42")).toBeNull();
    expect(document.querySelector(".home-editor").hidden).toBe(false);
    request.mockResolvedValueOnce({ layout_version: 1 });
    document.querySelector('[data-action="save"]').click();
    await vi.waitFor(() => expect(document.querySelector(".home-editor").hidden).toBe(true));
    expect(JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:42")).map(entry => entry.id)).toEqual(["game", "week"]);
    expect(request).toHaveBeenLastCalledWith("/auth/me/home-layout", { method: "PUT", body: JSON.stringify({ layout_version: 1, layout_json: [{ id: "game", slot: 1 }, { id: "week", slot: 2 }] }) });
});


it("swaps occupied slots and makes room when moving a large widget", () => {
    const source = [{ id: "events", slot: 0 }, { id: "game", slot: 1 }, { id: "week", slot: 2 }];
    const swapped = moveHomeModule(source, "events", 1);
    expect(swapped.find(entry => entry.id === "game").slot).toBe(0);
    expect(swapped.find(entry => entry.id === "events").slot).toBe(1);
    const movedWeek = moveHomeModule(source, "week", 0);
    expect(validHomeLayout(movedWeek)).toBe(true);
    expect(movedWeek.find(entry => entry.id === "week").slot).toBe(0);
    expect(source[2].slot).toBe(2);
    expect(moveHomeModule(source, "week", 11)).toBeNull();
});

it("lets keyboard users rearrange, cancel changes, or save with Done", () => {
    window.location.search = "";
    initHomeLayout();
    document.querySelector(".home-edit-toggle").click();
    let tile = document.querySelector('[data-home-module="events"].home-edit-module');
    tile.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    document.querySelector('[data-action="cancel"]').click();
    expect(localStorage.getItem("revmetrix:home-layout:v1:guest")).toBeNull();
    document.querySelector(".home-edit-toggle").click();
    tile = document.querySelector('[data-home-module="events"].home-edit-module');
    tile.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    document.querySelector('[data-action="save"]').click();
    const saved = JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:guest"));
    expect(saved.find(entry => entry.id === "events").slot).toBe(1);
    expect(saved.find(entry => entry.id === "game").slot).toBe(0);
});


it("inserts a dragged tile and shifts other tiles instead of exchanging endpoints", () => {
    const source = [{ id: "events", slot: 0 }, { id: "game", slot: 1 }, { id: "stats", slot: 2 }, { id: "games", slot: 3 }];
    const result = moveHomeModule(source, "events", 2);
    expect(result).toEqual([{ id: "game", slot: 0 }, { id: "stats", slot: 1 }, { id: "events", slot: 2 }, { id: "games", slot: 3 }]);
    expect(source[0].slot).toBe(0);
});

it("offers adding only from the toolbar and finds a free spot automatically", () => {
    initHomeLayout();
    expect(document.querySelector(".home-empty-module")).toBeNull();
    expect(document.querySelectorAll('[data-action="add"]')).toHaveLength(1);
    document.querySelector('[data-action="add"]').click();
    [...document.querySelectorAll("#home-module-options button")].find(button => button.textContent.startsWith("Stats")).click();
    document.querySelector('[data-action="save"]').click();
    const saved = JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:guest"));
    expect(saved.find(entry => entry.id === "stats").slot).toBe(6);
    expect(validHomeLayout(saved)).toBe(true);
});


it("enlarges supported widgets, makes room, and preserves size when dragging", () => {
    const initial = [{ id: "game", slot: 0 }, { id: "stats", slot: 1 }, { id: "week", slot: 2 }];
    const resized = resizeHomeModule(initial, "stats", "large");
    expect(validHomeLayout(resized)).toBe(true);
    expect(resized.find(entry => entry.id === "stats").size).toBe("large");
    expect(moduleCells("stats", 0, "large")).toHaveLength(4);
    const moved = moveHomeModule(resized, "stats", 6);
    expect(moved.find(entry => entry.id === "stats").size).toBe("large");
    expect(resizeHomeModule(initial, "game", "large")).toBeNull();
    expect(validHomeLayout([{ id: "stats", slot: 0, size: "giant" }])).toBe(false);
});

it("saves and restores a widget's chosen size", () => {
    localStorage.setItem("revmetrix:home-layout:v1:guest", JSON.stringify([{ id: "stats", slot: 0 }]));
    initHomeLayout();
    document.querySelector('[data-resize-home="stats"]').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    document.querySelector('[data-action="save"]').click();
    expect(document.querySelector('.home-shortcut[href="/stats.html"]').classList.contains("home-widget-large")).toBe(true);
    const saved = JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:guest"));
    expect(saved[0].size).toBe("large");
    document.body.innerHTML = readFileSync("frontend/index.html", "utf8");
    window.location.search = "";
    initHomeLayout();
    expect(document.querySelector('.home-shortcut[href="/stats.html"]').dataset.widgetSize).toBe("large");
});


it("explains an outdated API and preserves the unsaved expanded layout", async () => {
    sessionStorage.setItem("userID", "42"); sessionStorage.setItem("authentication_token", "token");
    request.mockResolvedValueOnce({ layout_version: 1, layout_json: [{ id: "stats", slot: 0 }], updated_at: "2026-11-19T12:00:00Z" });
    initHomeLayout();
    await vi.waitFor(() => expect(document.querySelector('[data-action="save"]').disabled).toBe(false));
    document.querySelector('[data-resize-home="stats"]').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    request.mockRejectedValueOnce(Object.assign(new Error("layout_json.0.size: Extra inputs are not permitted"), { status: 422 }));
    document.querySelector('[data-action="save"]').click();
    await vi.waitFor(() => expect(document.querySelector(".home-layout-status").textContent).toContain("server needs an update"));
    expect(document.querySelector(".home-editor").hidden).toBe(false);
    expect(document.querySelector('.home-edit-module[data-home-module="stats"]').style.gridColumn).toBe("1 / span 2");
    expect(document.querySelector('[data-action="save"]').disabled).toBe(false);
});


it("preserves Nadia's color presets together with our saved widget sizes", () => {
    localStorage.setItem("revmetrix:home-layout:v1:guest", JSON.stringify([{ id: "stats", slot: 0, size: "large" }]));
    initHomeLayout();
    document.querySelector('.home-edit-module[data-home-module="stats"]').click();
    [...document.querySelectorAll("#home-module-options button")].find(button => button.textContent === "Change button color").click();
    [...document.querySelectorAll("#home-module-options button")].find(button => button.textContent === "Button amber").click();
    document.querySelector('[data-action="save"]').click();
    const saved = JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:guest"));
    expect(saved[0]).toMatchObject({ id: "stats", size: "large", color: "amber" });
    expect(validHomeLayout(saved)).toBe(true);
    expect(validHomeLayout([{ id: "stats", slot: 0, color: "url(unsafe)" }])).toBe(false);
});


it("saves selected statistics and restores them when the settings are reopened", () => {
    localStorage.setItem("revmetrix:home-layout:v1:guest", JSON.stringify([{ id: "stats", slot: 0, size: "large" }]));
    initHomeLayout();
    document.querySelector('.home-edit-module[data-home-module="stats"]').click();
    [...document.querySelectorAll("#home-module-options button")].find(button => button.textContent === "Choose statistics").click();
    function toggle(key, checked) {
        const input = document.querySelector(`#home-module-options input[value="${key}"]`);
        input.checked = checked; input.dispatchEvent(new Event("change"));
    }
    expect(document.querySelector('input[value="latest_score"]').disabled).toBe(true);
    toggle("completed_games", false); toggle("average_score", false);
    toggle("latest_score", true); toggle("invalid_games", true);
    [...document.querySelectorAll("#home-module-options button")].find(button => button.textContent === "Apply changes").click();
    document.querySelector('[data-action="save"]').click();
    expect(JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:guest"))[0].metrics).toEqual(["highest_score", "latest_score", "invalid_games"]);
    document.querySelector(".home-edit-toggle").click();
    document.querySelector('.home-edit-module[data-home-module="stats"]').click();
    [...document.querySelectorAll("#home-module-options button")].find(button => button.textContent === "Choose statistics").click();
    expect([...document.querySelectorAll("#home-module-options input:checked")].map(input => input.value)).toEqual(["highest_score", "latest_score", "invalid_games"]);
    expect(validHomeLayout([{ id: "stats", slot: 0, metrics: [] }])).toBe(false);
    expect(validHomeLayout([{ id: "games", slot: 0, metrics: ["average_score"] }])).toBe(false);
});
