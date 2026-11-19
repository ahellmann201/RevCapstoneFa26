import { beforeEach, expect, it, vi } from "vitest";
import { enableSwipeNavigation } from "../swipe.js";

let panel, navigate;
function pointer(type, x, y, options = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true }, options);
    panel.dispatchEvent(event);
}
beforeEach(() => {
    document.body.innerHTML = '<section><button class="pin">Pin</button><input></section>';
    panel = document.querySelector("section");
    navigate = vi.fn();
    enableSwipeNavigation(panel, navigate);
});
it("recognizes left and right swipes once each", () => {
    pointer("pointerdown", 220, 100); pointer("pointerup", 100, 110);
    pointer("pointerdown", 100, 100); pointer("pointerup", 230, 110);
    expect(navigate.mock.calls).toEqual([["next"], ["previous"]]);
});
it("ignores taps, vertical scrolling, mouse drag, cancellation, and browser-edge gestures", () => {
    pointer("pointerdown", 120, 100); pointer("pointerup", 130, 105);
    pointer("pointerdown", 220, 100); pointer("pointerup", 100, 300);
    pointer("pointerdown", 220, 100, { pointerType: "mouse" }); pointer("pointerup", 100, 100);
    pointer("pointerdown", 220, 100); pointer("pointercancel", 150, 100); pointer("pointerup", 100, 100);
    pointer("pointerdown", 10, 100); pointer("pointerup", 200, 100);
    expect(navigate).not.toHaveBeenCalled();
});
it("ignores multi-touch and keeps form input gestures separate", () => {
    pointer("pointerdown", 220, 100);
    pointer("pointerdown", 120, 100, { pointerId: 2, isPrimary: false });
    pointer("pointerup", 100, 100);
    const down = new Event("pointerdown", { bubbles: true });
    Object.assign(down, { clientX: 220, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true });
    document.querySelector("input").dispatchEvent(down);
    pointer("pointerup", 100, 100);
    expect(navigate).not.toHaveBeenCalled();
});
it("suppresses a touch click after swiping but permits keyboard clicks", () => {
    pointer("pointerdown", 220, 100); pointer("pointerup", 100, 100);
    const clicked = vi.fn();
    panel.querySelector(".pin").addEventListener("click", clicked);
    panel.querySelector(".pin").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(clicked).not.toHaveBeenCalled();
    panel.querySelector(".pin").click();
    expect(clicked).toHaveBeenCalledOnce();
});
