import { loadNavbar } from "./navbar.js";
import { request } from "./api_client.js";
import { getAuthToken } from "./authentication.js";

loadNavbar();

const records = [];
const locations = new Map();
const list = document.getElementById("archive-list");
const empty = document.getElementById("archives-empty");
const status = document.getElementById("archive-status");
const dialog = document.getElementById("unarchive-dialog");
const confirm = document.getElementById("confirm-unarchive");
const cancel = document.getElementById("cancel-unarchive");
const dialogStatus = document.getElementById("unarchive-status");
let selected = null;
let saving = false;

function render() {
    const archived = records.filter((record) => record.enabled === false || record.enabled === 0);
    empty.hidden = archived.length > 0;
    list.replaceChildren();
    for (const record of archived) {
        const item = document.createElement("li");
        const card = document.createElement("button");
        card.type = "button";
        card.className = "establishment-card";
        card.setAttribute("aria-label", `Unarchive ${record.event_name}`);
        card.setAttribute("aria-haspopup", "dialog");
        const heading = document.createElement("span");
        heading.className = "establishment-card-title";
        const name = document.createElement("span");
        name.className = "establishment-name";
        name.textContent = record.event_name;
        const action = document.createElement("span");
        action.className = "establishment-edit";
        action.textContent = "Unarchive";
        heading.append(name, action);
        card.append(heading);
        const time = record.start_time?.split(":");
        const start = time ? `${Number(time[0]) % 12 || 12}:${time[1]} ${Number(time[0]) >= 12 ? "PM" : "AM"}` : null;
        for (const [label, value] of [
            ["Nickname", record.nickname], ["Type", record.event_type],
            ["Location", locations.get(record.location_id)], ["Day", record.week_day],
            ["Start", start], ["Games per session", record.games_per_session],
        ]) {
            const detail = document.createElement("span");
            detail.className = "establishment-detail";
            detail.textContent = `${label}: ${value ?? "—"}`;
            card.append(detail);
        }
        card.addEventListener("click", () => {
            selected = record;
            dialogStatus.textContent = "";
            document.getElementById("unarchive-description").textContent = `Unarchive “${record.event_name}”? It will appear on your Events page again.`;
            dialog.showModal();
        });
        item.append(card);
        list.append(item);
    }
}
cancel.addEventListener("click", () => { if (!saving) dialog.close(); });
dialog.addEventListener("cancel", (event) => { if (saving) event.preventDefault(); });
confirm.addEventListener("click", async () => {
    if (saving || !selected) return;
    const record = selected;
    const payload = Object.fromEntries([
        "event_name", "event_type", "location_id", "nickname", "week_day", "start_time", "games_per_session",
    ].filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
    payload.enabled = true;
    saving = true;
    confirm.disabled = cancel.disabled = true;
    confirm.textContent = "Restoring…";
    dialogStatus.textContent = "";
    try {
        await request(`/events/${record.event_id}`, { method: "PUT", body: JSON.stringify(payload) });
        record.enabled = true;
        dialog.close();
        render();
        status.textContent = `${record.event_name} unarchived. It is available on the Events page.`;
        status.tabIndex = -1;
        status.focus();
    } catch (error) {
        dialogStatus.textContent = error.message;
    } finally {
        saving = false;
        confirm.disabled = cancel.disabled = false;
        confirm.textContent = "Unarchive";
    }
});
async function loadAll(path) {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
        const page = await request(`${path}?limit=100&offset=${offset}`);
        rows.push(...page);
        if (page.length < 100) return rows;
    }
}
if (!getAuthToken()) {
    empty.hidden = true;
    status.textContent = "Please log in to view archived events.";
} else {
    empty.hidden = true;
    status.textContent = "Loading archived events…";
    try {
        const [events, savedLocations] = await Promise.all([loadAll("/events"), loadAll("/locations")]);
        records.push(...events);
        for (const location of savedLocations) locations.set(location.location_id, location.location_name);
        status.textContent = "";
        render();
    } catch (error) {
        status.textContent = error.message;
    }
}
