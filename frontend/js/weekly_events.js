import { listAll } from "./game_persistence.js";
import { getAuthToken } from "./authentication.js";

export async function loadWeeklyEvents() {
    const days = [...document.querySelectorAll(".week-day")];
    const status = document.getElementById("week-status");
    for (const day of days) day.querySelector(".day-events").replaceChildren();
    status.textContent = "";
    if (!getAuthToken()) return;
    status.textContent = "Loading…";
    try {
        const events = await listAll("/events");
        if (!getAuthToken()) { status.textContent = ""; return; }
        for (const day of days) {
            const heading = day.querySelector("h3");
            const weekday = heading.dataset.i18n || heading.textContent;
            const container = day.querySelector(".day-events");
            const scheduled = events.filter((event) => event.week_day === weekday
                && event.enabled !== false && event.enabled !== 0
                && event.event_type !== "SystemUnassigned")
                .sort((a, b) => (a.start_time || "99:99").localeCompare(b.start_time || "99:99")
                    || a.event_name.localeCompare(b.event_name));
            for (const event of scheduled) {
                const card = document.createElement("article");
                card.className = "week-event";
                const time = document.createElement(event.start_time ? "time" : "span");
                if (event.start_time) {
                    const [hours, minutes] = event.start_time.split(":");
                    time.dateTime = event.start_time;
                    time.textContent = `${Number(hours) % 12 || 12}:${minutes} ${Number(hours) >= 12 ? "PM" : "AM"}`;
                } else time.textContent = "Time not set";
                const name = document.createElement("h4");
                name.textContent = event.event_name;
                card.append(time, name);
                container.append(card);
            }
            if (!scheduled.length) {
                const empty = document.createElement("p");
                empty.className = "day-empty";
                empty.textContent = "No events";
                container.append(empty);
            }
        }
        status.textContent = "";
    } catch {
        status.textContent = getAuthToken() ? "Could not load events." : "";
    }
}
