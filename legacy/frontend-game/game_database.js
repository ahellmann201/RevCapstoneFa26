import { request } from "./api_client.js";

const heading = document.querySelector(".game_heading");

const panel = document.createElement("section");
panel.className = "lane_panel";

const status = document.createElement("p");
status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite");

const startButton = document.createElement("button");
startButton.type = "button";
startButton.className = "next_button";
startButton.textContent = "Start saved game";

panel.append(status, startButton);
heading.after(panel);

let eventId = null;
let sessionId = null;
let savedGame = null;
let busy = false;

export function getSavedGame() {
    return savedGame;
}

function showSavedGame(game) {
    savedGame = game;

    status.textContent =
        `Connected to saved game #${game.game_id}.`;

    startButton.hidden = true;

    const badge = document.querySelector(".game_badge");

    if (badge) {
        badge.textContent = `Game ${game.game_number}`;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("game_id", game.game_id);
    window.history.replaceState(null, "", url);

    window.dispatchEvent(new Event("saved-game-ready"));
}

async function startGame() {
    if (busy || savedGame) return;

    busy = true;
    startButton.disabled = true;
    status.textContent = "Creating your game…";

    try {
        await request("/auth/me");

        if (eventId === null) {
            const event = await request("/events", {
                method: "POST",
                body: JSON.stringify({
                    event_name:
                        `Practice ${new Date().toLocaleString()}`,
                    event_type: "Practice",
                    location_id: null,
                }),
            });

            eventId = event.event_id;
        }

        if (sessionId === null) {
            const session = await request("/sessions", {
                method: "POST",
                body: JSON.stringify({
                    event_id: eventId,
                    establishment_id: null,
                    date_time: new Date().toISOString(),
                    opponent: null,
                    score: null,
                    record: null,
                }),
            });

            sessionId = session.session_id;
        }

        const game = await request("/games", {
            method: "POST",
            body: JSON.stringify({
                session_id: sessionId,
                game_number: 1,
                lane_number: null,
                game_score: null,
                game_result: null,
            }),
        });

        showSavedGame(game);
    } catch (error) {
        status.textContent =
            `Could not start game: ${error.message}`;
    } finally {
        busy = false;
        startButton.disabled = false;
    }
}

async function initialize() {
    const gameId = new URL(
        window.location.href,
    ).searchParams.get("game_id");

    if (gameId !== null) {
        startButton.hidden = true;
        status.textContent = "Loading your saved game…";

        try {
            if (!/^[1-9]\d*$/.test(gameId)) {
                throw new Error("Invalid game ID.");
            }

            const game = await request(
                `/games/${encodeURIComponent(gameId)}`,
            );

            showSavedGame(game);
        } catch (error) {
            status.textContent =
                `Could not load saved game: ${error.message}`;
        }

        return;
    }

    status.textContent =
        "Start a saved game to record frames and shots.";

    startButton.addEventListener("click", startGame);
}

initialize();
