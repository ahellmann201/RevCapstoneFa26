import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../data_handling.js", () => ({ addPfpToContainer: vi.fn() }));
vi.mock("../popups.js", () => ({ showMiniPopup: vi.fn() }));
vi.mock("../cache.js", () => ({
    setMainhand: vi.fn(),
    getShowFullDisplayName: vi.fn(() => false),
    setShowFullDisplayName: vi.fn(),
    setDisplayName: vi.fn(),
}));
vi.mock("../database.js", () => ({
    getCachedMainhand: vi.fn(),
    getCachedUsername: vi.fn(),
    getCachedDisplayNameBlank: vi.fn(),
    setDisplayName: vi.fn(),
}));

import * as Cache from "../cache.js";
import * as Database from "../database.js";
import { showMiniPopup } from "../popups.js";

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Database.getCachedMainhand.mockResolvedValue("both");
    Database.getCachedUsername.mockResolvedValue("taylor");
    Database.getCachedDisplayNameBlank.mockResolvedValue("Taylor B.");
    document.body.innerHTML = readFileSync("frontend/account_settings.html", "utf8");
});
afterEach(() => vi.unstubAllGlobals());

async function loadPage() {
    await import("../account_settings.js");
    await vi.waitFor(() => expect(document.getElementById("username-field").textContent).toContain("taylor"));
}

it("loads cached profile data and the stored mainhand selection", async () => {
    Database.getCachedMainhand.mockResolvedValue("left");
    await loadPage();

    expect(document.getElementById("display-name-field").value).toBe("Taylor B.");
    expect(document.getElementById("pfp-field-picture-container")).toBeTruthy();
    expect(Cache.setMainhand).toHaveBeenCalledWith("left");
    expect(document.getElementById("mainhand-selection").style.left).toBe("var(--left-hand-left)");
});

it.each([
    ["left", "left-hand", "var(--left-hand-left)"],
    ["both", "both-hands", "var(--both-hands-left)"],
    ["right", "right-hand", "var(--right-hand-left)"],
])("selects %s handedness from either selector row", async (hand, selectorId, offset) => {
    await loadPage();
    document.getElementById(selectorId).click();
    await vi.waitFor(() => expect(document.getElementById("mainhand-selection").style.left).toBe(offset));
    expect(Cache.setMainhand).toHaveBeenLastCalledWith(hand);
});

it("enables display-name saving only while the value differs from the loaded name", async () => {
    await loadPage();
    const field = document.getElementById("display-name-field");
    const save = document.getElementById("save-display-name");
    expect(save.disabled).toBe(true);

    field.value = "Taylor Bowler";
    field.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(false);
    field.value = "Taylor B.";
    field.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(true);
});

it("saves a changed display name only after the database accepts it", async () => {
    Database.setDisplayName.mockResolvedValue(true);
    await loadPage();
    const field = document.getElementById("display-name-field");
    const save = document.getElementById("save-display-name");
    field.value = "Taylor Bowler";
    field.dispatchEvent(new Event("input"));
    save.click();

    await vi.waitFor(() => expect(showMiniPopup).toHaveBeenCalledWith("Successfully set display name to Taylor Bowler"));
    expect(Database.setDisplayName).toHaveBeenCalledWith("Taylor Bowler");
    expect(Cache.setDisplayName).toHaveBeenCalledWith("Taylor Bowler");
    expect(save.disabled).toBe(true);
});

it("keeps an unsaved value editable when saving fails and cancel restores the cached value", async () => {
    Database.setDisplayName.mockResolvedValue(false);
    await loadPage();
    const field = document.getElementById("display-name-field");
    const save = document.getElementById("save-display-name");
    field.value = "Unsaved";
    field.dispatchEvent(new Event("input"));
    save.click();
    await vi.waitFor(() => expect(Database.setDisplayName).toHaveBeenCalledOnce());
    expect(save.disabled).toBe(false);
    expect(showMiniPopup).not.toHaveBeenCalled();

    document.getElementById("cancel-display-name").click();
    await vi.waitFor(() => expect(field.value).toBe("Taylor B."));
    expect(save.disabled).toBe(true);
});

it("persists the full-name display preference when the toggle changes", async () => {
    Cache.getShowFullDisplayName.mockReturnValue(true);
    await loadPage();
    const toggle = document.getElementById("display-name-full-toggle");
    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(Cache.setShowFullDisplayName).toHaveBeenCalledWith(false);
});
