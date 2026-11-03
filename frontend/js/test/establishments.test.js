import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../api_client.js", () => ({ request: vi.fn() }));
vi.mock("../authentication.js", () => ({ getAuthToken: vi.fn() }));

import { request } from "../api_client.js";
import { getAuthToken } from "../authentication.js";

const saved = {
    establishment_id: 7, establishment_name: "Test House", lane_count: 24,
    address: "Main St", location_id: null, nickname: "Home", type: "Brunswick",
    phone: "555-0100", home_house: true, enabled: true,
};

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = readFileSync("frontend/establishments.html", "utf8");
    const dialog = document.getElementById("establishment-dialog");
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    vi.spyOn(window, "alert").mockImplementation(() => {});
});

it("does not load or save records while signed out", async () => {
    getAuthToken.mockReturnValue(null);
    await import("../establishments.js");
    document.getElementById("establishment-form").dispatchEvent(new Event("submit", { cancelable: true }));
    expect(request).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("Please log in to save establishments.");
});

it("loads saved records and updates the existing database record", async () => {
    getAuthToken.mockReturnValue("token");
    request.mockResolvedValueOnce([saved]).mockResolvedValueOnce(saved);
    await import("../establishments.js");
    document.querySelector(".establishment-card").click();
    expect(document.getElementById("establishment-nickname").value).toBe("Home");
    document.getElementById("establishment-form").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(document.getElementById("establishment-status").textContent).toBe("Test House updated."));
    expect(request).toHaveBeenLastCalledWith("/establishments/7", expect.objectContaining({ method: "PUT" }));
    const payload = JSON.parse(request.mock.calls[1][1].body);
    expect(payload).toMatchObject({ establishment_name: "Test House", home_house: true, nickname: "Home", lane_count: 24 });
    expect(payload).not.toHaveProperty("user_id");
});

it("creates a record only after the server accepts the save", async () => {
    getAuthToken.mockReturnValue("token");
    request.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Save failed"));
    await import("../establishments.js");
    document.getElementById("add-establishment").click();
    document.getElementById("establishment-name").value = "Test House";
    const form = document.getElementById("establishment-form");
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(window.alert).toHaveBeenCalledWith("Save failed"));
    expect(document.querySelectorAll(".establishment-card")).toHaveLength(0);
    request.mockResolvedValueOnce(saved);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(document.querySelectorAll(".establishment-card")).toHaveLength(1));
    expect(request).toHaveBeenLastCalledWith("/establishments", expect.objectContaining({ method: "POST" }));
});
