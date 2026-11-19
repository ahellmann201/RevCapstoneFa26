import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../database.js", () => ({ request: vi.fn() }));
import { request } from "../database.js";

function perfectGameData() {
    const frames = Array.from({ length: 10 }, (_, index) => ({
        frame_id: index + 1, game_id: 5, frame_number: index + 1,
    }));
    const shots = frames.flatMap((frame, index) => {
        const count = index === 9 ? 3 : 1;
        return Array.from({ length: count }, (_, shotIndex) => ({
            shot_id: `${index + 1}-${shotIndex + 1}`,
            frame_id: frame.frame_id,
            shot_number: shotIndex + 1,
            pin_leave: [],
            foul: false,
            comment: index === 0 ? "Pocket shot" : null,
        }));
    });
    return { frames, shots };
}

function mockGame({ frames, shots } = perfectGameData()) {
    request.mockImplementation(async (path) => {
        if (path === "/games/5") return { game_id: 5, game_number: 2, game_score: 300, session_id: 7, lane_number: 12 };
        if (path === "/frames?limit=100&offset=0") return frames;
        if (path === "/shots?limit=100&offset=0") return shots;
        if (path === "/statistics?recent_limit=1") return { completed_games: 8, average_score: 187.5, highest_score: 300 };
        if (path === "/sessions/7") return { session_id: 7, date_time: "2026-11-18T20:00:00Z", opponent: "Morgan" };
        throw new Error(`Unexpected request: ${path}`);
    });
}

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    document.body.innerHTML = readFileSync("frontend/game_info.html", "utf8");
    mockGame();
});
afterEach(() => vi.unstubAllGlobals());

async function loadPage(search = "?game_id=5") {
    vi.stubGlobal("window", { location: { search } });
    await import("../game_info.js");
}

it.each(["", "?game_id=abc"])("requires a numeric game ID for search %s", async (search) => {
    await loadPage(search);
    expect(document.getElementById("page-status").textContent).toContain("Select a completed game");
    expect(request).not.toHaveBeenCalled();
});

it("renders a valid perfect game, scorecard, shot details, and statistics", async () => {
    await loadPage();
    await vi.waitFor(() => expect(document.getElementById("game-detail").hidden).toBe(false));

    expect(document.getElementById("completed-games").textContent).toBe("8");
    expect(document.getElementById("average-score").textContent).toBe("187.50");
    expect(document.getElementById("highest-score").textContent).toBe("300");
    expect(document.querySelector(".detail-score").textContent).toContain("300");
    expect(document.querySelectorAll(".frame-card")).toHaveLength(10);
    expect(document.querySelectorAll(".roll-cell")).toHaveLength(12);
    expect(document.querySelector(".shot-leave").textContent).toContain("Pocket shot");
    expect(document.querySelector(".game-metrics").textContent).toContain("Opponent: Morgan");
    expect(document.getElementById("page-status").hidden).toBe(true);
});

it("explains when a game is still incomplete", async () => {
    const frames = Array.from({ length: 9 }, (_, index) => ({ frame_id: index + 1, game_id: 5, frame_number: index + 1 }));
    mockGame({ frames, shots: [] });
    await loadPage();
    await vi.waitFor(() => expect(document.getElementById("page-status").textContent).toContain("still in progress"));
    expect(document.getElementById("game-detail").hidden).toBe(true);
});

it("does not score malformed shot records as a completed game", async () => {
    const { frames, shots } = perfectGameData();
    shots[0].shot_number = 2;
    mockGame({ frames, shots });
    await loadPage();
    await vi.waitFor(() => expect(document.getElementById("page-status").textContent).toContain("invalid shot records"));
    expect(document.getElementById("game-detail").hidden).toBe(true);
});

it("shows the request error when a saved game's records cannot be loaded", async () => {
    request.mockRejectedValue(new Error("Permission denied"));
    await loadPage();
    await vi.waitFor(() => expect(document.getElementById("page-status").textContent).toBe("Permission denied"));
});
