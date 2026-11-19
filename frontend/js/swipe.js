/** Horizontal touch navigation that leaves normal scrolling and controls usable. */
export function enableSwipeNavigation(element, navigate) {
    let start = null;
    let suppressClickUntil = 0;

    element.addEventListener("pointerdown", (event) => {
        if (event.isPrimary === false) { start = null; return; }
        if (!["touch", "pen"].includes(event.pointerType)) return;
        if (event.target.closest("input, textarea, select, a, button:not(.pin)")) return;
        const width = window.innerWidth || document.documentElement.clientWidth;
        if (event.clientX < 24 || (width && event.clientX > width - 24)) return;
        start = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    });

    element.addEventListener("pointerup", (event) => {
        const gesture = start;
        start = null;
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.5 ||
            event.timeStamp - gesture.time > 1000) return;
        // Suppress a synthetic pin click after a completed swipe.
        suppressClickUntil = performance.now() + 400;
        const direction = dx < 0 ? "next" : "previous";
        if (navigate(direction) !== false) {
            const animationClass = `swipe-${direction}`;
            element.classList.remove("swipe-next", "swipe-previous");
            // Restart the animation when the user swipes again before it finishes.
            void element.offsetWidth;
            element.classList.add(animationClass);
        }
    });

    element.addEventListener("pointercancel", () => { start = null; });
    element.addEventListener("animationend", (event) => {
        if (event.target === element) element.classList.remove("swipe-next", "swipe-previous");
    });
    element.addEventListener("click", (event) => {
        if (event.detail !== 0 && performance.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
}
