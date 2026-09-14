import { loadNavbar } from "./navbar.js";
import Event from "./event.js"
loadNavbar();



function loadWelcomeMessage(name = "Hake") {
    const welcomeMessageElement = document.getElementById("welcome-message");
    welcomeMessageElement.textContent = pickRandomWelcomeMessage(name);
}

function pickRandomWelcomeMessage(name) {
    const welcomeMessages = [
        `Welcome, ${name}!`, //THESE USE BACKTICKS (TILDE, WHATEVER YOU WANNA CALL THEM), VERY IMPORTANT
        `It's a great day for bowling!`
        ];
    
    const event = checkForUpcomingEvent(false);
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

function checkForUpcomingEvent(dontCheck = true) {
    if (dontCheck) return -1;
    const event = new Event(); //just a standin, we'll pull from the db on page load
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
    console.log("fisbduiry")
}
export function startGame() {
    alert("This should go to a start game page")
}