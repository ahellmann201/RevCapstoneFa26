import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../navbar.js", () => ({ loadNavbar: vi.fn() }));
vi.mock("../database.js", () => ({ getCachedBalls: vi.fn() }));
import { getCachedBalls } from "../database.js";

const balls = [
    { ball_id: 1, ball_name: "Alpha", weight: 15, core_type: "Symmetric" },
    { ball_id: 2, ball_name: "Bravo", weight: 14, core_type: "Asymmetric" },
    { ball_id: 3, ball_name: "Charlie", weight: 14, core_type: "Symmetric" },
];

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    document.body.innerHTML = readFileSync("frontend/compare_balls.html", "utf8");
    getCachedBalls.mockResolvedValue(balls);
});

async function loadPage() {
    await import("../compare_balls.js");
    await vi.waitFor(() => expect(document.querySelectorAll(".ball-choice")).toHaveLength(3));
}

const rowNames = () => [...document.querySelectorAll("#comparison-body th.row-header")]
    .map((cell) => cell.textContent);

it("offers an empty state when the arsenal contains no balls", async () => {
    getCachedBalls.mockResolvedValue([]);
    await import("../compare_balls.js");
    await vi.waitFor(() => expect(document.getElementById("compare-status").textContent).toContain("arsenal is empty"));
    expect(document.querySelectorAll(".ball-choice")).toHaveLength(0);
    expect(document.getElementById("comparison-results").hidden).toBe(true);
});

it("reports a loading error without presenting it as an empty arsenal", async () => {
    getCachedBalls.mockRejectedValue(new Error("offline"));
    await import("../compare_balls.js");
    await vi.waitFor(() => expect(document.getElementById("compare-status").textContent).toContain("Could not load your balls"));
    expect(document.getElementById("comparison-results").hidden).toBe(true);
});

it("compares any selected balls and shows weight and core details", async () => {
    await loadPage();
    expect(getCachedBalls).toHaveBeenCalledOnce();
    expect(document.getElementById("compare-status").textContent).toContain("Select one or more");
    document.querySelector('[data-ball-id="1"]').click();
    document.querySelector('[data-ball-id="2"]').click();

    expect(document.getElementById("comparison-results").hidden).toBe(false);
    expect(rowNames()).toEqual(["Alpha", "Bravo"]);
    expect(document.querySelector("#comparison-body").textContent).toContain("15 lb");
    expect(document.querySelector("#comparison-body").textContent).toContain("Asymmetric");
    expect(document.querySelector('[data-ball-id="1"]').getAttribute("aria-pressed")).toBe("true");
});

it("sorts by weight in both directions and allows a row to be deselected", async () => {
    await loadPage();
    for (const choice of document.querySelectorAll(".ball-choice")) choice.click();
    document.querySelector('[data-sort-key="weight"]').click();
    expect(rowNames()).toEqual(["Bravo", "Charlie", "Alpha"]);
    expect(document.querySelector('[data-sort-key="weight"]').closest("th").getAttribute("aria-sort")).toBe("ascending");

    document.querySelector('[data-sort-key="weight"]').click();
    expect(rowNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(document.querySelector('[data-sort-key="weight"]').closest("th").getAttribute("aria-sort")).toBe("descending");

    document.querySelector('[aria-label="Deselect Bravo"]').click();
    expect(rowNames()).toEqual(["Alpha", "Charlie"]);
    expect(document.querySelector('[data-ball-id="2"]').getAttribute("aria-pressed")).toBe("false");
});

it("sorts names without case sensitivity and returns to the selection prompt when cleared", async () => {
    await loadPage();
    document.querySelector('[data-ball-id="3"]').click();
    document.querySelector('[data-ball-id="1"]').click();
    document.querySelector('[data-sort-key="name"]').click();
    expect(rowNames()).toEqual(["Alpha", "Charlie"]);

    document.querySelector('[aria-label="Deselect Alpha"]').click();
    document.querySelector('[aria-label="Deselect Charlie"]').click();
    expect(document.getElementById("comparison-results").hidden).toBe(true);
    expect(document.getElementById("compare-status").textContent).toContain("Select one or more");
});
