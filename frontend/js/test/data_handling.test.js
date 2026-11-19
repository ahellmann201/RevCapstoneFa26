import { beforeEach, expect, it, vi } from "vitest";
import { addPfpToContainer, parseDisplayName } from "../data_handling.js";
import * as Cache from "../cache.js";

beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '<div id="profile"></div>';
});

it("uses the full display name only when the preference is enabled", () => {
    expect(parseDisplayName("Taylor Bowler")).toBe("Taylor");
    Cache.setShowFullDisplayName(true);
    expect(parseDisplayName("Taylor Bowler")).toBe("Taylor Bowler");
});

it("renders a profile picture in the requested container", () => {
    addPfpToContainer("profile", "/uploads/profile.png");
    expect(document.querySelector("#profile img")).toMatchObject({
        src: expect.stringContaining("/uploads/profile.png"),
        id: "profile-picture",
    });
    expect(document.querySelector("#profile img").className).toBe("profile_picture");
});

it("replaces an existing profile picture instead of appending another", () => {
    addPfpToContainer("profile", "/first.png");
    addPfpToContainer("profile", "/second.png");
    expect(document.querySelectorAll("#profile img")).toHaveLength(1);
    expect(document.querySelector("#profile img").getAttribute("src")).toBe("/second.png");
});
