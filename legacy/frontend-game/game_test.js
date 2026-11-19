import { loadNavbar } from "./navbar.js";
import { request } from "./api_client.js";
import { getSavedGame } from "./game_database.js";

loadNavbar();

const FRAME_COUNT = 10;
const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const frameStrip = document.getElementById("frame_strip");
const pinRack = document.getElementById("pin_rack");
const frameTitle = document.getElementById("frame_title");
const nextButton = document.getElementById("next_frame");
const gameStatus = document.getElementById("game_status");

const saveButton = document.createElement("button");
saveButton.type = "button";
saveButton.id = "save_shot";
saveButton.className = "next_button";
saveButton.textContent = "Save shot";
nextButton.before(saveButton);

let game = null;
let currentFrame = 1;
let busy = false;
let loading = false;
let blocked = false;
let message = "";

const frames = new Map();

for (let number = 1; number <= FRAME_COUNT; number++) {
    frames.set(number, {
        frame_id: null,
        shots: [],
    });

    const card = document.createElement("div");
    card.className = "frame_card";
    card.dataset.frame = number;

    const rollCount = number === 10 ? 3 : 2;

    card.innerHTML = `
        <span class="frame_number">FRAME ${number}</span>

        <div class="frame_rolls">
            ${"<span>–</span>".repeat(rollCount)}
        </div>

        <span class="frame_total">—</span>
    `;

    card.addEventListener("click", () => {
        if (
            !game
            || busy
            || loading
            || blocked
            || number > firstIncompleteFrame()
        ) {
            return;
        }

        currentFrame = number;
        message = "";
        render();
    });

    frameStrip.appendChild(card);
}

// Work out which pins remain and whether another shot is allowed.
function frameState(number, shots) {
    let standing = [...ALL_PINS];
    let freshRack = true;
    let complete = false;

    const marks = [];

    for (let index = 0; index < shots.length; index++) {
        const shot = shots[index];
        const leave = shot.pin_leave;

        if (
            complete
            || shot.shot_number !== index + 1
            || !Array.isArray(leave)
            || new Set(leave).size !== leave.length
            || leave.some((pin) => !standing.includes(pin))
        ) {
            throw new Error("Invalid saved shot sequence.");
        }

        const knockedDown = standing.length - leave.length;

        marks.push(
            leave.length === 0
                ? (freshRack ? "X" : "/")
                : (knockedDown === 0 ? "–" : String(knockedDown)),
        );

        if (number < 10) {
            complete = leave.length === 0 || index === 1;
        } else if (index === 1) {
            // An open tenth frame ends after two shots.
            complete =
                shots[0].pin_leave.length !== 0
                && leave.length !== 0;
        } else if (index === 2) {
            complete = true;
        }

        // Tenth-frame strikes and spares can earn a fresh rack.
        const resetRack = number === 10 && leave.length === 0;

        standing = resetRack ? [...ALL_PINS] : [...leave];
        freshRack = resetRack;
    }

    return {
        standing,
        complete,
        marks,
        nextShot: shots.length + 1,
    };
}

function firstIncompleteFrame() {
    for (let number = 1; number <= FRAME_COUNT; number++) {
        if (!frameState(number, frames.get(number).shots).complete) {
            return number;
        }
    }

    return FRAME_COUNT;
}

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
    { number: 1, row: 4, column: 4 },
];

pinRack.style.gridTemplateColumns =
    "repeat(8, minmax(0, 1fr))";

for (const { number, row, column } of pinLayout) {
    const pin = document.createElement("button");

    pin.type = "button";
    pin.className = "pin";
    pin.dataset.pin = number;
    pin.textContent = number;

    pin.style.gridRow = row;
    pin.style.gridColumn = `${column} / span 2`;

    pin.setAttribute(
        "aria-label",
        `Pin ${number} knocked down`,
    );
    pin.setAttribute("aria-pressed", "false");

    pin.addEventListener("click", () => {
        if (pin.disabled) return;

        const selected =
            pin.getAttribute("aria-pressed") === "true";

        pin.setAttribute("aria-pressed", String(!selected));
    });

    pinRack.appendChild(pin);
}

function render() {
    const frame = frames.get(currentFrame);
    const state = frameState(currentFrame, frame.shots);

    const locked =
        !game
        || busy
        || loading
        || blocked
        || state.complete;

    frameTitle.textContent = state.complete
        ? `Frame ${currentFrame} saved`
        : `Frame ${currentFrame} · Shot ${state.nextShot}`;

    for (const pin of pinRack.querySelectorAll(".pin")) {
        const number = Number(pin.dataset.pin);
        const isStanding = state.standing.includes(number);

        pin.disabled = locked || !isStanding;
        pin.setAttribute(
            "aria-pressed",
            String(!isStanding),
        );
    }

    let activeCard = null;

    for (const card of frameStrip.querySelectorAll(".frame_card")) {
        const number = Number(card.dataset.frame);
        const saved = frameState(number, frames.get(number).shots);

        const isCurrent = number === currentFrame;
        card.classList.toggle("is_current", isCurrent);

        if (isCurrent) {
            card.setAttribute("aria-current", "step");
            activeCard = card;
        } else {
            card.removeAttribute("aria-current");
        }

        card.querySelectorAll(".frame_rolls span").forEach(
            (span, index) => {
                span.textContent = saved.marks[index] ?? "–";
            },
        );
    }

    saveButton.disabled = locked;
    saveButton.textContent = busy ? "Saving…" : "Save shot";

    nextButton.disabled =
        !game
        || busy
        || loading
        || blocked
        || !state.complete
        || currentFrame === FRAME_COUNT;

    nextButton.textContent =
        currentFrame === FRAME_COUNT && state.complete
            ? "Game recorded"
            : "Next frame →";

    if (message) {
        gameStatus.textContent = message;
    } else if (!game) {
        gameStatus.textContent =
            "Start a saved game above to record shots.";
    } else if (loading) {
        gameStatus.textContent = "Loading saved shots…";
    } else {
        const completeGame = [...frames.entries()].every(
            ([number, value]) =>
                frameState(number, value.shots).complete,
        );

        gameStatus.textContent = completeGame
            ? "All 10 frames saved. Scores are not calculated yet."
            : `Game #${game.game_id} · Frame ${currentFrame} of 10`;
    }

    if (activeCard) {
        const cardBounds = activeCard.getBoundingClientRect();
        const stripBounds = frameStrip.getBoundingClientRect();

        frameStrip.scrollTo({
            left:
                frameStrip.scrollLeft
                + cardBounds.left
                - stripBounds.left
                - (frameStrip.clientWidth - cardBounds.width) / 2,
            behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)",
            ).matches ? "instant" : "smooth",
        });
    }
}

// Current list endpoints paginate all records owned by the account.
// Filter them to this game's frames and shots after fetching.
async function listAll(path) {
    const rows = [];
    const limit = 100;

    for (let offset = 0; ; offset += limit) {
        const page = await request(
            `${path}?limit=${limit}&offset=${offset}`,
        );

        if (!Array.isArray(page)) {
            throw new Error("Unexpected database response.");
        }

        rows.push(...page);

        if (page.length < limit) return rows;
    }
}

async function loadSavedGame() {
    const saved = getSavedGame();

    if (!saved || game || loading) return;

    game = saved;
    loading = true;
    message = "";
    render();

    try {
        const [allFrames, allShots] = await Promise.all([
            listAll("/frames"),
            listAll("/shots"),
        ]);

        const savedFrames = allFrames.filter(
            (frame) => frame.game_id === game.game_id,
        );

        for (const savedFrame of savedFrames) {
            const number = savedFrame.frame_number;
            const target = frames.get(number);

            if (!target || target.frame_id !== null) {
                throw new Error(
                    "Duplicate or invalid frames found in this game.",
                );
            }

            target.frame_id = savedFrame.frame_id;

            target.shots = allShots
                .filter(
                    (shot) => shot.frame_id === savedFrame.frame_id,
                )
                .sort(
                    (a, b) => a.shot_number - b.shot_number,
                );

            frameState(number, target.shots);
        }

        currentFrame = firstIncompleteFrame();
    } catch (error) {
        blocked = true;
        message = `Could not load progress: ${error.message}`;
    } finally {
        loading = false;
        render();
    }
}

saveButton.addEventListener("click", async () => {
    if (
        !game
        || busy
        || loading
        || blocked
    ) {
        return;
    }

    const number = currentFrame;
    const frame = frames.get(number);
    const state = frameState(number, frame.shots);

    if (state.complete) return;

    // Unselected standing pins are the pins left after this shot.
    const pinLeave = state.standing.filter((pinNumber) => {
        const pin = pinRack.querySelector(
            `[data-pin="${pinNumber}"]`,
        );

        return pin.getAttribute("aria-pressed") !== "true";
    });

    const preview = frameState(number, [
        ...frame.shots,
        {
            shot_number: state.nextShot,
            pin_leave: pinLeave,
        },
    ]);

    const mark = preview.marks.at(-1);

    busy = true;
    message = "";
    render();

    try {
        if (frame.frame_id === null) {
            const savedFrame = await request("/frames", {
                method: "POST",
                body: JSON.stringify({
                    game_id: game.game_id,
                    frame_number: number,
                    frame_result: null,
                }),
            });

            frame.frame_id = savedFrame.frame_id;
        }

        const shot = await request("/shots", {
            method: "POST",
            body: JSON.stringify({
                frame_id: frame.frame_id,
                shot_number: state.nextShot,
                throw_type:
                    mark === "X" ? "strike"
                    : mark === "/" ? "spare"
                    : null,
                pin_leave: pinLeave,
                side: null,
                position: null,
                comment: null,
                ball_id: null,
            }),
        });

        frame.shots.push(shot);

        message =
            `Saved frame ${number}, shot ${state.nextShot}.`;
    } catch (error) {
        // A lost response can occur after the server saves a record.
        // Reload from the database before allowing another submission.
        blocked = true;

        message =
            "Saving could not be confirmed. Refresh the page " +
            `to check stored progress. ${error.message}`;
    } finally {
        busy = false;
        render();
    }
});

nextButton.addEventListener("click", () => {
    if (nextButton.disabled) return;

    currentFrame++;
    message = "";
    render();
});

// Preserve mouse-drag scrolling for the scorecard.
let dragPointer = null;
let dragStartX = 0;
let scrollStart = 0;

frameStrip.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) {
        return;
    }

    dragPointer = event.pointerId;
    dragStartX = event.clientX;
    scrollStart = frameStrip.scrollLeft;

    frameStrip.scrollTo({
        left: scrollStart,
        behavior: "instant",
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

    if (
        pointer !== null
        && frameStrip.hasPointerCapture(pointer)
    ) {
        frameStrip.releasePointerCapture(pointer);
    }
}

frameStrip.addEventListener("pointerup", stopDragging);
frameStrip.addEventListener("pointercancel", stopDragging);
frameStrip.addEventListener("lostpointercapture", stopDragging);

window.addEventListener("saved-game-ready", loadSavedGame);

render();
loadSavedGame();
