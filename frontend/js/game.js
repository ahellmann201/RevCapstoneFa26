import { enableSwipeNavigation } from "./swipe.js";
import { loadNavbar } from "./navbar.js";
import { getAuthToken } from "./authentication.js";
import { openAuthPopup } from "./popups.js";
import { createSavedGame, saveConfirmedShots, readSavedGame, updateShotComment } from "./game_persistence.js";
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
const requestedDatabaseId = new URLSearchParams(window.location.search ?? "").get("game_id");
const activeId = getActiveGameId();
const rememberedId = requestedDatabaseId && sessionStorage.getItem(`savedGame:${requestedDatabaseId}:cache`);
const activeMatchesDatabase = activeId && String(getGameState(activeId)?.database?.game?.game_id) === requestedDatabaseId;
const startNewGame = !requestedDatabaseId && new URLSearchParams(window.location.search ?? "").get("new") === "1";
const gameId = startNewGame ? crypto.randomUUID() : requestedDatabaseId
    ? activeMatchesDatabase ? activeId : rememberedId && getGameState(rememberedId) ? rememberedId : `database-${requestedDatabaseId}`
    : getActiveGameId() ?? crypto.randomUUID();
const gameState = getGameState(gameId) ?? { createdAt: new Date().toISOString() };
const shotComments = gameState.shotComments ??= {};
setActiveGameId(gameId);
if (startNewGame && typeof window.history?.replaceState === "function") {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
}
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
const previousButton = document.getElementById("previous_shot");
const gameStatus = document.getElementById("game_status");
const foulButton = document.getElementById("foul_button");
const gutterButton = document.getElementById("gutter_button");
const spareButton = document.getElementById("spare_button");
const strikeButton = document.getElementById("strike_button");
const finishPopup = document.getElementById("finish_game_popup");
const databaseStatus = document.createElement("p");
databaseStatus.className = "game_status";
databaseStatus.setAttribute("role", "status");
document.querySelector(".game_footer").append(databaseStatus);

const database = gameState.database ??= { frameIds: {}, shotIds: {} };
const pendingSetup = sessionStorage.getItem("pendingGameSetup");
if (pendingSetup) {
    try {
        const setup = JSON.parse(pendingSetup);
        if (!database.game && !database.eventId && !requestedDatabaseId) {
            database.selectedEventId = setup.eventId;
            database.selectedEstablishmentId = setup.establishmentId;
        }
    } catch { /* Ignore invalid setup data. */ }
    sessionStorage.removeItem("pendingGameSetup");
}
let busy = false;
let loading = Boolean(requestedDatabaseId || database.game);
let databaseMessage = "";
let viewingFrame = null;
let viewingShot = 1;
let selectedShortcut = null;
let loadFailed = false;

function confirmedFrames() {
    return frames.map((frame) => ({ ...frame, shots: getFrameShots(frame.id)
        .map((id, index) => ({ id, number: index + 1,
            result: getShotResult(id), leave: getPinLeave(id), comment: shotComments[id] ?? "",
        }))
        .filter((shot) => shot.result !== null)
        .map((shot) => ({ ...shot,
            symbol: getShotSymbol(frame.number, shot.number, shot.result),
        })),
    }));
}

function updateDatabaseControls() {
    const shots = confirmedFrames().flatMap((frame) => frame.shots);
    const pending = shots.filter((shot) => !database.shotIds[shot.id]);

    databaseStatus.textContent = databaseMessage || database.error || (database.game
        ? `Game #${database.game.game_id}. ${pending.length} confirmed shot(s) awaiting upload.`
        : "Next Shot saves your progress automatically when you are logged in.");

}

async function saveToDatabase() {
    if (busy || loading || database.blocked) return;
    if (getAuthToken() === null) {
        databaseMessage = "Log in or sign up before saving to the database. Your local game is kept.";
        updateDatabaseControls();
        openAuthPopup("login_popup");
        return;
    }
    busy = true;
    databaseMessage = "";
    updateFrame();
    try {
        await createSavedGame(database, cacheGameProgress);
        sessionStorage.setItem(`savedGame:${database.game.game_id}:cache`, gameId);
        await saveConfirmedShots(database, confirmedFrames(), cacheGameProgress);
        databaseMessage = "All confirmed shots saved.";
        if (typeof window.history?.replaceState === "function") {
            // Keep the local cache key until a reload; the URL enables database recovery.
            const url = new URL(window.location.href);
            url.searchParams.set("game_id", database.game.game_id);
            window.history.replaceState(null, "", url);
        }
    } catch (error) {
        database.blocked = true;
        databaseMessage = database.game
            ? `Saving could not be confirmed. Your local shots are kept. Refresh to reconcile saved progress before retrying. ${error.message}`
            : `Game creation could not be confirmed. Your local shots are kept. Check the API's saved records before retrying to avoid duplicate games. ${error.message}`;
        database.error = databaseMessage;
    } finally {
        busy = false;
        cacheGameProgress();
        updateFrame();
    }
}


function cacheGameProgress() {
    Object.assign(gameState, { currentFrame, currentShot, gameFinished, currentFoul });
    setGameState(gameId, gameState);
}

async function finishGame() {
    if (getAuthToken() === null) {
        finishPopup.showModal();
        return;
    }

    if (busy || loading) return;
    if (confirmedFrames().some((frame) => frame.shots.some((shot) => !database.shotIds[shot.id]))) {
        await saveToDatabase();
        if (!database.blocked) return finishGame();
        updateDatabaseControls();
        return;
    }
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
    const locked = gameFinished || busy || loading || loadFailed || database.blocked || viewingFrame !== null;

    foulButton.disabled = locked;
    gutterButton.disabled = locked;
    strikeButton.disabled = locked || !strikeAllowed;
    spareButton.disabled =
        locked || currentShot === 1 || strikeAllowed;

    foulButton.setAttribute("aria-pressed", String(currentFoul));
    gutterButton.setAttribute("aria-pressed", String(selectedShortcut === "gutter"));
    strikeButton.setAttribute("aria-pressed", String(selectedShortcut === "strike"));
}

function applyShortcut(type) {
    if (gameFinished || busy || loading || loadFailed || database.blocked || viewingFrame !== null) return;
    selectedShortcut = type;

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

        <span class="frame_total">&mdash;</span>
    `;

    frameStrip.appendChild(card);
    card.addEventListener("click", () => {
        if (busy || loading || loadFailed || frame > currentFrame) return;
        viewingFrame = frame;
        viewingShot = 1;
        updateFrame();
    });
    card.querySelectorAll(".frame_rolls span").forEach((cell, index) => {
        cell.addEventListener("click", (event) => {
            event.stopPropagation();
            if (busy || loading || loadFailed || frame > currentFrame) return;
            const shot = getFrameShots(frameId)[index];
            if (!shot || (frame === currentFrame && index + 1 > currentShot)) return;
            viewingFrame = frame;
            viewingShot = index + 1;
            updateFrame();
        });
    });
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
    if (gameFinished || busy || loading || pin.disabled) return;

    currentFoul = false;
    selectedShortcut = null;

    const knockedDown = pin.getAttribute("aria-pressed") === "true";
    pin.setAttribute("aria-pressed", String(!knockedDown));

    cacheLeave();
    updateShortcutButtons();
    cacheGameProgress();
    });

    pinRack.appendChild(pin);
});

function updateFrame() {
    const displayedFrame = viewingFrame ?? currentFrame;
    const displayedShots = getFrameShots(frames[displayedFrame - 1].id);
    const displayedShot = viewingFrame === null ? currentShot : viewingShot;
    const startingPins = getStartingPins(displayedFrame, displayedShot);
    const leave = getPinLeave(displayedShots[displayedShot - 1]) ?? startingPins;

    frameTitle.textContent = `Frame ${displayedFrame} \u00b7 Shot ${displayedShot}`;

    gameStatus.textContent = gameFinished
        ? "Game complete"
        : `Frame ${currentFrame} of ${FRAME_COUNT} \u00b7 Shot ${currentShot}`;

    if (selectedShortcut && viewingFrame === null && !gameFinished) {
        const name = selectedShortcut[0].toUpperCase() + selectedShortcut.slice(1);
        gameStatus.textContent += ` — ${name} selected. Next Shot confirms it.`;
    }

    pinRack.querySelectorAll(".pin").forEach((pin) => {
        const number = Number(pin.dataset.pin);

        pin.setAttribute(
            "aria-pressed",
            String(!leave.includes(number))
        );

        pin.disabled = gameFinished || busy || loading || loadFailed || viewingFrame !== null || !startingPins.includes(number);
    });

    renderScorecard();

    const activeCard = frameStrip.querySelector(
        `[data-frame="${displayedFrame}"]`
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

    nextButton.textContent = viewingFrame !== null ? "Return to current frame" : gameFinished
        ? "Finish"
        : 'Next Shot';
    nextButton.disabled = busy || loading || loadFailed || Boolean(database.blocked);

    previousButton.disabled = busy || loading || loadFailed ||
        ((viewingFrame ?? currentFrame) === 1 && (viewingFrame === null ? currentShot : viewingShot) === 1);
    updateShortcutButtons();
    cacheGameProgress();
    updateDatabaseControls();
    document.getElementById("comment_button").disabled = busy || loading || loadFailed;
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

nextButton.addEventListener("click", async () => {
    if (busy || loading || loadFailed || database.blocked) return;
    if (viewingFrame !== null) {
        viewingFrame = null;
        updateFrame();
        return;
    }
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
    selectedShortcut = null;
    updateFrame();
    if (getAuthToken() !== null) await saveToDatabase();
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
        const isCurrent = frameNumber === (viewingFrame ?? currentFrame);

        card.classList.toggle("is_current", isCurrent);

        if (isCurrent) {
            card.setAttribute("aria-current", "step");
        } else {
            card.removeAttribute("aria-current");
        }

        card.querySelectorAll(".frame_rolls span").forEach((cell, index) => {
            const shotNumber = index + 1;
            const shotId = shots[index];
            const active = isCurrent && shotNumber === (viewingFrame === null ? currentShot : viewingShot);

            cell.classList.toggle("is_current_shot", active && !gameFinished);
            cell.textContent = "";
            cell.removeAttribute("title");

            if (!shotId) return;

            let result = getShotResult(shotId);
            const leave = getPinLeave(shotId);

            // Preview the active shot before Next confirms it.
            if (!result && active && viewingFrame === null && leave !== null) {
                const startingPins = getStartingPins(frameNumber, shotNumber);

                result = {
                    pins: currentFoul ? 0 : startingPins.length - leave.length,
                    foul: currentFoul
                };
            }

            if (!result) return;

            cell.textContent = getShotSymbol(frameNumber, shotNumber, result);
            cell.title = result.foul
                ? "Foul \u2014 0 pins credited"
                : `${result.pins} pins knocked down`;
        });

        card.querySelector(".frame_total").textContent =
            totals[frameNumber - 1] ?? "\u2014";
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

async function restoreDatabaseProgress() {
    if (!loading) return;
    try {
        const saved = await readSavedGame(requestedDatabaseId ?? database.game.game_id);
        // Validate all server records before changing the local cache.
        const seen = new Set();
        const restored = saved.frames.map((remote) => {
            if (!Number.isInteger(remote.frame_number) || remote.frame_number < 1
                || remote.frame_number > 10 || seen.has(remote.frame_number)) {
                throw new Error("Duplicate or invalid saved frame.");
            }
            seen.add(remote.frame_number);
            let standing = [...ALL_PINS];
            let complete = false;
            const shots = remote.shots.map((shot, index) => {
                const leave = shot.foul === true ? [...standing] : shot.pin_leave;
                if (complete || shot.shot_number !== index + 1 || !Array.isArray(leave)
                    || new Set(leave).size !== leave.length || leave.some((pin) => !standing.includes(pin))) {
                    throw new Error("Invalid saved shot sequence.");
                }
                const result = { pins: standing.length - leave.length, foul: shot.foul === true };
                complete = remote.frame_number < 10 ? leave.length === 0 || index === 1
                    : index === 2 || (index === 1 && (remote.shots[0].foul === true || remote.shots[0].pin_leave.length !== 0) && leave.length !== 0);
                standing = remote.frame_number === 10 && leave.length === 0 ? [...ALL_PINS] : [...leave];
                const localFrame = frames[remote.frame_number - 1];
                const localShotId = getFrameShots(localFrame.id)[index];
                const localResult = localShotId && getShotResult(localShotId);
                if (localResult && (localResult.pins !== result.pins
                    || JSON.stringify(getPinLeave(localShotId).slice().sort((a,b) => a-b)) !== JSON.stringify(leave.slice().sort((a,b) => a-b)))) {
                    throw new Error("Local and database shots differ. Local progress was kept; review before saving.");
                }
                return { ...shot, pin_leave: leave, result };
            });
            return { ...remote, shots };
        });
        database.game = saved.game;
        sessionStorage.setItem(`savedGame:${saved.game.game_id}:cache`, gameId);
        database.frameIds = {};
        database.shotIds = {};
        for (const remote of restored) {
            const frame = frames[remote.frame_number - 1];
            database.frameIds[frame.id] = remote.frame_id;
            for (const [index, shot] of remote.shots.entries()) {
                const shotId = getFrameShots(frame.id)[index] ?? crypto.randomUUID();
                addFrameShot(frame.id, shotId);
                setPinLeave(shotId, shot.pin_leave);
                setShotResult(shotId, shot.result);
                database.shotIds[shotId] = shot.shot_id;
                shotComments[shotId] = shot.comment ?? "";
            }
        }
        // Resume at the first unconfirmed shot, retaining local shots not uploaded yet.
        gameFinished = true;
        for (const frame of frames) {
            const shots = getFrameShots(frame.id);
            const results = shots.map(getShotResult).filter((result) => result !== null);
            const lastLeave = results.length ? getPinLeave(shots[results.length - 1]) : ALL_PINS;
            const complete = frame.number < 10
                ? results.length >= 2 || (results.length === 1 && lastLeave.length === 0)
                : results.length >= 3 || (results.length === 2 && getPinLeave(shots[0]).length > 0 && lastLeave.length > 0);
            if (!complete) {
                currentFrame = frame.number;
                currentShot = results.length + 1;
                if (!shots[currentShot - 1]) {
                    const shotId = crypto.randomUUID();
                    addFrameShot(frame.id, shotId);
                    setPinLeave(shotId, getStartingPins(currentFrame, currentShot));
                }
                gameFinished = false;
                break;
            }
            currentFrame = frame.number;
            currentShot = results.length;
        }
        database.blocked = false;
        delete database.error;
        databaseMessage = "Database progress loaded.";
    } catch (error) {
        database.blocked = true;
        loadFailed = true;
        databaseMessage = `Could not load progress: ${error.message} Local progress is kept.`;
    } finally {
        loading = false;
        updateFrame();
    }
}

const commentDialog = document.getElementById("shot-comment-dialog");
const commentShot = document.getElementById("comment-shot");
const commentText = document.getElementById("shot-comment");
const commentStatus = document.getElementById("comment-status");
const commentSave = document.getElementById("save-comment");
const commentCancel = document.getElementById("cancel-comment");
let commentSaving = false;
const commentDrafts = new Map();
function showShotComment() {
    commentText.value = commentDrafts.get(commentShot.value) ?? shotComments[commentShot.value] ?? "";
    document.getElementById("comment-count").textContent = `${commentText.value.length} / 1000`;
}
document.getElementById("comment_button").addEventListener("click", () => {
    if (busy || loading || loadFailed || database.blocked) return;
    const frameNumber = viewingFrame ?? currentFrame;
    const shots = getFrameShots(frames[frameNumber - 1].id);
    commentShot.replaceChildren();
    commentDrafts.clear();
    shots.forEach((id, index) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = `Frame ${frameNumber} \u00b7 Shot ${index + 1}`;
        commentShot.append(option);
    });
    if (!shots.length) return;
    commentShot.value = shots[Math.min((viewingFrame === null ? currentShot : viewingShot) - 1, shots.length - 1)];
    commentStatus.textContent = "";
    showShotComment();
    commentDialog.showModal();
    commentText.focus();
});
commentShot.addEventListener("change", showShotComment);
commentText.addEventListener("input", () => {
    commentDrafts.set(commentShot.value, commentText.value);
    document.getElementById("comment-count").textContent = `${commentText.value.length} / 1000`;
});
commentCancel.addEventListener("click", () => { if (!commentSaving) commentDialog.close(); });
commentDialog.addEventListener("cancel", (event) => { if (commentSaving) event.preventDefault(); });
document.getElementById("shot-comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (commentSaving || !commentShot.value) return;
    commentDrafts.set(commentShot.value, commentText.value);
    if ([...commentDrafts.values()].some((text) => text.length > 1000)) {
        commentStatus.textContent = "Comments must be 1,000 characters or fewer.";
        return;
    }
    commentSaving = true;
    commentSave.disabled = commentCancel.disabled = commentShot.disabled = commentText.disabled = true;
    commentStatus.textContent = "";
    try {
        for (const [id, text] of commentDrafts) {
            if (database.shotIds[id]) await updateShotComment(database.shotIds[id], text);
            shotComments[id] = text;
            cacheGameProgress();
        }
        commentDialog.close();
    } catch (error) {
        commentStatus.textContent = error.message;
    } finally {
        commentSaving = false;
        commentSave.disabled = commentCancel.disabled = commentShot.disabled = commentText.disabled = false;
    }
});

updateFrame();
restoreDatabaseProgress();

if (gameFinished && gameState.finishRequested && getAuthToken() !== null && !loading) {
    finishGame();
}


function navigateShot(direction) {
    if (busy || loading || loadFailed || database.blocked || document.querySelector("dialog[open]")) return;
    if (direction === "next" && viewingFrame === null) {
        if (!gameFinished) nextButton.click();
        return;
    }
    const positions = frames.slice(0, currentFrame).flatMap(frame =>
        getFrameShots(frame.id).map((id, index) => ({ frame: frame.number, shot: index + 1, id }))
            .filter(position => position.frame === currentFrame
                ? position.shot <= currentShot
                : getShotResult(position.id) !== null));
    const index = positions.findIndex(position => position.frame === (viewingFrame ?? currentFrame) &&
        position.shot === (viewingFrame === null ? currentShot : viewingShot));
    const target = positions[index + (direction === "next" ? 1 : -1)];
    if (!target) {
        if (direction === "next" && viewingFrame !== null) {
            viewingFrame = null;
            updateFrame();
        }
        return;
    }
    viewingFrame = target.frame === currentFrame && target.shot === currentShot ? null : target.frame;
    viewingShot = target.shot;
    updateFrame();
}

previousButton.addEventListener("click", () => navigateShot("previous"));
enableSwipeNavigation(document.querySelector(".lane_panel"), navigateShot);


document.addEventListener("keydown", event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable=''], navbar")) return;
    if (document.querySelector("dialog[open], .log_out_popup:not(.hidden)") ||
        document.body.classList.contains("navigation-open")) return;
    const button = { g: gutterButton, x: strikeButton }[event.key.toLowerCase()];
    if (!button || button.disabled) return;
    event.preventDefault();
    button.click();
});
