import { loadNavbar } from "./navbar.js";

loadNavbar();

const FRAME_COUNT = 10;
let currentFrame = 1;

const frameStrip = document.getElementById("frame_strip");
const pinRack = document.getElementById("pin_rack");
const frameTitle = document.getElementById("frame_title");
const nextButton = document.getElementById("next_frame");
const gameStatus = document.getElementById("game_status");

// Scorecard placeholders only. No score calculations.
for (let frame = 1; frame <= FRAME_COUNT; frame++) {
    const card = document.createElement("div");
    card.className = "frame_card";
    card.dataset.frame = frame;

    const rolls = frame === 10 ? 3 : 2;

    card.innerHTML = `
        <span class="frame_number">FRAME ${frame}</span>

        <div class="frame_rolls">
            ${"<span>–</span>".repeat(rolls)}
        </div>

        <span class="frame_total">—</span>
    `;

    frameStrip.appendChild(card);
}

// Pin positions: back row to front row.
const pinLayout = [
    { number: 7, row: 1, column: 1 },
    { number: 8, row: 1, column: 3 },
    { number: 9, row: 1, column: 5 },
    { number: 10, row: 1, column: 7 },

    { number: 4, row: 2, column: 2 },
    { number: 5, row: 2, column: 4 },
    { number: 6, row: 2, column: 6 },

    { number: 2, row: 3, column: 3 },
    { number: 3, row: 3, column: 5 },

    { number: 1, row: 4, column: 4 }
];

// Eight equal columns allow every pin to span two columns.
pinRack.style.gridTemplateColumns = "repeat(8, minmax(0, 1fr))";

pinLayout.forEach(({ number, row, column }) => {
    const pin = document.createElement("button");

    pin.type = "button";
    pin.className = "pin";
    pin.textContent = number;
    pin.style.gridRow = row;
    pin.style.gridColumn = `${column} / span 2`;

    pin.setAttribute("aria-label", `Pin ${number} knocked down`);
    pin.setAttribute("aria-pressed", "false");

    pin.addEventListener("click", () => {
        const knockedDown = pin.getAttribute("aria-pressed") === "true";
        pin.setAttribute("aria-pressed", String(!knockedDown));
    });

    pinRack.appendChild(pin);
});

function updateFrame() {
    frameTitle.textContent = `Frame ${currentFrame}`;
    gameStatus.textContent = `Frame ${currentFrame} of ${FRAME_COUNT}`;

    // Each new frame begins with all pins orange.
    pinRack.querySelectorAll(".pin").forEach((pin) => {
        pin.setAttribute("aria-pressed", "false");
    });

    let activeCard;

    frameStrip.querySelectorAll(".frame_card").forEach((card) => {
        const isCurrent = Number(card.dataset.frame) === currentFrame;
        card.classList.toggle("is_current", isCurrent);

        if (isCurrent) {
            card.setAttribute("aria-current", "step");
            activeCard = card;
        } else {
            card.removeAttribute("aria-current");
        }
    });

    // Move only the scorecard strip, not the whole page.
    const cardBounds = activeCard.getBoundingClientRect();
    const stripBounds = frameStrip.getBoundingClientRect();

    frameStrip.scrollTo({
        left:
            frameStrip.scrollLeft +
            cardBounds.left -
            stripBounds.left -
            (frameStrip.clientWidth - cardBounds.width) / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth"
    });

    // UI-only flow: stop at frame 10.
    nextButton.disabled = currentFrame === FRAME_COUNT;

    nextButton.innerHTML = currentFrame === FRAME_COUNT
        ? "Final frame"
        : 'Next frame <span aria-hidden="true">→</span>';
}

nextButton.addEventListener("click", () => {
    if (currentFrame >= FRAME_COUNT) return;

    currentFrame++;
    updateFrame();
});

// Touch devices use native horizontal scrolling.
// Add click-and-drag scrolling for a mouse.
let dragPointer = null;
let dragStartX = 0;
let scrollStart = 0;

frameStrip.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    dragPointer = event.pointerId;
    dragStartX = event.clientX;
    scrollStart = frameStrip.scrollLeft;

    // Stop any in-progress auto-scroll before dragging.
    frameStrip.scrollTo({
        left: scrollStart,
        behavior: "instant"
    });

    frameStrip.classList.add("is_dragging");
    frameStrip.setPointerCapture(dragPointer);
});

frameStrip.addEventListener("pointermove", (event) => {
    if (event.pointerId !== dragPointer) return;

    frameStrip.scrollLeft =
        scrollStart - (event.clientX - dragStartX);
});

function stopDragging() {
    const pointer = dragPointer;
    dragPointer = null;

    frameStrip.classList.remove("is_dragging");

    if (pointer !== null && frameStrip.hasPointerCapture(pointer)) {
        frameStrip.releasePointerCapture(pointer);
    }
}

frameStrip.addEventListener("pointerup", stopDragging);
frameStrip.addEventListener("pointercancel", stopDragging);
frameStrip.addEventListener("lostpointercapture", stopDragging);

updateFrame();