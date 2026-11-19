/** Initializes the home page navbar and personalized welcome message. */
import { loadNavbar } from "./navbar.js";
import { initHomeLayout } from "./home_layout.js";
import { getActiveGameId, getGameState } from "./cache.js";
import { loadWeeklyEvents } from "./weekly_events.js";
import Event from "./objects/event.js"
import { getAuthToken } from "./authentication.js";
import { getCachedDisplayName } from "./database.js";
import { parseDisplayName } from "./data_handling.js"
import "./popups.js";
loadNavbar();
initHomeLayout();

async function loadWelcomeMessage(name = "Guest") {
    const welcomeMessageElement = document.getElementById("welcome-message");
    if (getAuthToken() != null) {
        name = parseDisplayName(await getCachedDisplayName());
    }
    welcomeMessageElement.textContent = pickRandomWelcomeMessage(name);
}

function pickRandomWelcomeMessage(name) {
    //I got most of these from ChatGPT
    const welcomeMessages = [
        `Welcome, ${name}!`,
        `Good to see you, ${name}!`,
        `Ready to bowl, ${name}?`,
        `Let's roll, ${name}!`,
        `Hope you're feeling lucky today, ${name}!`,
        `The lanes are calling, ${name}.`,
        `Let's see some strikes, ${name}!`,
        `Time to hit the lanes, ${name}!`,
        `May your strikes be plentiful, ${name}.`,
        `Let's knock 'em down, ${name}!`,

        `It's a great day for bowling!`,
        `Ready to knock down some pins?`,
        `Time to bowl!`,
        `Grab your ball and let's go!`,
        `The lanes are calling.`,
        `Your next strike is waiting.`,
        `Keep calm and bowl on.`,
        `Spare me the small talk. Let's bowl.`,
        `Strike up some fun!`,
        `May the pins be ever in your favor.`,
        `Got a spare minute? Go bowling.`,
        `Today's forecast: 100% chance of strikes.`,
        `Warning: excessive bowling may occur.`,
        `Just one more game...`,
        `The pins aren't going to knock themselves down.`
    ];
    
    const event = checkForUpcomingEvent();
    if (event == -1) return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    else {
        let location = event.location;
        let date = event.date.toLocaleString();
        let message = `You have an event at ${location} on ${date}`;
        return message;
    }
}

const requestedNewGame = new URLSearchParams(window.location.search).get("start_game") === "1";
let weeklyGame = false;
let forceNewGame = false;
let pendingEventChoice = null;

function pageLoad() {
    loadWelcomeMessage();
    loadWeeklyEvents((eventId) => { void startGame(eventId); });
    if (requestedNewGame) void startGame();
}

function checkForUpcomingEvent() {
    const event = new Event({beyondAWeek: true}); //this should be a request from the db for the closest upcoming event
    const today = new Date();

    const timeToEvent = event.date.getDate() - today.getDate();

    if (timeToEvent <= 7 && timeToEvent >= 0) return event;
    else return -1;
}

document.addEventListener("DOMContentLoaded", pageLoad);

document.getElementById("schedule-event-button").addEventListener("click", scheduleEvent);
document.getElementById("start-game-button").addEventListener("click", () => { void startGame(); });

export function scheduleEvent() {
    window.location.href = "/events.html"
}

const gameSetupDialog = document.querySelector("game-setup-dialog");
gameSetupDialog.addEventListener("game-setup-submit", ({ detail }) => {
    sessionStorage.setItem("pendingGameSetup", JSON.stringify({
        eventId: detail.eventId,
        establishmentId: detail.establishmentId,
        sessionId: detail.sessionId,
        sessionEventId: detail.sessionEventId,
        gameNumber: detail.gameNumber,
    }));
    window.location.href = forceNewGame || requestedNewGame || weeklyGame ? "/game.html?new=1" : "/game.html";
});

export async function startGame(selectedEventId = null, startNew = false) {
    const activeId = getActiveGameId();
    const active = activeId && getGameState(activeId);
    if (!startNew && active && !active.finishedAt) {
        pendingEventChoice = selectedEventId;
        document.getElementById("resume-game-dialog").showModal();
        return;
    }
    forceNewGame = startNew || !active || Boolean(active.finishedAt);
    weeklyGame = selectedEventId !== null;
    if (!getAuthToken()) {
        sessionStorage.removeItem("pendingGameSetup");
        window.location.href = forceNewGame || requestedNewGame ? "/game.html?new=1" : "/game.html";
        return;
    }
    await gameSetupDialog.showSetup({ eventId: selectedEventId });
}

document.getElementById("continue-game-choice").addEventListener("click", () => {
    sessionStorage.removeItem("pendingGameSetup");
    document.getElementById("resume-game-dialog").close();
    window.location.href = "/game.html";
});
document.getElementById("new-game-choice").addEventListener("click", () => {
    document.getElementById("resume-game-dialog").close();
    void startGame(pendingEventChoice, true);
});
document.getElementById("cancel-resume-game").addEventListener("click", () => {
    document.getElementById("resume-game-dialog").close();
});
