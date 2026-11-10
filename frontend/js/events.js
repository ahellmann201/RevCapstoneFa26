import { loadNavbar } from "./navbar.js";
import { request } from "./api_client.js";
import { getAuthToken } from "./authentication.js";

loadNavbar();
const events = [];
const locations = new Map();
const establishments = new Map();
const list = document.getElementById("event-list");
const empty = document.getElementById("events-empty");
const dialog = document.getElementById("event-dialog");
const form = document.getElementById("event-form");
const apply = document.getElementById("apply-event");
const disableButton = document.getElementById("disable-event");
const disableDialog = document.getElementById("disable-event-dialog");
const confirmDisable = document.getElementById("confirm-disable-event");
const cancelDisable = document.getElementById("cancel-disable-event");
const disableStatus = document.getElementById("disable-event-status");
const status = document.getElementById("event-status");
const formStatus = document.getElementById("event-form-status");
const add = document.getElementById("add-event");
const games = form.elements.namedItem("games_per_session");
let editingId = null;
let saving = false;

function updateStepper() {
    document.getElementById("decrease-games").disabled = Number(games.value) <= 1;
    document.getElementById("increase-games").disabled = Number(games.value) >= 2147483647;
}
for (const [id, delta] of [["decrease-games", -1], ["increase-games", 1]]) {
    document.getElementById(id).addEventListener("click", () => {
        games.value = Math.min(2147483647, Math.max(1, (Number(games.value) || 1) + delta));
        updateStepper();
    });
}
games.addEventListener("input", updateStepper);

function openEditor(record = null) {
    editingId = record?.event_id ?? null;
    disableButton.hidden = !record;
    form.reset();
    form.elements.namedItem("event_name").setCustomValidity("");
    formStatus.textContent = "";
    if (record) {
        for (const [key, value] of Object.entries(record)) {
            const input = form.elements.namedItem(key);
            if (!input) continue;
            if (input.type === "checkbox") input.checked = Boolean(value);
            else input.value = value ?? "";
        }
        const select = document.getElementById("event-location");
        const match = [...establishments.values()].find((entry) => entry.location_id === record.location_id && record.location_id != null);
        if (match) select.value = `establishment:${match.establishment_id}`;
        else if (record.location_id != null) {
            const value = `location:${record.location_id}`;
            if (![...select.options].some((option) => option.value === value)) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = locations.get(record.location_id) || "Current location";
                select.append(option);
            }
            select.value = value;
        }
    }
    document.getElementById("event-dialog-title").textContent = record ? "Edit Event" : "Add Event";
    apply.textContent = record ? "Apply changes" : "Add";
    updateStepper();
    dialog.showModal();
}
add.addEventListener("click", () => openEditor());
for (const id of ["close-event", "cancel-event"]) {
    document.getElementById(id).addEventListener("click", () => { if (!saving) dialog.close(); });
}
dialog.addEventListener("cancel", (event) => { if (saving) event.preventDefault(); });
dialog.addEventListener("close", () => { editingId = null; });

function displayTime(value) {
    if (!value) return "—";
    const [hour, minute] = value.split(":");
    return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? "PM" : "AM"}`;
}
function render() {
    const activeEvents = events.filter((record) => record.event_type !== "SystemUnassigned" && record.enabled !== false && record.enabled !== 0);
    empty.hidden = activeEvents.length > 0;
    list.replaceChildren();
    for (const record of activeEvents) {
        const item = document.createElement("li");
        const card = document.createElement("button");
        card.type = "button";
        card.className = "establishment-card";
        card.dataset.eventId = record.event_id;
        card.setAttribute("aria-label", `Edit ${record.event_name}`);
        card.setAttribute("aria-haspopup", "dialog");
        const heading = document.createElement("span");
        heading.className = "establishment-card-title";
        const name = document.createElement("span");
        name.className = "establishment-name";
        name.textContent = record.event_name;
        const edit = document.createElement("span");
        edit.className = "establishment-edit";
        edit.textContent = "Edit";
        heading.append(name, edit);
        card.append(heading);
        for (const [label, value] of [
            ["Nickname", record.nickname], ["Type", record.event_type],
            ["Location", locations.get(record.location_id)], ["Day", record.week_day],
            ["Start", displayTime(record.start_time)], ["Games per session", record.games_per_session],
        ]) {
            const detail = document.createElement("span");
            detail.className = "establishment-detail";
            detail.textContent = `${label}: ${value || "—"}`;
            card.append(detail);
        }
        if (record.enabled === false) {
            const badge = document.createElement("span");
            badge.className = "establishment-badge";
            badge.textContent = "Disabled";
            card.append(badge);
        }
        card.addEventListener("click", () => openEditor(record));
        item.append(card);
        list.append(item);
    }
}
form.elements.namedItem("event_name").addEventListener("input", (event) => event.target.setCustomValidity(""));
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!getAuthToken()) {
        formStatus.textContent = "Please log in to save events.";
        return;
    }
    const name = form.elements.namedItem("event_name");
    if (!name.value.trim()) name.setCustomValidity("Enter an event name.");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = Object.fromEntries(["event_name", "nickname", "event_type", "week_day", "start_time"]
        .map((key) => [key, String(data.get(key) ?? "").trim() || null]));
    const locationChoice = String(data.get("location_id") || "");
    payload.location_id = locationChoice.startsWith("location:") ? Number(locationChoice.split(":")[1]) : null;
    payload.games_per_session = data.get("games_per_session") ? Number(data.get("games_per_session")) : 3;
    payload.enabled = true;
    const id = editingId;
    saving = true;
    apply.disabled = true;
    disableButton.disabled = true;
    formStatus.textContent = "";
    try {
        if (locationChoice.startsWith("establishment:")) {
            const establishment = establishments.get(Number(locationChoice.split(":")[1]));
            if (!establishment.location_id) {
                const linked = await request(`/establishments/${establishment.establishment_id}/location`, { method: "POST" });
                establishment.location_id = linked.location_id;
            }
            payload.location_id = establishment.location_id;
            locations.set(establishment.location_id, establishment.establishment_name);
        }
        const record = await request(id ? `/events/${id}` : "/events", {
            method: id ? "PUT" : "POST", body: JSON.stringify(payload),
        });
        const index = events.findIndex((entry) => entry.event_id === id);
        if (index >= 0) events[index] = record;
        else events.push(record);
        dialog.close();
        render();
        list.querySelector(`[data-event-id="${record.event_id}"]`)?.focus();
        status.textContent = `${record.event_name} ${id ? "updated" : "saved"}.`;
    } catch (error) {
        formStatus.textContent = error.message;
    } finally {
        saving = false;
        apply.disabled = false;
        disableButton.disabled = false;
    }
});
disableButton.addEventListener("click", () => {
    if (saving || editingId === null) return;
    const record = events.find((entry) => entry.event_id === editingId);
    document.getElementById("disable-event-description").textContent = `Disable “${record.event_name}”? It will be hidden from your events. Its sessions, games, and scores will be kept.`;
    disableStatus.textContent = "";
    disableDialog.showModal();
});
cancelDisable.addEventListener("click", () => { if (!saving) disableDialog.close(); });
disableDialog.addEventListener("cancel", (event) => { if (saving) event.preventDefault(); });
confirmDisable.addEventListener("click", async () => {
    if (saving || editingId === null) return;
    const record = events.find((entry) => entry.event_id === editingId);
    const payload = Object.fromEntries([
        "event_name", "event_type", "location_id", "nickname", "week_day", "start_time", "games_per_session",
    ].filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
    payload.enabled = false;
    saving = true;
    apply.disabled = disableButton.disabled = true;
    confirmDisable.disabled = cancelDisable.disabled = true;
    confirmDisable.textContent = "Disabling…";
    disableStatus.textContent = "";
    formStatus.textContent = "";
    try {
        await request(`/events/${record.event_id}`, { method: "PUT", body: JSON.stringify(payload) });
        record.enabled = false;
        disableDialog.close();
        dialog.close();
        render();
        add.focus();
        status.textContent = `${record.event_name} disabled. Games and scores have been kept.`;
    } catch (error) {
        disableStatus.textContent = error.message;
    } finally {
        saving = false;
        apply.disabled = disableButton.disabled = false;
        confirmDisable.disabled = cancelDisable.disabled = false;
        confirmDisable.textContent = "Disable Event";
    }
});
async function loadAll(path) {
    const result = [];
    for (let offset = 0; ; offset += 100) {
        const page = await request(`${path}?limit=100&offset=${offset}`);
        result.push(...page);
        if (page.length < 100) return result;
    }
}
render();
if (getAuthToken()) {
    add.disabled = true;
    try {
        const [savedEvents, savedLocations, savedEstablishments] = await Promise.all([
            loadAll("/events"), loadAll("/locations"), loadAll("/establishments"),
        ]);
        const select = document.getElementById("event-location");
        for (const location of savedLocations) {
            locations.set(location.location_id, location.location_name);
        }
        for (const establishment of savedEstablishments) {
            if (establishment.enabled === false || establishment.enabled === 0) continue;
            establishments.set(establishment.establishment_id, establishment);
            const option = document.createElement("option");
            option.value = `establishment:${establishment.establishment_id}`;
            option.textContent = establishment.establishment_name;
            select.append(option);
        }
        events.push(...savedEvents);
        render();
    } catch (error) {
        status.textContent = getAuthToken() ? error.message : "";
    } finally {
        add.disabled = false;
    }
}
