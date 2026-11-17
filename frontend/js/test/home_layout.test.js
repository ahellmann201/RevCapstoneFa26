import { readFileSync } from "node:fs";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { initHomeLayout, validHomeLayout, moduleCells } from "../home_layout.js";
beforeEach(() => {
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
    document.querySelector(".home-empty-module").click();
    const add = [...document.querySelectorAll("#home-module-options button")].find((button) => button.textContent.startsWith("Ball Arsenal"));
    expect(add.disabled).toBe(false); add.click();
    document.querySelector('[data-action="save"]').click();
    const link = document.querySelector('.home-shortcut[href="/ball_arsenal.html"]');
    expect(link.hidden).toBe(false);
    expect(document.querySelector('.home-shortcut[href="/stats.html"]').hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem("revmetrix:home-layout:v1:guest"))).toHaveLength(4);
});
