import { request } from "./database.js";
import { enableHomeResizing } from "./home_resize.js";
import { renderHomeWidget } from "./home_widgets.js";
import { enableHomeRearranging } from "./home_rearrange.js";
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
const COLOR_PRESETS = {
    orange: { label: "Button orange", background: "--button-color-1", foreground: "--off-black" },
    amber: { label: "Button amber", background: "--button-color-2", foreground: "--off-black" },
    deepTeal: { label: "Background", background: "--bg-color", foreground: "--app-text" },
    teal: { label: "Lighter background", background: "--lighter-bg-color", foreground: "--app-text" },
    slateTeal: { label: "Lightest background", background: "--lighter-bg-color-2", foreground: "--app-text" },
    offWhite: { label: "Off-white", background: "--off-white", foreground: "--off-black" },
    errorRed: { label: "Error red", background: "--error-color", foreground: "--off-white" },
};
function applyModuleColor(node, entry) {
    const preset = COLOR_PRESETS[entry.color];
    node.classList.toggle("home-color-custom", Boolean(preset));
    if (preset) {
        node.style.setProperty("--home-module-background", `var(${preset.background})`);
        node.style.setProperty("--home-module-foreground", `var(${preset.foreground})`);
    } else {
        node.style.removeProperty("--home-module-background");
        node.style.removeProperty("--home-module-foreground");
    }
}
const SLOTS = 12;
export const EXPANDABLE_MODULES = new Set(["stats", "games", "arsenal"]);
export function moduleDimensions(id, size = null) {
    const item = ITEMS[id];
    if (!item || (size != null && (!EXPANDABLE_MODULES.has(id) || !["small", "large"].includes(size)))) return null;
    return size === "large" ? { width: 2, height: 2 } : item;
}
export function moduleCells(id, slot, size = null) {
    const item = moduleDimensions(id, size);
    if (!item || !Number.isInteger(slot) || slot < 0 || slot % 2 + item.width > 2) return [];
    const cells = [];
    for (let y = 0; y < item.height; y++) for (let x = 0; x < item.width; x++) cells.push(slot + y * 2 + x);
    return cells.every((cell) => cell < SLOTS) ? cells : [];
}
export function validHomeLayout(layout) {
    if (!Array.isArray(layout) || layout.length > SLOTS) return false;
    const ids = new Set(), occupied = new Set();
    return layout.every((entry) => {
        if (!entry || ids.has(entry.id) || (entry.color != null && !Object.hasOwn(COLOR_PRESETS, entry.color))) return false;
        const cells = moduleCells(entry.id, entry.slot, entry.size);
        if (!cells.length || cells.some((cell) => occupied.has(cell))) return false;
        ids.add(entry.id); cells.forEach((cell) => occupied.add(cell));
        return true;
    });
}
/** Anchor the dragged widget and shift the remaining widgets in reading order. */
export function moveHomeModule(layout, id, slot, size = undefined) {
    const source = layout.find(entry => entry.id === id);
    const moving = { ...source, slot, ...(size === undefined ? {} : { size }) };
    if (!validHomeLayout(layout) || !source || !moduleCells(id, slot, moving.size).length) return null;
    const others = layout.filter(entry => entry.id !== id).sort((a, b) => a.slot - b.slot);
    function pack(order) {
        const placed = [moving];
        for (const entry of order) {
            const next = Array.from({ length: SLOTS }, (_, slot) => slot)
                .find(slot => validHomeLayout([...placed, { ...entry, slot }]));
            if (next === undefined) return null;
            placed.push({ ...entry, slot: next });
        }
        return placed.sort((a, b) => a.slot - b.slot);
    }
    // A full board may require placing the large widget before filling small gaps.
    return pack(others) ?? pack([...others].sort((a, b) => moduleCells(b.id, b.slot, b.size).length - moduleCells(a.id, a.slot, a.size).length));
}

export function resizeHomeModule(layout, id, size) {
    const entry = layout.find(item => item.id === id);
    if (!entry || !EXPANDABLE_MODULES.has(id)) return null;
    const slot = size === "large" ? Math.min(8, entry.slot - entry.slot % 2) : entry.slot;
    return moveHomeModule(layout, id, slot, size);
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
    let dragOriginal = null;
    let resizeOriginal = null;
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
    editor.innerHTML = '<h2>Rearrange Home</h2><p>Slide modules around to rearrange them. Other modules shift out of the way.</p><div class="home-editor-actions"><button type="button" data-action="add">Add Module</button><button type="button" data-action="save">Done</button><button type="button" data-action="cancel">Cancel</button><button type="button" data-action="reset">Reset to Default</button></div><p class="home-layout-status" role="status"></p><div class="home-edit-grid" aria-label="Rearrange home modules"></div>';
    landing.querySelector(".welcome_container").after(editor);
    editor.after(grid);
    const editButton = document.createElement("button");
    editButton.type = "button"; editButton.className = "home-edit-toggle";
    editButton.textContent = "Edit Home Page";
    editor.before(editButton);
    const editGrid = editor.querySelector(".home-edit-grid");
    const status = editor.querySelector(".home-layout-status");
    const options = document.getElementById("home-module-options");
    const message = document.getElementById("home-module-message");
    let editing = new URLSearchParams(window.location.search).get("edit_home") === "1";
    function position(node, entry) {
        const item = moduleDimensions(entry.id, entry.size);
        node.style.gridColumn = `${entry.slot % 2 + 1} / span ${item.width}`;
        node.style.gridRow = `${Math.floor(entry.slot / 2) + 1} / span ${item.height}`;
    }
    function render() {
        for (const button of editor.querySelectorAll(".home-editor-actions button")) button.disabled = hydrating || saving;
        editGrid.inert = hydrating || saving;
        editor.hidden = !editing;
        editButton.hidden = editing;
        grid.hidden = editing;
        landing.classList.toggle("home-rearranging", editing);
        grid.inert = editing;
        for (const [id, node] of Object.entries(nodes)) { node.dataset.homeModule = id; node.hidden = true; grid.append(node); }
        landing.querySelector(".quick_links_container")?.remove();
        for (const entry of editing ? draft : layout) {
            nodes[entry.id].hidden = false;
            position(nodes[entry.id], entry);
            applyModuleColor(nodes[entry.id], entry);
            if (EXPANDABLE_MODULES.has(entry.id)) renderHomeWidget(nodes[entry.id], entry.id, entry.size === "large");
        }
        editGrid.replaceChildren();
        const occupied = new Set();
        for (const entry of draft) {
            moduleCells(entry.id, entry.slot, entry.size).forEach((cell) => occupied.add(cell));
            const button = document.createElement("button"); button.type = "button"; button.className = "home-edit-module";
            button.textContent = ITEMS[entry.id].label;
            applyModuleColor(button, entry);
            button.dataset.homeModule = entry.id;
            button.dataset.slot = String(entry.slot);
            position(button, entry);
            button.addEventListener("keydown", event => {
                const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 };
                if (!(event.key in offsets) || hydrating || saving) return;
                event.preventDefault();
                move(entry.id, entry.slot + offsets[event.key]);
                editGrid.querySelector(`[data-home-module="${entry.id}"]`)?.focus();
            });
            button.addEventListener("click", () => manage(entry));
            editGrid.append(button);
            if (EXPANDABLE_MODULES.has(entry.id)) {
                const handle = document.createElement("button"); handle.type = "button";
                handle.className = "home-resize-handle"; handle.dataset.resizeHome = entry.id;
                handle.setAttribute("aria-label", `Resize ${ITEMS[entry.id].label}`);
                handle.title = "Drag to resize";
                handle.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 20 12-12M14 20l6-6M20 20h.01"/></svg>';
                position(handle, entry); editGrid.append(handle);
            }
        }
        for (let slot = 0; slot < SLOTS; slot++) {
            const spot = document.createElement(moving && !occupied.has(slot) ? "button" : "span");
            spot.className = "home-drop-slot";
            spot.dataset.slot = String(slot);
            spot.style.gridColumn = String(slot % 2 + 1);
            spot.style.gridRow = String(Math.floor(slot / 2) + 1);
            if (moving && !occupied.has(slot)) {
                spot.type = "button"; spot.textContent = "Move here";
                spot.addEventListener("click", () => move(moving, slot));
            } else spot.setAttribute("aria-hidden", "true");
            editGrid.append(spot);
        }
    }
    function previewLayout(candidate) {
        if (!candidate) return false;
        const positions = new Map([...editGrid.querySelectorAll(".home-edit-module")].map(node => [node.dataset.homeModule, node.getBoundingClientRect()]));
        draft = candidate;
        for (const entry of draft) {
            const node = editGrid.querySelector(`[data-home-module="${entry.id}"]`);
            position(node, entry); node.dataset.slot = String(entry.slot);
            const handle = editGrid.querySelector(`[data-resize-home="${entry.id}"]`);
            if (handle) position(handle, entry);
        }
        if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            for (const node of editGrid.querySelectorAll(".home-edit-module:not(.is-dragging)")) {
                const before = positions.get(node.dataset.homeModule), after = node.getBoundingClientRect();
                if (before && (before.x !== after.x || before.y !== after.y)) node.animate?.([
                    { transform: `translate(${before.x - after.x}px, ${before.y - after.y}px)` }, { transform: "translate(0, 0)" },
                ], { duration: 170, easing: "ease-out" });
            }
        }
        return true;
    }

    function previewDrag(id, slot) {
        return previewLayout(moveHomeModule(dragOriginal ?? draft, id, slot));
    }
    enableHomeResizing(landing, {
        canResize: () => editing && !hydrating && !saving && !document.querySelector("dialog[open]"),
        getSize: id => draft.find(entry => entry.id === id)?.size === "large" ? "large" : "small",
        begin: () => { resizeOriginal = structuredClone(draft); },
        preview: (id, size) => {
            const changed = previewLayout(resizeHomeModule(resizeOriginal ?? draft, id, size));
            if (!changed) status.textContent = "Not enough space for this module here.";
            return changed;
        },
        commit: () => { resizeOriginal = null; status.textContent = "Widget resized."; render(); },
        cancel: () => { if (resizeOriginal) draft = resizeOriginal; resizeOriginal = null; render(); },
    });

    function move(id, slot) {
        const candidate = moveHomeModule(draft, id, slot);
        if (!candidate) { status.textContent = "Not enough space for this module here."; return false; }
        draft = candidate; moving = null; status.textContent = "Module moved."; render();
        return true;
    }
    function beginEditing() {
        if (editing || hydrating || saving || document.querySelector("dialog[open]")) return false;
        draft = structuredClone(layout); editing = true; status.textContent = ""; render();
        return true;
    }
    editButton.addEventListener("click", beginEditing);
    enableHomeRearranging(landing, {
        canEdit: () => !hydrating && !saving && !document.querySelector("dialog[open]"),
        isEditing: () => editing,
        beginEditing,
        board: editGrid,
        move: (id, slot) => { const changed = previewDrag(id, slot); dragOriginal = null; render(); return changed; },
        beginDrag: () => { dragOriginal = structuredClone(draft); },
        cancelDrag: () => { if (dragOriginal) draft = dragOriginal; dragOriginal = null; render(); },
        preview: previewDrag,
        normalizeSlot: (id, slot) => moduleDimensions(id, draft.find(entry => entry.id === id)?.size).width === 2 ? Math.min(8, slot - slot % 2) : slot,
        canMove: (id, slot) => Boolean(moveHomeModule(dragOriginal ?? draft, id, slot)),
    });

    function option(label, callback, disabled = false) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.disabled = disabled;
        button.addEventListener("click", callback); options.append(button);
    }
    editor.querySelector('[data-action="add"]').addEventListener("click", () => choose());
    function choose() {
        options.replaceChildren(); message.textContent = "";
        document.getElementById("home-module-title").textContent = "Add a module";
        for (const [id, item] of Object.entries(ITEMS)) {
            const exists = draft.some((entry) => entry.id === id);
            const slot = Array.from({ length: SLOTS }, (_, i) => i).find(slot => validHomeLayout([...draft, { id, slot }]));
            const fits = slot !== undefined;
            option(`${item.label} · ${id === "week" ? "4 spaces" : "1 space"}${exists ? " (already added)" : !fits ? " (needs more space)" : ""}`, () => {
                draft.push({ id, slot }); picker.close(); render();
            }, exists || !fits);
        }
        picker.showModal();
    }
    function manage(entry) {
        options.replaceChildren(); message.textContent = "";
        document.getElementById("home-module-title").textContent = ITEMS[entry.id].label;
        if (entry.id !== "week") option("Change button color", () => chooseColor(entry.id));
        option("Move module", () => { moving = entry.id; picker.close(); status.textContent = "Tap an empty space to move this module."; render(); });
        option("Remove module", () => { draft = draft.filter((item) => item.id !== entry.id); moving = null; picker.close(); render(); });
        picker.showModal();
    }
    function chooseColor(id) {
        options.replaceChildren(); message.textContent = "Choose a color preset from the home page theme.";
        document.getElementById("home-module-title").textContent = "Button color";
        option("Theme default", () => {
            draft = draft.map(entry => { if (entry.id !== id) return entry; const { color, ...rest } = entry; return rest; });
            picker.close(); render();
        });
        for (const [color, preset] of Object.entries(COLOR_PRESETS)) {
            const button = document.createElement("button"); button.type = "button";
            button.className = "home-color-option"; button.textContent = preset.label;
            button.style.setProperty("--home-module-background", `var(${preset.background})`);
            button.style.setProperty("--home-module-foreground", `var(${preset.foreground})`);
            button.setAttribute("aria-pressed", String(draft.find(entry => entry.id === id)?.color === color));
            button.addEventListener("click", () => {
                draft = draft.map(entry => entry.id === id ? { ...entry, color } : entry);
                picker.close(); render();
            });
            options.append(button);
        }
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
        } catch (error) {
            status.textContent = error.status === 422 && /size.*Extra inputs are not permitted/i.test(error.message)
                ? "The server needs an update to save resized widgets. Your changes are still here."
                : "Could not save this layout. Please try again.";
        }
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
