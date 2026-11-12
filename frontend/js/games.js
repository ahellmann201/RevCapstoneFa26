/** Lists the caller's saved games, including games still in progress. */
import { loadNavbar } from "./navbar.js";
import { getAuthToken } from "./authentication.js";
import { listAll } from "./game_persistence.js";
import { getActiveGameId, getGameState } from "./cache.js";
import { getLanguage } from "./language.js";

loadNavbar();
const list = document.getElementById("games-list");
const status = document.getElementById("games-status");
const search = document.getElementById("game-search");
const activeId = getActiveGameId();
const active = activeId && getGameState(activeId);
document.getElementById("resume-local-game").hidden = !active || active.gameFinished;
let games = [];
const sessions = new Map();
const events = new Map();

function dateLabel(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(getLanguage(), { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function render() {
    const query = search.value.trim().toLocaleLowerCase();
    list.replaceChildren();
    for (const game of games) {
        const session = sessions.get(game.session_id);
        const event = events.get(session?.event_id);
        const name = event?.event_name || "Unassigned game";
        const date = dateLabel(session?.date_time);
        if (!`Game #${game.game_id} ${game.game_number} ${name} ${date}`.toLocaleLowerCase().includes(query)) continue;
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.className = "saved-game-link";
        link.href = `/game.html?game_id=${encodeURIComponent(game.game_id)}`;
        const title = document.createElement("h2");
        title.textContent = `Game #${game.game_id}`;
        const context = document.createElement("p");
        context.textContent = `${name} · Game ${game.game_number}`;
        const played = document.createElement("time");
        played.textContent = date;
        if (session?.date_time) played.dateTime = session.date_time;
        const action = document.createElement("strong");
        action.textContent = "View / continue";
        link.append(title, context, played, action);
        item.append(link);
        list.append(item);
    }
    status.textContent = list.children.length ? "" : games.length ? "No games match your search." : "No saved games yet. Start a game to get going.";
}
search.addEventListener("input", render);
window.addEventListener("languagechange", render);

async function loadGames() {
    if (!getAuthToken()) {
        status.textContent = "Log in to see your saved games. You can also start a game as a guest.";
        search.disabled = true;
        return;
    }
    try {
        const [savedGames, savedSessions, savedEvents] = await Promise.all([
            listAll("/games"), listAll("/sessions"), listAll("/events"),
        ]);
        games = savedGames.sort((a, b) => b.game_id - a.game_id);
        for (const session of savedSessions) sessions.set(session.session_id, session);
        for (const event of savedEvents) events.set(event.event_id, event);
        render();
    } catch {
        status.textContent = "Could not load your games. Refresh to try again.";
    }
}
void loadGames();
