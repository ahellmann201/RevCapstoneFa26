import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../database.js", () => ({ request: vi.fn() }));
import { request } from "../database.js";

const games = [
    { game_id: 1, score: 170, played_at: "2026-01-01T12:00:00Z" },
    { game_id: 2, score: 210, played_at: "2026-02-01T12:00:00Z" },
    { game_id: 3, score: 210, played_at: "2026-03-01T12:00:00Z" },
    { game_id: 4, score: 95, played_at: null },
];

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    document.body.innerHTML = readFileSync("frontend/stats.html", "utf8");
    request.mockResolvedValue({
        completed_games: 4, average_score: 171.25, highest_score: 210,
        invalid_games: 2, recent_games: games,
    });
});

async function loadPage() {
    await import("../stats.js");
    await vi.waitFor(() => expect(document.querySelectorAll(".recent-game")).toHaveLength(4));
}

const shownIds = () => [...document.querySelectorAll(".recent-game-link")]
    .map((link) => new URL(link.href).searchParams.get("game_id"));

it("renders all-time totals and newest-first game links", async () => {
    await loadPage();
    expect(request).toHaveBeenCalledWith("/statistics?recent_limit=100&recent_offset=0");
    expect(document.getElementById("completed-games").textContent).toBe("4");
    expect(document.getElementById("average-score").textContent).toBe("171.25");
    expect(document.getElementById("highest-score").textContent).toBe("210");
    expect(document.getElementById("invalid-games").textContent).toBe("2");
    expect(shownIds()).toEqual(["3", "2", "1", "4"]);
    expect(document.getElementById("recent-count").textContent).toBe("Showing 4 of 4");
    expect(document.getElementById("stats-status").hidden).toBe(true);
});

it("filters by inclusive date and score ranges and orders by the selected sort", async () => {
    await loadPage();
    const from = document.getElementById("date-from");
    const to = document.getElementById("date-to");
    const min = document.getElementById("score-min");
    const max = document.getElementById("score-max");
    from.value = "2026-02-01";
    to.value = "2026-03-01";
    min.value = "200";
    max.value = "210";
    document.getElementById("game-filters").dispatchEvent(new Event("input", { bubbles: true }));
    expect(shownIds()).toEqual(["3", "2"]);

    document.getElementById("game-sort").value = "score-asc";
    document.getElementById("game-filters").dispatchEvent(new Event("change", { bubbles: true }));
    expect(shownIds()).toEqual(["3", "2"]);
    expect(document.getElementById("recent-count").textContent).toBe("Showing 2 of 4");
});

it("supports oldest-first and score-descending sorts and clears all filters", async () => {
    await loadPage();
    const sort = document.getElementById("game-sort");
    sort.value = "date-asc";
    sort.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shownIds()).toEqual(["1", "2", "3", "4"]);
    sort.value = "score-desc";
    sort.dispatchEvent(new Event("change", { bubbles: true }));
    expect(shownIds()).toEqual(["3", "2", "1", "4"]);

    document.getElementById("score-min").value = "250";
    document.getElementById("game-filters").dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.getElementById("stats-status").textContent).toBe("No games match these filters.");
    expect(document.getElementById("stats-status").hidden).toBe(false);
    document.getElementById("clear-filters").click();
    expect(document.getElementById("score-min").value).toBe("");
    expect(sort.value).toBe("date-desc");
    expect(shownIds()).toEqual(["3", "2", "1", "4"]);
});

it("shows a distinct empty state when the account has no completed games", async () => {
    request.mockResolvedValue({ completed_games: 0, average_score: null, highest_score: null, invalid_games: 0, recent_games: [] });
    await import("../stats.js");
    await vi.waitFor(() => expect(document.getElementById("stats-status").hidden).toBe(false));
    expect(document.getElementById("average-score").textContent).toBe("—");
    expect(document.getElementById("highest-score").textContent).toBe("—");
    expect(document.getElementById("stats-status").textContent).toContain("No completed games yet");
});

it("reports a failed statistics request", async () => {
    request.mockRejectedValue(new Error("Stats unavailable"));
    await import("../stats.js");
    await vi.waitFor(() => expect(document.getElementById("stats-status").textContent).toBe("Stats unavailable"));
    expect(document.getElementById("stats-status").hidden).toBe(false);
});
