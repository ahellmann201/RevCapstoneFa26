import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../game_persistence.js", () => ({ listAll: vi.fn() }));
vi.mock("../authentication.js", () => ({ getAuthToken: vi.fn() }));
import { listAll } from "../game_persistence.js";
import { getAuthToken } from "../authentication.js";
import { loadWeeklyEvents } from "../weekly_events.js";
beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = readFileSync("frontend/index.html", "utf8");
});
it("leaves the week empty without fetching for guests", async () => {
    getAuthToken.mockReturnValue(null);
    await loadWeeklyEvents();
    expect(listAll).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".week-day")).toHaveLength(7);
    expect(document.querySelectorAll(".week-event")).toHaveLength(0);
});
it("places active events on their weekday in time order and excludes hidden records", async () => {
    getAuthToken.mockReturnValue("token");
    const event = { event_name: "Evening", week_day: "Monday", start_time: "18:00", enabled: true };
    listAll.mockResolvedValue([event, { ...event, event_name: "Morning", start_time: "09:00" }, { ...event, enabled: false }, { ...event, event_type: "SystemUnassigned" }, { ...event, week_day: null }]);
    await loadWeeklyEvents();
    expect(listAll).toHaveBeenCalledWith("/events");
    expect([...document.querySelectorAll(".week-event h4")].map((el) => el.textContent)).toEqual(["Morning", "Evening"]);
    expect(document.querySelector("time").textContent).toBe("9:00 AM");
    expect(document.querySelectorAll(".day-empty")).toHaveLength(6);
});

it("matches stored weekday values after the displayed heading is translated", async () => {
    getAuthToken.mockReturnValue("token");
    const monday = document.querySelector(".week-day h3");
    monday.dataset.i18n = "Monday";
    monday.textContent = "Lunes";
    listAll.mockResolvedValue([{ event_name: "League", week_day: "Monday", start_time: "18:00", enabled: true }]);
    await loadWeeklyEvents();
    expect(document.querySelector(".week-event h4").textContent).toBe("League");
});
