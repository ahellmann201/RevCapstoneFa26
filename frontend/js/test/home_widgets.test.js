import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../database.js", () => ({ request: vi.fn() }));
vi.mock("../game_persistence.js", () => ({ listAll: vi.fn() }));
import { request } from "../database.js";
import { listAll } from "../game_persistence.js";
import { renderHomeWidget } from "../home_widgets.js";
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); document.body.innerHTML = '<a href="/stats.html"></a>'; });
it("shows genuine statistics and keeps the full-page link", async () => {
    sessionStorage.setItem("authentication_token", "token");
    request.mockResolvedValue({ completed_games: 4, average_score: 180.5, highest_score: 220 });
    const node = document.querySelector("a"); renderHomeWidget(node, "stats", true);
    await vi.waitFor(() => expect(node.textContent).toContain("220"));
    expect(node.querySelectorAll(".home-widget-metric")).toHaveLength(3);
    expect(node.getAttribute("href")).toBe("/stats.html");
    renderHomeWidget(node, "stats", true);
    expect(request).toHaveBeenCalledOnce();
});
it("shows recent named games without translating or interpreting their names", async () => {
    sessionStorage.setItem("authentication_token", "token");
    listAll.mockResolvedValue([{ game_id: 1, nickname: "Older" }, { game_id: 9, nickname: "<Save>" }]);
    const node = document.querySelector("a"); renderHomeWidget(node, "games", true);
    await vi.waitFor(() => expect(node.querySelectorAll("li")).toHaveLength(2));
    expect(node.querySelector("li").textContent).toBe("<Save>");
    expect(node.querySelector("li").getAttribute("translate")).toBe("no");
    expect(node.querySelector("save")).toBeNull();
});
it("does not request private data for guests or replace compact mode with a late response", async () => {
    const node = document.querySelector("a"); renderHomeWidget(node, "stats", true);
    expect(request).not.toHaveBeenCalled(); expect(node.textContent).toContain("Log in");
    renderHomeWidget(node, "stats", false);
    sessionStorage.setItem("authentication_token", "token");
    let resolve; request.mockImplementation(() => new Promise(done => { resolve = done; }));
    renderHomeWidget(node, "stats", true); renderHomeWidget(node, "stats", false);
    resolve({ completed_games: 4 }); await Promise.resolve();
    expect(node.textContent).toBe("Stats");
});
it("shows a retry-through-full-page message on failure instead of invented statistics", async () => {
    sessionStorage.setItem("authentication_token", "token"); request.mockRejectedValue(new Error("Offline"));
    const node = document.querySelector("a"); renderHomeWidget(node, "stats", true);
    await vi.waitFor(() => expect(node.textContent).toContain("Could not load"));
    expect(node.querySelector(".home-widget-metric")).toBeNull();
});


it("shows only the chosen metrics in the chosen order and refreshes a changed selection", async () => {
    sessionStorage.setItem("authentication_token", "token");
    request.mockResolvedValue({ completed_games: 4, average_score: 180.5, highest_score: 220, invalid_games: 2, recent_games: [{ score: 195 }] });
    const node = document.querySelector("a");
    renderHomeWidget(node, "stats", true, ["latest_score", "invalid_games"]);
    await vi.waitFor(() => expect(node.querySelectorAll(".home-widget-metric")).toHaveLength(2));
    expect([...node.querySelectorAll(".home-widget-metric span")].map(el => el.textContent)).toEqual(["Latest Score", "Invalid Games"]);
    expect([...node.querySelectorAll(".home-widget-metric strong")].map(el => el.textContent)).toEqual(["195", "2"]);
    renderHomeWidget(node, "stats", true, ["average_score"]);
    await vi.waitFor(() => expect(node.querySelectorAll(".home-widget-metric")).toHaveLength(1));
    expect(node.textContent).toContain("Average Score");
    expect(node.textContent).not.toContain("Latest Score");
});
it("shows an unavailable value rather than zero when there is no latest completed game", async () => {
    sessionStorage.setItem("authentication_token", "token"); request.mockResolvedValue({ recent_games: [] });
    const node = document.querySelector("a"); renderHomeWidget(node, "stats", true, ["latest_score"]);
    await vi.waitFor(() => expect(node.querySelector(".home-widget-metric strong")?.textContent).toBe("—"));
});
