/** Long-press and drag support; touch scrolling stays native until a hold activates. */
const attached = new WeakMap();
export function enableHomeRearranging(surface, controls) {
    attached.get(surface)?.();
    const controller = new AbortController();
    const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: controller.signal });
    let gesture = null;
    let holdTimer = null;
    let scrollTimer = null;
    let suppressUntil = 0;
    function clear(cancel = true) {
        if (cancel && gesture?.active) controls.cancelDrag?.();
        clearTimeout(holdTimer); clearInterval(scrollTimer);
        gesture?.ghost?.remove();
        surface.querySelectorAll(".is-dragging, .is-drop-target, .is-drop-invalid").forEach(node => node.classList.remove("is-dragging", "is-drop-target", "is-drop-invalid"));
        surface.classList.remove("home-dragging");
        gesture = null;
    }
    function slotAt(x, y) {
        const rect = controls.board.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(controls.board).gap) || 10;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
        const column = Math.min(1, Math.floor((x - rect.left) / ((rect.width + gap) / 2)));
        const row = Math.min(5, Math.floor((y - rect.top) / ((rect.height + gap) / 6)));
        return row * 2 + column;
    }
    function update(x, y) {
        if (!gesture?.active) return;
        gesture.x = x; gesture.y = y;
        const rawSlot = slotAt(x, y);
        const slot = rawSlot === null ? null : (controls.normalizeSlot?.(gesture.id, rawSlot) ?? rawSlot);
        const changed = slot !== gesture.slot;
        gesture.slot = slot;
        gesture.ghost.style.left = `${x - gesture.width / 2}px`;
        gesture.ghost.style.top = `${y - gesture.height / 2}px`;
        controls.board.querySelectorAll(".is-drop-target, .is-drop-invalid").forEach(node => node.classList.remove("is-drop-target", "is-drop-invalid"));
        if (slot !== null) {
            if (changed && controls.canMove(gesture.id, slot)) controls.preview?.(gesture.id, slot);
            const target = controls.board.querySelector(`.home-drop-slot[data-slot="${slot}"]`);
            target?.classList.add(controls.canMove(gesture.id, slot) ? "is-drop-target" : "is-drop-invalid");
        }
    }
    function activate() {
        if (!gesture || !controls.canEdit()) return clear();
        if (!controls.isEditing()) controls.beginEditing();
        suppressUntil = performance.now() + 600;
        if (!gesture.id) return;
        const tile = controls.board.querySelector(`[data-home-module="${gesture.id}"]`);
        if (!tile) return;
        const rect = tile.getBoundingClientRect();
        const ghost = tile.cloneNode(true);
        ghost.removeAttribute("id");
        ghost.removeAttribute("data-home-module");
        ghost.removeAttribute("data-slot");
        ghost.classList.remove("home-edit-module");
        ghost.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
        ghost.classList.add("home-drag-ghost");
        ghost.setAttribute("aria-hidden", "true"); ghost.tabIndex = -1;
        ghost.style.width = `${rect.width}px`; ghost.style.height = `${rect.height}px`;
        document.body.append(ghost);
        tile.classList.add("is-dragging"); surface.classList.add("home-dragging");
        controls.beginDrag?.();
        gesture.active = true; gesture.ghost = ghost; gesture.width = rect.width; gesture.height = rect.height;
        update(gesture.x, gesture.y);
        scrollTimer = setInterval(() => {
            if (!gesture?.active) return;
            const height = document.documentElement.clientHeight || window.innerHeight;
            const delta = gesture.y > height - 72 ? 10 : gesture.y < 112 ? -10 : 0;
            if (delta) { window.scrollBy?.(0, delta); update(gesture.x, gesture.y); }
        }, 30);
    }
    function start(target, x, y, id) {
        clear();
        if (!controls.canEdit() || target.closest("input, select, textarea, dialog, .home-editor-actions, .home-edit-toggle, [data-resize-home]")) return;
        if (!controls.isEditing() && !target.closest(".home-modules") && target !== surface) return;
        if (controls.isEditing() && !target.closest(".home-edit-grid")) return;
        gesture = { id: target.closest("[data-home-module]")?.dataset.homeModule, pointer: id, startX: x, startY: y, x, y, active: false };
        if (!controls.isEditing()) holdTimer = setTimeout(activate, 450);
    }
    function move(x, y) {
        if (!gesture) return false;
        if (!controls.canEdit()) { clear(); return false; }
        if (!gesture.active && Math.hypot(x - gesture.startX, y - gesture.startY) > 10) {
            if (!controls.isEditing()) { clear(); return false; }
            if (gesture.id) activate();
        }
        if (!gesture) return false;
        gesture.x = x; gesture.y = y;
        if (gesture.active) { update(x, y); return true; }
        return false;
    }
    function end(x, y, cancel = false) {
        if (!gesture) return;
        const active = gesture.active, id = gesture.id;
        const rawSlot = active ? slotAt(x, y) : null;
        const slot = rawSlot === null ? null : (controls.normalizeSlot?.(id, rawSlot) ?? rawSlot);
        clear(false);
        if (active) {
            suppressUntil = performance.now() + 600;
            if (!cancel && slot !== null && controls.canEdit() && controls.canMove(id, slot)) controls.move(id, slot);
            else controls.cancelDrag?.();
        }
    }
    listen(surface, "pointerdown", event => {
        if (event.pointerType === "touch" || event.button !== 0) return;
        start(event.target, event.clientX, event.clientY, event.pointerId);
    });
    listen(document, "pointermove", event => {
        if (event.pointerType !== "touch" && gesture?.pointer === event.pointerId && move(event.clientX, event.clientY)) event.preventDefault();
    });
    listen(document, "pointerup", event => {
        if (event.pointerType !== "touch" && gesture?.pointer === event.pointerId) end(event.clientX, event.clientY);
    });
    listen(document, "pointercancel", () => clear());
    listen(surface, "touchstart", event => {
        if (event.touches.length !== 1) return clear();
        const touch = event.touches[0]; start(event.target, touch.clientX, touch.clientY, touch.identifier);
    }, { passive: true });
    listen(document, "touchmove", event => {
        if (!gesture) return;
        if (event.touches.length !== 1) return clear();
        const touch = event.touches[0];
        if (move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
    }, { passive: false });
    listen(document, "touchend", event => {
        const touch = [...event.changedTouches].find(touch => touch.identifier === gesture?.pointer);
        if (touch) end(touch.clientX, touch.clientY);
    }, { passive: true });
    listen(document, "touchcancel", () => clear(), { passive: true });
    listen(surface, "contextmenu", event => {
        if (event.target.closest(".home-modules, .home-edit-grid")) event.preventDefault();
    });
    listen(surface, "click", event => {
        if (event.detail && performance.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    listen(document, "keydown", event => { if (event.key === "Escape") clear(); });
    if (window.addEventListener) listen(window, "blur", clear);
    listen(document, "visibilitychange", () => { if (document.hidden) clear(); });
    const dispose = () => { clear(); controller.abort(); };
    attached.set(surface, dispose);
    return dispose;
}
