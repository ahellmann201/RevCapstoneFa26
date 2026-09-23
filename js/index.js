import { loadNavbar } from "./navbar.js";
import Event from "./event.js"
import { getAuthToken } from "./authentication.js";
import { getDisplayName } from "./requests.js";
import { parseDisplayName } from "./dataHandling.js"
loadNavbar();

function loadWelcomeMessage(name = "Guest") {
    const welcomeMessageElement = document.getElementById("welcome-message");
    if (getAuthToken() != null) {
        name = parseDisplayName(getDisplayName());
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

function pageLoad() {
    loadWelcomeMessage();
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
document.getElementById("start-game-button").addEventListener("click", startGame);

export function scheduleEvent() {
    window.location.href = "/schedule_event.html"
}
export function startGame() {
    alert("This should go to a start game page")
}