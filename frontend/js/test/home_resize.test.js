import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { enableHomeResizing } from "../home_resize.js";
let surface, handle, controls, dispose;
function pointer(type, x, y) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, clientX: x, clientY: y });
    (type === "pointerdown" ? handle : document).dispatchEvent(event);
}
beforeEach(() => {
    document.body.innerHTML = '<main><button data-resize-home="stats">Resize Stats</button></main>';
    surface = document.querySelector("main"); handle = document.querySelector("button");
    controls = { canResize: () => true, getSize: () => "small", begin: vi.fn(), preview: vi.fn(() => true), commit: vi.fn(), cancel: vi.fn() };
    dispose = enableHomeResizing(surface, controls);
});
afterEach(() => dispose());
it("expands from an outward edge drag and commits on release", () => {
    pointer("pointerdown", 200, 200); pointer("pointermove", 280, 260);
    expect(controls.preview).toHaveBeenCalledWith("stats", "large");
    expect(controls.commit).not.toHaveBeenCalled();
    pointer("pointerup", 280, 260); expect(controls.commit).toHaveBeenCalledOnce();
});
it("shrinks on an inward drag and rolls back an interrupted resize", () => {
    controls.getSize = () => "large";
    pointer("pointerdown", 280, 260); pointer("pointermove", 200, 200);
    expect(controls.preview).toHaveBeenCalledWith("stats", "small");
    pointer("pointercancel", 200, 200);
    expect(controls.cancel).toHaveBeenCalledOnce(); expect(controls.commit).not.toHaveBeenCalled();
});
it("a tap on the corner does not change the size", () => {
    pointer("pointerdown", 200, 200); pointer("pointerup", 200, 200);
    expect(controls.preview).not.toHaveBeenCalled(); expect(controls.commit).not.toHaveBeenCalled();
});
