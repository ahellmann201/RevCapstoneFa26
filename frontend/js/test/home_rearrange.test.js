import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { enableHomeRearranging } from "../home_rearrange.js";
let dispose, controls, surface, tile, editing;
function touch(type, x, y) {
    const point = { identifier: 1, clientX: x, clientY: y };
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, { touches: { value: type === "touchend" || type === "touchcancel" ? [] : [point] }, changedTouches: { value: [point] } });
    (type === "touchstart" ? tile : document).dispatchEvent(event);
    return event;
}
beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main><div class="home-modules"><button data-home-module="game">Start Game</button></div><div class="home-edit-grid"><button data-home-module="game" data-slot="0">Start Game</button><button data-slot="1">Add</button></div></main>';
    surface = document.querySelector("main"); tile = document.querySelector(".home-modules button");
    editing = false;
    const board = document.querySelector(".home-edit-grid");
    board.getBoundingClientRect = () => ({ left: 20, right: 380, top: 150, bottom: 728, width: 360, height: 578 });
    controls = { canEdit: () => true, isEditing: () => editing, beginEditing: vi.fn(() => { editing = true; }), board, canMove: () => true, move: vi.fn(), preview: vi.fn(), cancelDrag: vi.fn() };
    dispose = enableHomeRearranging(surface, controls);
});
afterEach(() => { dispose(); vi.useRealTimers(); });

it("opens rearrange after holding and drops onto the target slot", () => {
    touch("touchstart", 80, 200);
    vi.advanceTimersByTime(449);
    expect(controls.beginEditing).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(controls.beginEditing).toHaveBeenCalledOnce();
    expect(document.querySelector(".home-drag-ghost")).not.toBeNull();
    expect(touch("touchmove", 290, 190).defaultPrevented).toBe(true);
    expect(controls.preview).toHaveBeenCalledWith("game", 1);
    expect(controls.move).not.toHaveBeenCalled();
    touch("touchend", 290, 190);
    expect(controls.move).toHaveBeenCalledWith("game", 1);
    expect(document.querySelector(".home-drag-ghost")).toBeNull();
});
it("leaves short taps and normal vertical scrolling alone", () => {
    touch("touchstart", 80, 200); touch("touchend", 80, 200);
    vi.advanceTimersByTime(500);
    expect(controls.beginEditing).not.toHaveBeenCalled();
    touch("touchstart", 80, 200);
    expect(touch("touchmove", 82, 260).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(500);
    expect(controls.beginEditing).not.toHaveBeenCalled();
    expect(controls.move).not.toHaveBeenCalled();
});
it("cancels interrupted drags without applying a position", () => {
    touch("touchstart", 80, 200); vi.advanceTimersByTime(450);
    touch("touchmove", 290, 190); touch("touchcancel", 290, 190);
    expect(controls.move).not.toHaveBeenCalled();
    expect(controls.cancelDrag).toHaveBeenCalled();
    expect(document.querySelector(".home-drag-ghost")).toBeNull();
});
it("does not rearrange while preferences are loading or saving", () => {
    controls.canEdit = () => false;
    touch("touchstart", 80, 200); vi.advanceTimersByTime(500);
    expect(controls.beginEditing).not.toHaveBeenCalled();
});
