import { loadNavbar } from "./navbar.js";
import { getAuthToken } from "./authentication.js";
import { openAuthPopup } from "./popups.js";
import { 
    setPinLeave,
    getPinLeave,
    addFrameShot,
    getFrameShots,
    setShotResult,
    getShotResult,
    addGameFrame,
    getGameFrames,
    setGameState,
    getGameState,
    setActiveGameId,
    getActiveGameId,
    removeGame,
    getUserID
} from "./cache.js";

loadNavbar();

const FRAME_COUNT = 10;
// A new game gets a UUID; reloads (including login) resume the same game.
const gameId = getActiveGameId() ?? crypto.randomUUID();
const gameState = getGameState(gameId) ?? { createdAt: new Date().toISOString() };
setActiveGameId(gameId);
let currentFrame = gameState.currentFrame ?? 1;
let currentShot = gameState.currentShot ?? 1;
let gameFinished = gameState.gameFinished ?? false;
let currentFoul = gameState.currentFoul ?? false;

const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const frames = [];

const frameStrip = document.getElementById("frame_strip");
const pinRack = document.getElementById("pin_rack");
const frameTitle = document.getElementById("frame_title");
const nextButton = document.getElementById("next_frame");
const gameStatus = document.getElementById("game_status");
const foulButton = document.getElementById("foul_button");
const gutterButton = document.getElementById("gutter_button");
const spareButton = document.getElementById("spare_button");
const strikeButton = document.getElementById("strike_button");
const finishPopup = document.getElementById("finish_game_popup");

function cacheGameProgress() {
    Object.assign(gameState, { currentFrame, currentShot, gameFinished, currentFoul });
    setGameState(gameId, gameState);
}

function finishGame() {
    if (getAuthToken() === null) {
        finishPopup.showModal();
        return;
    }

    // TODO: persist this game -> frames -> shots hierarchy to the database.
    gameState.userID = getUserID();
    gameState.finishedAt = new Date().toISOString();
    gameState.finishRequested = false;
    cacheGameProgress();
    setActiveGameId(null);
    window.location.href = "/index.html";
}

document.getElementById("stay_signed_out").addEventListener("click", () => {
    removeGame(gameId);
    window.location.href = "/index.html";
});

for (const type of ["login", "signup"]) {
    document.getElementById(`finish_${type}`).addEventListener("click", () => {
        // Authentication reloads the page. Keep this completed game pending.
        gameState.finishRequested = true;
        cacheGameProgress();
        finishPopup.close();
        openAuthPopup(`${type}_popup`);
    });
}

function updateShortcutButtons() {
    const strikeAllowed = isStrikeOpportunity(currentFrame, currentShot);

    foulButton.disabled = gameFinished;
    gutterButton.disabled = gameFinished;
    strikeButton.disabled = gameFinished || !strikeAllowed;
    spareButton.disabled =
        gameFinished || currentShot === 1 || strikeAllowed;

    foulButton.setAttribute("aria-pressed", String(currentFoul));
}

function applyShortcut(type) {
    if (gameFinished) return;

    const startingPins = getStartingPins(currentFrame, currentShot);
    currentFoul = type === "foul";

    // Foul and gutter credit zero pins.
    // Restore the available rack so the following shot starts correctly.
    const leave =
        type === "foul" || type === "gutter" ? startingPins : [];

    setPinLeave(getCurrentShotId(), leave);
    updateFrame();
}

foulButton.addEventListener("click", () => applyShortcut("foul"));
gutterButton.addEventListener("click", () => applyShortcut("gutter"));
spareButton.addEventListener("click", () => applyShortcut("spare"));
strikeButton.addEventListener("click", () => applyShortcut("strike"));

// Frame order is stored on the game, just as shot order is stored on each frame.
const cachedFrames = getGameFrames(gameId);
for (let frame = 1; frame <= FRAME_COUNT; frame++) {
    const card = document.createElement("div");
    card.className = "frame_card";
    card.dataset.frame = frame;

    const rolls = frame === 10 ? 3 : 2;

    const frameId = cachedFrames[frame - 1] ?? crypto.randomUUID();

    frames.push({
        id: frameId,
        number: frame
    });

    addGameFrame(gameId, frameId);
    if (getFrameShots(frameId).length === 0) {
        const firstShotId = crypto.randomUUID();
        addFrameShot(frameId, firstShotId);
        setPinLeave(firstShotId, [...ALL_PINS]);
    }

    card.dataset.frameId = frameId;

    card.innerHTML = `
        <span class="frame_number">FRAME ${frame}</span>

        <div class="frame_rolls">
            ${"<span>-</span>".repeat(rolls)}
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
    pin.dataset.pin = number;
    pin.style.gridRow = row;
    pin.style.gridColumn = `${column} / span 2`;

    pin.setAttribute("aria-label", `Pin ${number} knocked down`);
    pin.setAttribute("aria-pressed", "false");

    pin.addEventListener("click", () => {
    if (gameFinished || pin.disabled) return;

    currentFoul = false;

    const knockedDown = pin.getAttribute("aria-pressed") === "true";
    pin.setAttribute("aria-pressed", String(!knockedDown));

    cacheLeave();
    updateShortcutButtons();
    cacheGameProgress();
    });

    pinRack.appendChild(pin);
});

function updateFrame() {
    const startingPins = getStartingPins(currentFrame, currentShot);
    const leave = getPinLeave(getCurrentShotId()) ?? startingPins;

    frameTitle.textContent = `Frame ${currentFrame} · Shot ${currentShot}`;

    gameStatus.textContent = gameFinished
        ? "Game complete"
        : `Frame ${currentFrame} of ${FRAME_COUNT} · Shot ${currentShot}`;

    pinRack.querySelectorAll(".pin").forEach((pin) => {
        const number = Number(pin.dataset.pin);

        pin.setAttribute(
            "aria-pressed",
            String(!leave.includes(number))
        );

        pin.disabled = gameFinished || !startingPins.includes(number);
    });

    renderScorecard();

    const activeCard = frameStrip.querySelector(
        `[data-frame="${currentFrame}"]`
    );

    const cardBounds = activeCard.getBoundingClientRect();
    const stripBounds = frameStrip.getBoundingClientRect();

    frameStrip.scrollTo({
        left:
            frameStrip.scrollLeft +
            cardBounds.left -
            stripBounds.left -
            (frameStrip.clientWidth - cardBounds.width) / 2,
        behavior: window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches ? "instant" : "smooth"
    });

    nextButton.textContent = gameFinished
        ? "Finish"
        : 'Next';
    
    updateShortcutButtons();
    cacheGameProgress();
}

function startNextShot() {
    currentShot++;

    const frame = frames[currentFrame - 1];
    const shots = getFrameShots(frame.id);

    if (!shots[currentShot - 1]) {
        const shotId = crypto.randomUUID();
        const startingPins = getStartingPins(currentFrame, currentShot);

        addFrameShot(frame.id, shotId);
        setPinLeave(shotId, startingPins);
    }
}

nextButton.addEventListener("click", () => {
    if (gameFinished) {
        finishGame();
        return;
    }

    cacheLeave();

    const shotId = getCurrentShotId();
    const startingPins = getStartingPins(currentFrame, currentShot);
    const leave = getPinLeave(shotId);

    setShotResult(shotId, {
        pins: currentFoul ? 0 : startingPins.length - leave.length,
        foul: currentFoul
    });

    if (currentFrame < FRAME_COUNT) {
        if (currentShot === 1 && leave.length > 0) {
            startNextShot();
        } else {
            currentFrame++;
            currentShot = 1;
        }
    } else if (currentShot === 1) {
        startNextShot();
    } else if (currentShot === 2) {
        const shots = getFrameShots(frames[currentFrame - 1].id);
        const firstLeave = getPinLeave(shots[0]);

        if (firstLeave.length === 0 || leave.length === 0) {
            startNextShot();
        } else {
            gameFinished = true;
        }
    } else {
        gameFinished = true;
    }

    currentFoul = false;
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

function getCurrentShotId() {
    const frame = frames[currentFrame - 1];
    return getFrameShots(frame.id)[currentShot - 1];
}

function getStartingPins(frameNumber, shotNumber) {
    if (shotNumber === 1) return [...ALL_PINS];

    const frame = frames[frameNumber - 1];
    const shots = getFrameShots(frame.id);
    const previousLeave = getPinLeave(shots[shotNumber - 2]);

    if (frameNumber === 10 && previousLeave.length === 0) {
        return [...ALL_PINS];
    }
    
    return [...previousLeave];
}
function cacheLeave() {
    const leave = Array.from(
        pinRack.querySelectorAll('.pin[aria-pressed="false"]'),
        (pin) => Number(pin.dataset.pin)
    ).sort((a, b) => a - b);

    setPinLeave(getCurrentShotId(), leave);
    renderScorecard();
}

function renderScorecard() {
    const totals = calculateFrameTotals();

    frameStrip.querySelectorAll(".frame_card").forEach((card) => {
        const frameNumber = Number(card.dataset.frame);
        const frame = frames[frameNumber - 1];
        const shots = getFrameShots(frame.id);
        const isCurrent = frameNumber === currentFrame;

        card.classList.toggle("is_current", isCurrent);

        if (isCurrent) {
            card.setAttribute("aria-current", "step");
        } else {
            card.removeAttribute("aria-current");
        }

        card.querySelectorAll(".frame_rolls span").forEach((cell, index) => {
            const shotNumber = index + 1;
            const shotId = shots[index];
            const active = isCurrent && shotNumber === currentShot;

            cell.classList.toggle("is_current_shot", active && !gameFinished);
            cell.textContent = "";
            cell.removeAttribute("title");

            if (!shotId) return;

            let result = getShotResult(shotId);
            const leave = getPinLeave(shotId);

            // Preview the active shot before Next confirms it.
            if (!result && active && leave !== null) {
                const startingPins = getStartingPins(frameNumber, shotNumber);

                result = {
                    pins: currentFoul ? 0 : startingPins.length - leave.length,
                    foul: currentFoul
                };
            }

            if (!result) return;

            cell.textContent = getShotSymbol(frameNumber, shotNumber, result);
            cell.title = result.foul
                ? "Foul — 0 pins credited"
                : `${result.pins} pins knocked down`;
        });

        card.querySelector(".frame_total").textContent =
            totals[frameNumber - 1] ?? "—";
    });
}

function isStrikeOpportunity(frameNumber, shotNumber) {
    if (shotNumber === 1) return true;

    if (frameNumber !== 10) return false;

    const shots = getFrameShots(frames[frameNumber - 1].id);
    const previousLeave = getPinLeave(shots[shotNumber - 2]);

    // A fresh bonus rack after a strike or spare.
    return previousLeave?.length === 0;
}

function getShotSymbol(frameNumber, shotNumber, result) {
    if (result.foul) return "F";

    if (result.pins === 10 &&
        isStrikeOpportunity(frameNumber, shotNumber)) {
        return "X";
    }

    const startingPins = getStartingPins(frameNumber, shotNumber);

    if (
        shotNumber > 1 &&
        !isStrikeOpportunity(frameNumber, shotNumber) &&
        result.pins === startingPins.length
    ) {
        return "/";
    }

    return result.pins === 0 ? "-" : String(result.pins);
}

function calculateFrameTotals() {
    const results = frames.map((frame) =>
        getFrameShots(frame.id)
            .map(getShotResult)
            .filter((result) => result !== null)
    );

    const totals = Array(FRAME_COUNT).fill(null);
    let cumulative = 0;

    for (let index = 0; index < FRAME_COUNT; index++) {
        const rolls = results[index].map((result) => result.pins);

        if (rolls.length === 0) break;

        // Frame 10 includes its own bonus shots.
        if (index === 9) {
            const bonusEarned =
                rolls[0] === 10 ||
                (rolls.length >= 2 && rolls[0] + rolls[1] === 10);

            const requiredShots = bonusEarned ? 3 : 2;
            if (rolls.length < requiredShots) break;

            cumulative += rolls.reduce((sum, pins) => sum + pins, 0);
            totals[index] = cumulative;
            break;
        }

        const followingRolls = results
            .slice(index + 1)
            .flatMap((shots) => shots.map((result) => result.pins));

        if (rolls[0] === 10) {
            if (followingRolls.length < 2) break;

            cumulative += 10 + followingRolls[0] + followingRolls[1];
        } else {
            if (rolls.length < 2) break;

            const framePins = rolls[0] + rolls[1];

            if (framePins === 10) {
                if (followingRolls.length < 1) break;

                cumulative += 10 + followingRolls[0];
            } else {
                cumulative += framePins;
            }
        }

        totals[index] = cumulative;
    }

    return totals;
}

frameStrip.addEventListener("pointerup", stopDragging);
frameStrip.addEventListener("pointercancel", stopDragging);
frameStrip.addEventListener("lostpointercapture", stopDragging);

updateFrame();

// Complete the pending Finish action after a successful login or signup reload.
if (gameFinished && gameState.finishRequested && getAuthToken() !== null) {
    finishGame();
}
