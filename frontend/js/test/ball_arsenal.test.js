import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../database.js", () => ({
    createBallForCurrentUser: vi.fn(),
    deleteBallForCurrentUser: vi.fn(),
    getCachedBalls: vi.fn(),
}));
vi.mock("../popups.js", () => ({
    createBallPopup: vi.fn(),
    createBallFilterPopup: vi.fn(),
    createDeleteBallPopup: vi.fn(),
    openBallPopup: vi.fn(),
    openBallFilterPopup: vi.fn(),
    openDeleteBallPopup: vi.fn(),
    showMiniPopup: vi.fn(),
}));

import { createBallForCurrentUser, deleteBallForCurrentUser, getCachedBalls } from "../database.js";
import {
    createBallFilterPopup, createBallPopup, createDeleteBallPopup,
    openBallFilterPopup, openBallPopup, openDeleteBallPopup, showMiniPopup,
} from "../popups.js";

const alpha = { ball_id: 1, ball_name: "Alpha", color: "red", weight: 15, core_type: "Symmetric" };
const beta = { ball_id: 2, ball_name: "Beta", color: "blue", weight: 14, core_type: "Asymmetric" };
let addBallAction;
let filterBallAction;
let deleteBallAction;

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    document.body.innerHTML = readFileSync("frontend/ball_arsenal.html", "utf8");
    addBallAction = null;
    filterBallAction = null;
    deleteBallAction = null;
    createBallPopup.mockImplementation((action) => { addBallAction = action; });
    createBallFilterPopup.mockImplementation((action) => { filterBallAction = action; });
    createDeleteBallPopup.mockImplementation((action) => { deleteBallAction = action; });
    getCachedBalls.mockResolvedValue([alpha, beta]);
    vi.stubGlobal("requestAnimationFrame", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

async function loadPage() {
    await import("../ball_arsenal.js");
    await vi.waitFor(() => expect(document.querySelectorAll("ball-list-item")).toHaveLength(2));
}

it("shows an empty state and keeps the add action available", async () => {
    getCachedBalls.mockResolvedValue([]);
    await import("../ball_arsenal.js");
    await vi.waitFor(() => expect(document.querySelector(".no_balls_container")).not.toBeNull());
    document.getElementById("no-balls-add-button").click();
    expect(openBallPopup).toHaveBeenCalledOnce();
});

it("renders balls, expands one item at a time, and syncs name edits", async () => {
    await loadPage();
    const items = [...document.querySelectorAll("ball-list-item")];
    expect(items.map((item) => item.querySelector(".ball_name").value)).toEqual(["Alpha", "Beta"]);
    expect(items[0].querySelector(".ball_details").textContent).toContain("Weight: 15 lbs");
    items[0].querySelector(".ball_expand_button").click();
    expect(items[0].querySelector(".ball_details").hidden).toBe(false);
    items[1].querySelector(".ball_expand_button").click();
    expect(items[0].querySelector(".ball_details").hidden).toBe(true);
    expect(items[1].querySelector(".ball_expand_button").getAttribute("aria-expanded")).toBe("true");

    const name = items[1].querySelector(".ball_name");
    name.value = "Beta Prime";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    expect(items[1].getAttribute("name")).toBe("Beta Prime");
});

it("searches after the debounce and expands the selected suggestion", async () => {
    getCachedBalls.mockResolvedValueOnce([alpha, beta]).mockResolvedValueOnce([beta]);
    await loadPage();
    const search = document.getElementById("ball-search");
    search.value = "Bet";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector("#ball-search-suggestions button")).not.toBeNull());
    expect(getCachedBalls).toHaveBeenLastCalledWith({ name_contains: "Bet" });

    document.querySelector("#ball-search-suggestions button").click();
    const selected = document.querySelector('ball-list-item[data-ball-id="2"]');
    expect(search.value).toBe("Beta");
    expect(document.getElementById("ball-search-suggestions").hidden).toBe(true);
    expect(selected.querySelector(".ball_details").hidden).toBe(false);

    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll("ball-list-item")).toHaveLength(2));
});

it("filters the arsenal and passes active filters when reopening the filter dialog", async () => {
    await loadPage();
    const filters = { weight_min: 15 };
    getCachedBalls.mockResolvedValueOnce([alpha]);
    await filterBallAction(filters);
    expect(getCachedBalls).toHaveBeenLastCalledWith(filters);
    expect(document.querySelectorAll("ball-list-item")).toHaveLength(1);
    document.getElementById("filter-ball-button").click();
    expect(openBallFilterPopup).toHaveBeenCalledWith(filters);
    expect(document.getElementById("ball-list-container").scrollTop).toBe(0);
});

it("adds trimmed ball details and refreshes the list after a successful save", async () => {
    await loadPage();
    const created = { ...alpha, ball_id: 3, ball_name: "New Ball" };
    getCachedBalls.mockResolvedValue([alpha, beta, created]);
    createBallForCurrentUser.mockResolvedValue(created);
    document.getElementById("add-ball-button").click();
    expect(openBallPopup).toHaveBeenCalledOnce();

    await addBallAction({ ball_name: "  New Ball  ", color: "purple", core_type: "Symmetric", weight: "16" });
    expect(createBallForCurrentUser).toHaveBeenCalledWith({
        ball_name: "New Ball", color: "purple", core_type: "Symmetric", weight: 16,
    });
    await vi.waitFor(() => expect(document.querySelectorAll("ball-list-item")).toHaveLength(3));
    expect(showMiniPopup).toHaveBeenCalledWith("Ball added to your arsenal");
});

it("opens deletion confirmation and refreshes after deleting a ball", async () => {
    deleteBallForCurrentUser.mockResolvedValue(null);
    await loadPage();
    getCachedBalls.mockResolvedValue([]);
    document.querySelector(".ball_delete_button").click();
    expect(openDeleteBallPopup).toHaveBeenCalledWith({ ball_id: "1", ball_name: "Alpha" });

    await deleteBallAction(alpha);
    await vi.waitFor(() => expect(document.querySelector("ball-list-item")).toBeNull());
    expect(deleteBallForCurrentUser).toHaveBeenCalledWith(1);
    expect(showMiniPopup).toHaveBeenCalledWith("Alpha deleted");
    expect(document.querySelector(".no_balls_container")).not.toBeNull();
});
