/** Corner resizing with pointer capture; supports mouse, pen, touch and arrow keys. */
const attached = new WeakMap();
export function enableHomeResizing(surface, controls) {
    attached.get(surface)?.();
    const controller = new AbortController();
    const listen = (target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: controller.signal });
    let gesture = null;
    function finish(cancel) {
        if (!gesture) return;
        const previous = gesture; gesture = null;
        if (surface.hasPointerCapture?.(previous.pointer)) surface.releasePointerCapture(previous.pointer);
        surface.classList.remove("home-resizing");
        if (cancel || !previous.changed) controls.cancel(); else controls.commit();
    }
    listen(surface, "pointerdown", event => {
        const handle = event.target.closest("[data-resize-home]");
        if (!handle || event.button !== 0 || !controls.canResize()) return;
        if (gesture) { finish(true); return; }
        event.preventDefault(); event.stopPropagation();
        const id = handle.dataset.resizeHome;
        gesture = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, original: controls.getSize(id), size: controls.getSize(id), changed: false };
        controls.begin(id); surface.classList.add("home-resizing");
        surface.setPointerCapture?.(event.pointerId);
    });
    listen(document, "pointermove", event => {
        if (!gesture || gesture.pointer !== event.pointerId) return;
        if (!controls.canResize()) return finish(true);
        event.preventDefault();
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        const large = gesture.original === "large" ? dx > -50 && dy > -50 : dx > 50 || dy > 50;
        const size = large ? "large" : "small";
        if (size !== gesture.size && controls.preview(gesture.id, size)) {
            gesture.size = size; gesture.changed = size !== gesture.original;
        }
    }, { passive: false });
    listen(document, "pointerup", event => { if (gesture?.pointer === event.pointerId) finish(false); });
    listen(document, "pointercancel", () => finish(true));
    listen(surface, "lostpointercapture", () => finish(true));
    listen(surface, "click", event => {
        if (event.target.closest("[data-resize-home]")) { event.preventDefault(); event.stopPropagation(); }
    });
    listen(surface, "keydown", event => {
        const handle = event.target.closest("[data-resize-home]");
        if (!handle || !controls.canResize() || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const size = ["ArrowRight", "ArrowDown"].includes(event.key) ? "large" : "small";
        const id = handle.dataset.resizeHome;
        controls.begin(id);
        if (controls.preview(id, size)) controls.commit(); else controls.cancel();
        surface.querySelector(`[data-resize-home="${id}"]`)?.focus();
    });
    listen(document, "keydown", event => { if (event.key === "Escape") finish(true); });
    if (window.addEventListener) listen(window, "blur", () => finish(true));
    listen(document, "visibilitychange", () => { if (document.hidden) finish(true); });
    const dispose = () => { finish(true); controller.abort(); };
    attached.set(surface, dispose); return dispose;
}
