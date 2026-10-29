import { loadNavbar } from "./navbar.js";
import { request } from "./api_client.js";
import { getAuthToken } from "./authentication.js";

loadNavbar();

const establishments = [];

const list = document.getElementById("establishment-list");
const emptyState = document.getElementById("establishments-empty");
const dialog = document.getElementById("establishment-dialog");
const form = document.getElementById("establishment-form");
const title = document.getElementById("establishment-dialog-title");
const applyButton = document.getElementById("apply-establishment");
const status = document.getElementById("establishment-status");
let editingIndex = null;

function openEditor(index = null) {
    editingIndex = index;
    form.reset();
    form.elements.namedItem("name").setCustomValidity("");
    if (index !== null) {
        for (const [key, value] of Object.entries(establishments[index])) {
            const input = form.elements.namedItem(key);
            if (!input) continue;
            if (input.type === "checkbox") input.checked = value;
            else input.value = value ?? "";
        }
    }
    title.textContent = index === null ? "Add Establishment" : "Edit Establishment";
    applyButton.textContent = index === null ? "Add" : "Apply changes";
    dialog.showModal();
    if (index !== null) list.children[index].firstElementChild.setAttribute("aria-expanded", "true");
}

function renderEstablishments() {
    emptyState.hidden = establishments.length > 0;
    list.replaceChildren();
    establishments.forEach((establishment, index) => {
        const item = document.createElement("li");
        const card = document.createElement("button");
        card.type = "button";
        card.className = "establishment-card";
        card.setAttribute("aria-haspopup", "dialog");
        card.setAttribute("aria-expanded", "false");
        card.setAttribute("aria-label", `Edit ${establishment.name}`);
        const heading = document.createElement("span");
        heading.className = "establishment-card-title";
        const name = document.createElement("span");
        name.className = "establishment-name";
        name.textContent = establishment.name;
        const edit = document.createElement("span");
        edit.className = "establishment-edit";
        edit.textContent = "Edit";
        heading.append(name, edit);
        card.append(heading);
        for (const [label, value] of [
            ["Nickname", establishment.nickname], ["Type", establishment.type],
            ["# of Lanes", establishment.lanes], ["Address", establishment.address], ["Phone", establishment.phone],
        ]) {
            if (label === "Type" && !value) continue;
            const detail = document.createElement("span");
            detail.className = "establishment-detail";
            detail.textContent = `${label}: ${value || "—"}`;
            card.append(detail);
        }
        const badges = document.createElement("span");
        badges.className = "establishment-badges";
        for (const label of [establishment.homeHouse ? "Home House" : null, establishment.enabled ? null : "Disabled"]) {
            if (!label) continue;
            const badge = document.createElement("span");
            badge.className = "establishment-badge";
            badge.textContent = label;
            badges.append(badge);
        }
        if (badges.childElementCount) card.append(badges);
        card.addEventListener("click", () => openEditor(index));
        item.append(card);
        list.append(item);
    });
}

document.getElementById("add-establishment").addEventListener("click", () => openEditor());
for (const id of ["close-establishment", "cancel-establishment"]) {
    document.getElementById(id).addEventListener("click", () => dialog.close());
}
dialog.addEventListener("close", () => {
    list.querySelector('[aria-expanded="true"]')?.setAttribute("aria-expanded", "false");
    editingIndex = null;
});
form.elements.namedItem("name").addEventListener("input", (event) => event.target.setCustomValidity(""));
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (applyButton.disabled) return;
    if (!getAuthToken()) {
        window.alert("Please log in to save establishments.");
        return;
    }
    const nameInput = form.elements.namedItem("name");
    if (!nameInput.value.trim()) nameInput.setCustomValidity("Enter an establishment name.");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const entry = Object.fromEntries(["name", "nickname", "type", "address", "phone"]
        .map((key) => [key, String(data.get(key) ?? "").trim()]));
    entry.lanes = data.get("lanes") ? Number(data.get("lanes")) : null;
    entry.homeHouse = data.has("homeHouse");
    entry.enabled = data.has("enabled");
    const wasEditing = editingIndex !== null;
    const changedIndex = wasEditing ? editingIndex : establishments.length;
    const previous = wasEditing ? establishments[editingIndex] : null;
    applyButton.disabled = true;
    try {
        const saved = await request(previous ? `/establishments/${previous.id}` : "/establishments", {
            method: previous ? "PUT" : "POST",
            body: JSON.stringify({
                establishment_name: entry.name,
                lane_count: entry.lanes,
                address: entry.address,
                location_id: previous?.locationId ?? null,
                nickname: entry.nickname,
                type: entry.type,
                phone: entry.phone,
                home_house: entry.homeHouse,
                enabled: entry.enabled,
            }),
        });
        const record = fromDatabase(saved);
        if (wasEditing) establishments[changedIndex] = record;
        else establishments.push(record);
    } catch (error) {
        window.alert(error.message);
        return;
    } finally {
        applyButton.disabled = false;
    }
    dialog.close();
    renderEstablishments();
    list.children[changedIndex].firstElementChild.focus();
    status.textContent = `${entry.name} ${wasEditing ? "updated" : "saved"}.`;
});

function fromDatabase(record) {
    return {
        id: record.establishment_id,
        locationId: record.location_id,
        name: record.establishment_name,
        lanes: record.lane_count,
        address: record.address,
        nickname: record.nickname,
        type: record.type,
        phone: record.phone,
        homeHouse: record.home_house,
        enabled: record.enabled,
    };
}

renderEstablishments();
if (getAuthToken()) {
    try {
        for (let offset = 0; ; offset += 100) {
            const records = await request(`/establishments?limit=100&offset=${offset}`);
            establishments.push(...records.map(fromDatabase));
            if (records.length < 100) break;
        }
        renderEstablishments();
    } catch (error) {
        status.textContent = error.message;
    }
}
