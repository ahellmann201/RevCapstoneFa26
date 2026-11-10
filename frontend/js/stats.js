/** Loads and filters the authenticated user's completed game statistics. */
import { loadNavbar } from "./navbar.js";
import { request } from "./api_client.js";

loadNavbar();

const completedGames = document.getElementById("completed-games");
const averageScore = document.getElementById("average-score");
const highestScore = document.getElementById("highest-score");
const invalidGames = document.getElementById("invalid-games");
const recentGames = document.getElementById("recent-games");
const recentCount = document.getElementById("recent-count");
const status = document.getElementById("stats-status");
const filters = document.getElementById("game-filters");
const dateFrom = document.getElementById("date-from");
const dateTo = document.getElementById("date-to");
const scoreMin = document.getElementById("score-min");
const scoreMax = document.getElementById("score-max");
const sortBy = document.getElementById("game-sort");
const clearFilters = document.getElementById("clear-filters");
let allGames = null;

function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    }).format(date);
}

function dateKey(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function dateDescending(left, right) {
    const leftTime = left.played_at ? new Date(left.played_at).getTime() : Number.NaN;
    const rightTime = right.played_at ? new Date(right.played_at).getTime() : Number.NaN;
    const leftHasDate = Number.isFinite(leftTime);
    const rightHasDate = Number.isFinite(rightTime);
    if (leftHasDate && rightHasDate && leftTime !== rightTime) return rightTime - leftTime;
    if (leftHasDate && !rightHasDate) return -1;
    if (!leftHasDate && rightHasDate) return 1;
    return right.game_id - left.game_id;
}

function dateAscending(left, right) {
    const leftTime = left.played_at ? new Date(left.played_at).getTime() : Number.NaN;
    const rightTime = right.played_at ? new Date(right.played_at).getTime() : Number.NaN;
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return dateDescending(left, right);
    return leftTime - rightTime || left.game_id - right.game_id;
}

function filteredGames() {
    const from = dateFrom.value;
    const to = dateTo.value;
    const minimum = scoreMin.value === "" ? null : Number(scoreMin.value);
    const maximum = scoreMax.value === "" ? null : Number(scoreMax.value);
    const games = allGames.filter((game) => {
        const date = dateKey(game.played_at);
        if (from && (!date || date < from)) return false;
        if (to && (!date || date > to)) return false;
        if (minimum !== null && game.score < minimum) return false;
        if (maximum !== null && game.score > maximum) return false;
        return true;
    });

    switch (sortBy.value) {
        case "date-asc":
            games.sort(dateAscending);
            break;
        case "score-desc":
            games.sort((left, right) => right.score - left.score || dateDescending(left, right));
            break;
        case "score-asc":
            games.sort((left, right) => left.score - right.score || dateDescending(left, right));
            break;
        default:
            games.sort(dateDescending);
    }
    return games;
}

function renderGames() {
    if (!allGames) return;
    const games = filteredGames();
    recentGames.replaceChildren();
    for (const game of games) {
        const row = document.createElement("li");
        row.className = "recent-game";

        const link = document.createElement("a");
        link.className = "recent-game-link";
        link.href = `/game_info.html?game_id=${encodeURIComponent(game.game_id)}`;
        link.setAttribute("aria-label", `View game played ${formatDate(game.played_at)}, score ${game.score}`);

        const date = document.createElement("time");
        date.className = "game-date";
        date.textContent = formatDate(game.played_at);
        if (game.played_at) date.dateTime = game.played_at;

        const score = document.createElement("span");
        score.className = "game-score";
        score.textContent = String(game.score);
        score.setAttribute("aria-label", `Score ${game.score}`);

        link.append(date, score);
        row.append(link);
        recentGames.append(row);
    }

    recentCount.textContent = `Showing ${games.length} of ${allGames.length}`;
    status.hidden = games.length > 0;
    if (games.length > 0) return;
    status.textContent = allGames.length === 0
        ? "No completed games yet. Finish a game to see your stats here."
        : "No games match these filters.";
}

async function loadStats() {
    try {
        const games = [];
        for (let offset = 0; ; offset += 100) {
            const stats = await request(`/statistics?recent_limit=100&recent_offset=${offset}`);
            if (offset === 0) {
                completedGames.textContent = String(stats.completed_games ?? 0);
                averageScore.textContent = stats.average_score == null ? "—" : Number(stats.average_score).toFixed(2);
                highestScore.textContent = stats.highest_score == null ? "—" : String(stats.highest_score);
                invalidGames.textContent = String(stats.invalid_games ?? 0);
            }
            const page = Array.isArray(stats.recent_games) ? stats.recent_games : [];
            games.push(...page);
            if (page.length < 100) break;
        }
        allGames = games;
        renderGames();
    } catch (error) {
        status.textContent = error.message || "Stats could not be loaded. Please try again later.";
        status.hidden = false;
    }
}

filters.addEventListener("input", renderGames);
filters.addEventListener("change", renderGames);
clearFilters.addEventListener("click", () => {
    filters.reset();
    sortBy.value = "date-desc";
    renderGames();
});

loadStats();
