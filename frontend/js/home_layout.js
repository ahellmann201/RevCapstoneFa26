import { request } from "./database.js";
const ITEMS = {
    events: { label: "Schedule Event", selector: "#schedule-event-button", width: 1, height: 1 },
    game: { label: "Start Game", selector: "#start-game-button", width: 1, height: 1 },
    week: { label: "Weekly Events", selector: ".week-schedule", width: 2, height: 2 },
    games: { label: "Games", href: "/games.html", width: 1, height: 1 },
    sessions: { label: "Sessions", href: "/sessions.html", width: 1, height: 1 },
    arsenal: { label: "Ball Arsenal", href: "/ball_arsenal.html", width: 1, height: 1 },
    compare: { label: "Compare Balls", href: "/compare_balls.html", width: 1, height: 1 },
    establishments: { label: "Establishments", href: "/establishments.html", width: 1, height: 1 },
    archives: { label: "Event Archives", href: "/eventArchives.html", width: 1, height: 1 },
    stats: { label: "Stats", href: "/stats.html", width: 1, height: 1 },
    ciclops: { label: "Ciclops", href: "/ciclops.html", width: 1, height: 1 },
    smartDot: { label: "Smart Dot", href: "/smart_dot.html", width: 1, height: 1 },
    smartWatch: { label: "Smart Watch", href: "/smart_watch.html", width: 1, height: 1 },
    settings: { label: "Account Settings", href: "/account_settings.html", width: 1, height: 1 },
};
const DEFAULT = [{ id: "events", slot: 0 }, { id: "game", slot: 1 }, { id: "week", slot: 2 }];
const SLOTS = 12;
export function moduleCells(id, slot) {
    const item = ITEMS[id];
    if (!item || !Number.isInteger(slot) || slot < 0 || slot % 2 + item.width > 2) return [];
    const cells = [];
    for (let y = 0; y < item.height; y++) for (let x = 0; x < item.width; x++) cells.push(slot + y * 2 + x);
    return cells.every((cell) => cell < SLOTS) ? cells : [];
}
export function validHomeLayout(layout) {
    if (!Array.isArray(layout) || layout.length > SLOTS) return false;
    const ids = new Set(), occupied = new Set();
    return layout.every((entry) => {
        if (!entry || ids.has(entry.id)) return false;
        const cells = moduleCells(entry.id, entry.slot);
        if (!cells.length || cells.some((cell) => occupied.has(cell))) return false;
        ids.add(entry.id); cells.forEach((cell) => occupied.add(cell));
        return true;
    });
}
export function initHomeLayout() {
    const landing = document.querySelector(".landing");
    const picker = document.getElementById("home-module-picker");
    if (!landing || !picker) return;
    const token = sessionStorage.getItem("authentication_token");
    const signedIn = Boolean(token && token !== "null");
    let hydrating = signedIn;
    let saving = false;
    const key = `revmetrix:home-layout:v1:${sessionStorage.getItem("userID") || "guest"}`;
    let layout = structuredClone(DEFAULT);
    try {
        const stored = JSON.parse(localStorage.getItem(key));
        if (validHomeLayout(stored)) layout = stored;
    } catch { /* Use the default layout if storage is unavailable or invalid. */ }
    let draft = structuredClone(layout), moving = null;
    const nodes = Object.fromEntries(Object.entries(ITEMS).map(([id, item]) => {
        if (item.selector) return [id, document.querySelector(item.selector)];
        const link = document.createElement("a");
        link.className = "home-shortcut";
        link.href = item.href;
        link.textContent = item.label;
        return [id, link];
    }));
    const grid = document.createElement("div"); grid.className = "home-modules";
    const editor = document.createElement("section"); editor.className = "home-editor";
    editor.setAttribute("aria-label", "Home page layout editor");
    editor.innerHTML = '<h2>Edit Home Page</h2><p>Tap an empty space to add a module. Buttons use 1 space; Weekly Events uses 4. Tap a module to move or remove it.</p><div class="home-editor-actions"><button type="button" data-action="save">Save Layout</button><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="reset">Reset to Default</button></div><p class="home-layout-status" role="status"></p><div class="home-edit-grid"></div><h3>Preview</h3>';
    landing.querySelector(".welcome_container").after(editor);
    editor.after(grid);
    const editGrid = editor.querySelector(".home-edit-grid");
    const status = editor.querySelector(".home-layout-status");
    const options = document.getElementById("home-module-options");
    const message = document.getElementById("home-module-message");
    let editing = new URLSearchParams(window.location.search).get("edit_home") === "1";
    function position(node, entry) {
        const item = ITEMS[entry.id];
        node.style.gridColumn = `${entry.slot % 2 + 1} / span ${item.width}`;
        node.style.gridRow = `${Math.floor(entry.slot / 2) + 1} / span ${item.height}`;
    }
    function render() {
        for (const button of editor.querySelectorAll(".home-editor-actions button")) button.disabled = hydrating || saving;
        editGrid.inert = hydrating || saving;
        editor.hidden = !editing;
        grid.inert = editing;
        for (const node of Object.values(nodes)) { node.hidden = true; grid.append(node); }
        landing.querySelector(".quick_links_container")?.remove();
        for (const entry of editing ? draft : layout) {
            nodes[entry.id].hidden = false;
            position(nodes[entry.id], entry);
        }
        editGrid.replaceChildren();
        const occupied = new Set();
        for (const entry of draft) {
            moduleCells(entry.id, entry.slot).forEach((cell) => occupied.add(cell));
            const button = document.createElement("button"); button.type = "button"; button.className = "home-edit-module";
            button.textContent = `${ITEMS[entry.id].label} (${moduleCells(entry.id, entry.slot).length} ${entry.id === "week" ? "spaces" : "space"})`;
            position(button, entry);
            button.addEventListener("click", () => manage(entry));
            editGrid.append(button);
        }
        for (let slot = 0; slot < SLOTS; slot++) {
            if (occupied.has(slot)) continue;
            const button = document.createElement("button"); button.type = "button"; button.className = "home-empty-module";
            button.textContent = moving ? "Move here" : "+ Add module";
            button.setAttribute("aria-label", `${button.textContent}, space ${slot + 1}`);
            button.style.gridColumn = String(slot % 2 + 1); button.style.gridRow = String(Math.floor(slot / 2) + 1);
            button.addEventListener("click", () => {
                if (!moving) { choose(slot); return; }
                const candidate = draft.map((entry) => entry.id === moving ? { ...entry, slot } : entry);
                if (!validHomeLayout(candidate)) { status.textContent = "Not enough adjacent space here. Weekly Events needs two full rows."; return; }
                draft = candidate; moving = null; status.textContent = "Module moved."; render();
            });
            editGrid.append(button);
        }
    }
    function option(label, callback, disabled = false) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.disabled = disabled;
        button.addEventListener("click", callback); options.append(button);
    }
    function choose(slot) {
        options.replaceChildren(); message.textContent = "";
        document.getElementById("home-module-title").textContent = "Add a module";
        for (const [id, item] of Object.entries(ITEMS)) {
            const exists = draft.some((entry) => entry.id === id);
            const fits = validHomeLayout([...draft, { id, slot }]);
            option(`${item.label} · ${id === "week" ? "4 spaces" : "1 space"}${exists ? " (already added)" : !fits ? " (needs more space)" : ""}`, () => {
                draft.push({ id, slot }); picker.close(); render();
            }, exists || !fits);
        }
        picker.showModal();
    }
    function manage(entry) {
        options.replaceChildren(); message.textContent = "";
        document.getElementById("home-module-title").textContent = ITEMS[entry.id].label;
        option("Move module", () => { moving = entry.id; picker.close(); status.textContent = "Tap an empty space to move this module."; render(); });
        option("Remove module", () => { draft = draft.filter((item) => item.id !== entry.id); moving = null; picker.close(); render(); });
        picker.showModal();
    }
    document.getElementById("close-module-picker").addEventListener("click", () => picker.close());
    function finish() {
        editing = false; moving = null; render();
        if (window.history?.replaceState) {
            const url = new URL(window.location.href); url.searchParams.delete("edit_home"); window.history.replaceState(null, "", url);
        }
    }
    editor.querySelector('[data-action="save"]').addEventListener("click", async () => {
        if (hydrating || saving) return;
        if (sessionStorage.getItem("authentication_token") !== token) {
            status.textContent = "Your account changed. Refresh before saving.";
            return;
        }
        saving = true; status.textContent = "Saving layout…"; render();
        try {
            const selected = structuredClone(draft);
            if (signedIn) await request("/auth/me/home-layout", {
                method: "PUT", body: JSON.stringify({ layout_version: 1, layout_json: selected }),
            });
            if (sessionStorage.getItem("authentication_token") !== token) return;
            // The database is authoritative; cache failures must not undo a successful server save.
            try { localStorage.setItem(key, JSON.stringify(selected)); }
            catch (error) { if (!signedIn) throw error; }
            layout = selected; finish();
        } catch { status.textContent = "Could not save this layout. Please try again."; }
        finally { saving = false; render(); }
    });
    editor.querySelector('[data-action="cancel"]').addEventListener("click", () => { draft = structuredClone(layout); finish(); });
    editor.querySelector('[data-action="reset"]').addEventListener("click", () => { draft = structuredClone(DEFAULT); moving = null; status.textContent = "Default layout restored. Save to keep it."; render(); });
    render();
    if (signedIn) void (async () => {
        try {
            const saved = await request("/auth/me/home-layout");
            if (sessionStorage.getItem("authentication_token") !== token) return;
            if (saved.layout_version !== 1 || !validHomeLayout(saved.layout_json)) throw new Error("Invalid saved layout");
            if (saved.updated_at !== null) {
                layout = structuredClone(saved.layout_json);
                draft = structuredClone(layout);
                try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* Server preference still applies. */ }
            }
        } catch { status.textContent = "Could not load your saved layout. Using this device's layout."; }
        finally { hydrating = false; render(); }
    })();
}
