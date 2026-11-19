import { getAuthToken, logOut, submitAuth } from "./authentication.js";
import setupStyles from "../css/gameSetup.css?inline";
import { listAll } from "./game_persistence.js";
import { translate } from "./language.js";

// Authentication dialogs
export function openAuthPopup(id) {
    const dropdown = document.getElementById("pfp-dropdown");
    const popup = document.getElementById(id);

    if (!popup) return;

    dropdown?.classList.remove("pfp_dropdown_active");
    dropdown?.classList.add("pfp_dropdown_inactive");

    popup.showModal();
    popup.classList.add("is_entering");

    requestAnimationFrame(() => {
        popup.classList.remove("is_entering");
    });
}

export function createAuthPopup(type) {
    const popupId = `${type}_popup`;

    if (document.getElementById(popupId)) {
        return;
    }

    const isSignup = type === "signup";
    const title = isSignup ? "Create Account" : "Log In";
    const buttonText = isSignup ? "Sign Up" : "Log In";
    const switchText = isSignup
        ? "Log in instead"
        : "Sign up instead";

    const switchPopupId = isSignup
        ? "login_popup"
        : "signup_popup";

    document.body.insertAdjacentHTML("beforeend", `
        <dialog
            id="${popupId}"
            class="auth_popup"
            aria-labelledby="${type}_title"
        >
            <div class="popup_drag_area">
                <span class="popup_handle"></span>
            </div>

            <div class="popup_content">
                <h2 id="${type}_title">${title}</h2>

                ${isSignup ? `
                    <p class="popup_description">
                        Sign up to get started.
                    </p>

                    <label for="signup_username" data-i18n="Username">Username</label>
                    <input
                        id="signup_username"
                        type="text"
                        class="text_input"
                        placeholder="Your username"
                        autocomplete="username"
                        minlength="3"
                        maxlength="100"
                    >

                    <label for="signup_display_name">
                        Display name (optional)
                    </label>
                    <input
                        id="signup_display_name"
                        type="text"
                        class="text_input"
                        placeholder="How your name appears"
                        autocomplete="nickname"
                        maxlength="100"
                    >
                ` : ""}

                <label for="${type}_email">
                    ${isSignup ? "Email" : "Username"}
                </label>
                <input
                    id="${type}_email"
                    type="${isSignup ? "email" : "text"}"
                    class="text_input"
                    placeholder="${isSignup ? "Your email" : "Your username"}"
                    autocomplete="${isSignup ? "email" : "username"}"
                    maxlength="${isSignup ? "255" : "100"}"
                >

                <label for="${type}_password" data-i18n="Password">Password</label>
                <input
                    id="${type}_password"
                    type="password"
                    class="text_input"
                    placeholder="${isSignup ? "At least 8 characters" : "Your password"}"
                    autocomplete="${isSignup ? "new-password" : "current-password"}"
                    maxlength="128"
                >
                <button type="button" class="password_visibility" aria-controls="${type}_password" aria-pressed="false">Show password</button>

                ${isSignup ? "" : '<a href="/reset_password.html">Forgot password?</a>'}

                <button type="button" class="popup_primary">
                    ${buttonText}
                </button>

                <button type="button" class="popup_switch">
                    ${switchText}
                </button>

                <button type="button" class="popup_close" data-i18n="Close">
                    Close
                </button>
            </div>
        </dialog>
    `);

    const popup = document.getElementById(popupId);
    const password = document.getElementById(`${type}_password`);
    const visibility = popup.querySelector(".password_visibility");
    visibility.addEventListener("click", () => {
        const show = password.type === "password";
        password.type = show ? "text" : "password";
        visibility.textContent = show ? "Hide password" : "Show password";
        visibility.setAttribute("aria-pressed", String(show));
    });
    popup.addEventListener("close", () => {
        password.type = "password";
        visibility.textContent = "Show password";
        visibility.setAttribute("aria-pressed", "false");
    });

    setupPopupDrag(popup);

    popup.querySelector(".popup_primary")?.addEventListener(
        "click",
        () => submitAuth(type),
    );

    popup.addEventListener("keydown", (event) => {
        if (
            event.key !== "Enter"
            || event.isComposing
            || !(event.target instanceof HTMLInputElement)
        ) {
            return;
        }

        event.preventDefault();

        const submitButton = popup.querySelector(".popup_primary");
        if (!submitButton?.disabled) {
            submitAuth(type);
        }
    });

    popup.querySelector(".popup_switch")?.addEventListener(
        "click",
        () => {
            if (popup.querySelector(".popup_primary")?.disabled) {
                return;
            }

            popup.classList.add("is_switching_out");

            let switched = false;

            const finishSwitch = () => {
                if (switched) return;
                switched = true;

                popup.close();
                popup.classList.remove("is_switching_out");
                openAuthPopup(switchPopupId);
            };

            const onTransitionEnd = (event) => {
                if (
                    event.target === popup
                    && event.propertyName === "transform"
                ) {
                    popup.removeEventListener(
                        "transitionend",
                        onTransitionEnd,
                    );

                    if (popup.open) {
                        finishSwitch();
                    }
                }
            };

            popup.addEventListener(
                "transitionend",
                onTransitionEnd,
            );

            // Handle disabled or interrupted transitions.
            window.setTimeout(() => {
                popup.removeEventListener(
                    "transitionend",
                    onTransitionEnd,
                );

                if (
                    popup.open
                    && popup.classList.contains("is_switching_out")
                ) {
                    finishSwitch();
                } else {
                    popup.classList.remove("is_switching_out");
                }
            }, 250);
        },
    );
}

export function createBallPopup(onConfirm) {
    if (document.getElementById("add-ball-popup")) return;

    document.body.insertAdjacentHTML("beforeend", `
        <dialog
            id="add-ball-popup"
            class="auth_popup ball_popup"
            aria-labelledby="add-ball-title"
        >
            <div class="popup_drag_area">
                <span class="popup_handle"></span>
            </div>

            <div class="popup_content">
                <h2 id="add-ball-title">Add a Ball</h2>

                <form id="add-ball-form" autocomplete="off">
                    <label for="new-ball-name">Ball name</label>
                    <input
                        class="text_input"
                        id="new-ball-name"
                        name="ball_name"
                        type="text"
                        autocomplete="off"
                        placeholder="Ball name"
                        maxlength="255"
                        required
                    >

                    <label for="new-ball-color" data-i18n="Color">Color</label>
                    <input
                        class="ball_color_input"
                        id="new-ball-color"
                        name="color"
                        type="color"
                        required
                    >

                    <label id="new-ball-core-label" for="new-ball-core-trigger">Core type</label>
                    <div class="ball_core_picker">
                        <input id="new-ball-core" name="core_type" type="hidden">
                        <button
                            class="ball_core_picker_trigger"
                            id="new-ball-core-trigger"
                            type="button"
                            aria-labelledby="new-ball-core-label new-ball-core-trigger"
                            aria-haspopup="listbox"
                            aria-expanded="false"
                            aria-controls="new-ball-core-options"
                        >Select a core type</button>
                        <div
                            class="ball_core_picker_options"
                            id="new-ball-core-options"
                            role="listbox"
                            aria-labelledby="new-ball-core-label"
                            hidden
                        >
                            <button type="button" role="option" aria-selected="false" data-value="Symmetric">Symmetric</button>
                            <button type="button" role="option" aria-selected="false" data-value="Asymmetric">Asymmetric</button>
                        </div>
                    </div>

                    <label for="new-ball-weight">Weight (lbs)</label>
                    <input
                        class="text_input"
                        id="new-ball-weight"
                        name="weight"
                        type="number" min="1" max="16"
                        step="1"
                        placeholder="e.g. 14"
                        required
                    >

                    <p class="ball_popup_error" id="add-ball-error" role="alert" hidden></p>

                    <div class="ball_popup_actions">
                        <button class="popup_close" type="button" data-i18n="Cancel">Cancel</button>
                        <button class="popup_primary" type="submit">Confirm</button>
                    </div>
                </form>
            </div>
        </dialog>
    `);

    const popup = document.getElementById("add-ball-popup");
    setupPopupDrag(popup);
    const form = popup.querySelector("#add-ball-form");
    const confirmButton = form.querySelector('[type="submit"]');
    const errorMessage = popup.querySelector("#add-ball-error");
    const colorInput = form.querySelector("#new-ball-color");
    const coreInput = form.querySelector("#new-ball-core");
    const coreTrigger = form.querySelector("#new-ball-core-trigger");
    const coreOptions = form.querySelector("#new-ball-core-options");
    const coreOptionButtons = [...coreOptions.querySelectorAll('[role="option"]')];
    const corePlaceholder = "Select a core type";

    const themeBallColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--button-color-1").trim();
    colorInput.value = themeBallColor;
    colorInput.setAttribute("value", themeBallColor);

    function closeCoreOptions() {
        coreOptions.hidden = true;
        coreTrigger.setAttribute("aria-expanded", "false");
    }

    function resetCorePicker() {
        coreInput.value = "";
        coreTrigger.textContent = corePlaceholder;
        coreOptionButtons.forEach((option) => {
            option.setAttribute("aria-selected", "false");
        });
        closeCoreOptions();
    }

    coreTrigger.addEventListener("click", () => {
        const expanded = coreTrigger.getAttribute("aria-expanded") === "true";
        coreOptions.hidden = expanded;
        coreTrigger.setAttribute("aria-expanded", String(!expanded));
    });

    coreOptionButtons.forEach((option) => {
        option.addEventListener("click", () => {
            coreInput.value = option.dataset.value;
            coreTrigger.textContent = option.textContent;
            coreOptionButtons.forEach((candidate) => {
                candidate.setAttribute(
                    "aria-selected",
                    String(candidate === option),
                );
            });
            closeCoreOptions();
            coreTrigger.focus();
        });
    });

    form.querySelector(".popup_close").addEventListener("click", () => {
        form.reset();
        resetCorePicker();
        errorMessage.hidden = true;
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorMessage.hidden = true;
        if (!coreInput.value) {
            errorMessage.textContent = "Select a core type.";
            errorMessage.hidden = false;
            coreOptions.hidden = false;
            coreTrigger.setAttribute("aria-expanded", "true");
            coreTrigger.focus();
            return;
        }
        confirmButton.disabled = true;

        try {
            const values = Object.fromEntries(new FormData(form));
            await onConfirm?.(values);
            form.reset();
            resetCorePicker();
            popup.close();
        } catch (error) {
            errorMessage.textContent = error?.message || "Could not add this ball.";
            errorMessage.hidden = false;
        } finally {
            confirmButton.disabled = false;
        }
    });

    popup.addEventListener("click", (event) => {
        if (event.target === popup) popup.close();
    });
}

export function createBallFilterPopup(onApply) {
    if (document.getElementById("filter-balls-popup")) return;

    document.body.insertAdjacentHTML("beforeend", `
        <dialog
            id="filter-balls-popup"
            class="auth_popup ball_popup"
            aria-labelledby="filter-balls-title"
        >
            <div class="popup_drag_area">
                <span class="popup_handle"></span>
            </div>

            <div class="popup_content">
                <h2 id="filter-balls-title">Filter Balls</h2>
                <form id="ball-filter-form">
                    <label for="filter-weight-min">Minimum weight (lbs)</label>
                    <input
                        class="text_input"
                        id="filter-weight-min"
                        name="weight_min"
                        type="number" min="1" max="16"
                        step="1"
                        placeholder="No minimum"
                    >

                    <label for="filter-weight-max">Maximum weight (lbs)</label>
                    <input
                        class="text_input"
                        id="filter-weight-max"
                        name="weight_max"
                        type="number" min="1" max="16"
                        step="1"
                        placeholder="No maximum"
                    >

                    <label id="filter-core-label" for="filter-core-trigger">Core type</label>
                    <div class="ball_core_picker">
                        <input id="filter-core-type" name="core_type" type="hidden">
                        <button
                            class="ball_core_picker_trigger"
                            id="filter-core-trigger"
                            type="button"
                            aria-labelledby="filter-core-label filter-core-trigger"
                            aria-haspopup="listbox"
                            aria-expanded="false"
                            aria-controls="filter-core-options"
                        >Any core</button>
                        <div
                            class="ball_core_picker_options"
                            id="filter-core-options"
                            role="listbox"
                            aria-labelledby="filter-core-label"
                            hidden
                        >
                            <button type="button" role="option" aria-selected="true" data-value="">Any core</button>
                            <button type="button" role="option" aria-selected="false" data-value="Symmetric">Symmetric</button>
                            <button type="button" role="option" aria-selected="false" data-value="Asymmetric">Asymmetric</button>
                        </div>
                    </div>

                    <p class="ball_popup_error" id="filter-balls-error" role="alert" hidden></p>
                    <div class="ball_popup_actions">
                        <button class="popup_clear" type="button">Clear</button>
                        <button class="popup_close" type="button" data-i18n="Cancel">Cancel</button>
                        <button class="popup_primary" type="submit">Apply</button>
                    </div>
                </form>
            </div>
        </dialog>
    `);

    const popup = document.getElementById("filter-balls-popup");
    setupPopupDrag(popup);

    const form = popup.querySelector("#ball-filter-form");
    const errorMessage = popup.querySelector("#filter-balls-error");
    const coreInput = form.querySelector("#filter-core-type");
    const coreTrigger = form.querySelector("#filter-core-trigger");
    const coreOptions = form.querySelector("#filter-core-options");
    const coreOptionButtons = [...coreOptions.querySelectorAll('[role="option"]')];
    const applyButton = form.querySelector('[type="submit"]');
    const clearButton = form.querySelector(".popup_clear");

    function resetFilterForm() {
        form.reset();
        errorMessage.hidden = true;
        coreOptions.hidden = true;
        coreTrigger.textContent = "Any core";
        coreTrigger.setAttribute("aria-expanded", "false");
        coreOptionButtons.forEach((option) => {
            option.setAttribute("aria-selected", String(option.dataset.value === ""));
        });
    }

    coreTrigger.addEventListener("click", () => {
        const expanded = coreTrigger.getAttribute("aria-expanded") === "true";
        coreOptions.hidden = expanded;
        coreTrigger.setAttribute("aria-expanded", String(!expanded));
    });

    coreOptionButtons.forEach((option) => {
        option.addEventListener("click", () => {
            coreInput.value = option.dataset.value;
            coreTrigger.textContent = option.textContent;
            coreOptionButtons.forEach((candidate) => {
                candidate.setAttribute(
                    "aria-selected",
                    String(candidate === option),
                );
            });
            coreOptions.hidden = true;
            coreTrigger.setAttribute("aria-expanded", "false");
            coreTrigger.focus();
        });
    });

    form.querySelector(".popup_close").addEventListener("click", () => {
        resetFilterForm();
    });

    clearButton.addEventListener("click", async () => {
        resetFilterForm();
        applyButton.disabled = true;
        clearButton.disabled = true;
        try {
            await onApply?.({
                weight_min: null,
                weight_max: null,
                core_type: "",
            });
            popup.close();
        } catch (error) {
            errorMessage.textContent = error?.message || "Could not clear filters.";
            errorMessage.hidden = false;
        } finally {
            applyButton.disabled = false;
            clearButton.disabled = false;
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorMessage.hidden = true;

        const values = Object.fromEntries(new FormData(form));
        const min = values.weight_min === "" ? null : Number(values.weight_min);
        const max = values.weight_max === "" ? null : Number(values.weight_max);
        if (min !== null && max !== null && min > max) {
            errorMessage.textContent = "Minimum weight cannot exceed maximum weight.";
            errorMessage.hidden = false;
            return;
        }

        applyButton.disabled = true;
        try {
            await onApply?.({
                weight_min: min,
                weight_max: max,
                core_type: values.core_type,
            });
            popup.close();
        } catch (error) {
            errorMessage.textContent = error?.message || "Could not filter balls.";
            errorMessage.hidden = false;
        } finally {
            applyButton.disabled = false;
        }
    });

    popup.addEventListener("click", (event) => {
        if (event.target === popup) popup.close();
    });
}

export function createDeleteBallPopup(onConfirm) {
    if (document.getElementById("delete-ball-popup")) return;

    document.body.insertAdjacentHTML("beforeend", `
        <dialog
            id="delete-ball-popup"
            class="auth_popup ball_popup"
            aria-labelledby="delete-ball-title"
            aria-describedby="delete-ball-question"
        >
            <div class="popup_drag_area">
                <span class="popup_handle"></span>
            </div>

            <div class="popup_content">
                <h2 id="delete-ball-title">Delete Ball?</h2>
                <p id="delete-ball-question"></p>
                <p class="ball_popup_error" id="delete-ball-error" role="alert" hidden></p>
                <div class="ball_popup_actions">
                    <button class="popup_close" type="button" data-i18n="Cancel">Cancel</button>
                    <button class="popup_primary ball_delete_confirm" type="button" data-i18n="Delete">Delete</button>
                </div>
            </div>
        </dialog>
    `);

    const popup = document.getElementById("delete-ball-popup");
    const confirmButton = popup.querySelector(".ball_delete_confirm");
    const errorMessage = popup.querySelector("#delete-ball-error");

    setupPopupDrag(popup);

    confirmButton.addEventListener("click", async () => {
        if (!popup.dataset.ballId) return;

        errorMessage.hidden = true;
        confirmButton.disabled = true;
        try {
            await onConfirm?.({
                ball_id: popup.dataset.ballId,
                ball_name: popup.dataset.ballName,
            });
            popup.close();
        } catch (error) {
            errorMessage.textContent = error?.message || "Could not delete this ball.";
            errorMessage.hidden = false;
        } finally {
            confirmButton.disabled = false;
        }
    });

    popup.addEventListener("click", (event) => {
        if (event.target === popup) popup.close();
    });
    popup.addEventListener("close", () => {
        delete popup.dataset.ballId;
        delete popup.dataset.ballName;
    });
}

export function openDeleteBallPopup(ball) {
    const popup = document.getElementById("delete-ball-popup");
    if (!popup || popup.open || !ball) return;

    popup.dataset.ballId = String(ball.ball_id);
    popup.dataset.ballName = ball.ball_name;
    popup.querySelector("#delete-ball-question").textContent =
        `Are you sure you want to delete “${ball.ball_name}”? This cannot be undone.`;
    popup.querySelector("#delete-ball-error").hidden = true;
    openPopupWithAnimation(popup);
}

export function openBallFilterPopup(filters = {}) {
    const popup = document.getElementById("filter-balls-popup");
    if (!popup) return;

    popup.querySelector("#filter-balls-error").hidden = true;
    popup.querySelector("#filter-weight-min").value = filters.weight_min ?? "";
    popup.querySelector("#filter-weight-max").value = filters.weight_max ?? "";

    const coreInput = popup.querySelector("#filter-core-type");
    const coreTrigger = popup.querySelector("#filter-core-trigger");
    const coreOptions = popup.querySelector("#filter-core-options");
    const coreOptionButtons = [...coreOptions.querySelectorAll('[role="option"]')];
    const coreType = filters.core_type ?? "";
    const selectedCore = coreOptionButtons.find(
        (option) => option.dataset.value === coreType,
    ) ?? coreOptionButtons[0];

    coreInput.value = selectedCore.dataset.value;
    coreTrigger.textContent = selectedCore.textContent;
    coreTrigger.setAttribute("aria-expanded", "false");
    coreOptions.hidden = true;
    coreOptionButtons.forEach((option) => {
        option.setAttribute("aria-selected", String(option === selectedCore));
    });

    openPopupWithAnimation(popup);
}

export function openBallPopup() {
    const popup = document.getElementById("add-ball-popup");
    if (!popup || popup.open) return;

    openPopupWithAnimation(popup);
}

function openPopupWithAnimation(popup) {
    if (popup.open) return;

    popup.showModal();
    popup.classList.add("is_entering");

    requestAnimationFrame(() => {
        popup.classList.remove("is_entering");
    });
}

// Shared pointer and close behavior for authentication dialogs.
function setupPopupDrag(popup) {
    const dragArea = popup.querySelector(".popup_drag_area");

    let activePointer = null;
    let startY = 0;
    let distance = 0;

    function resetDrag() {
        const pointer = activePointer;

        activePointer = null;
        distance = 0;

        if (
            pointer !== null
            && dragArea.hasPointerCapture(pointer)
        ) {
            dragArea.releasePointerCapture(pointer);
        }

        popup.classList.remove("is_dragging");
        popup.style.removeProperty("transform");
    }

    dragArea.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }

        activePointer = event.pointerId;
        startY = event.clientY;
        distance = 0;

        popup.classList.add("is_dragging");
        dragArea.setPointerCapture(activePointer);
    });

    dragArea.addEventListener("pointermove", (event) => {
        if (event.pointerId !== activePointer) {
            return;
        }

        distance = Math.max(0, event.clientY - startY);
        popup.style.transform = `translateY(${distance}px)`;
    });

    dragArea.addEventListener("pointerup", (event) => {
        if (event.pointerId !== activePointer) {
            return;
        }

        const shouldClose = distance >= 90;

        resetDrag();

        if (shouldClose) {
            popup.close();
        }
    });

    dragArea.addEventListener("pointercancel", resetDrag);
    dragArea.addEventListener("lostpointercapture", resetDrag);

    popup.querySelector(".popup_close")?.addEventListener(
        "click",
        () => popup.close(),
    );

    popup.addEventListener("close", resetDrag);
}

// Logout confirmation dialog
export function createLogoutPopup() {
    if (document.getElementById("log-out-popup")) {
        return;
    }

    document.body.insertAdjacentHTML("beforeend", `
        <div
            class="log_out_overlay hidden"
            id="log-out-overlay"
        ></div>

        <div class="log_out_popup hidden" id="log-out-popup">
            <div class="log_out_popup_header_container">
                <h1>Log Out?</h1>
                <h3>
                    You will not have access to your data on this
                    device until you log in again.
                </h3>
            </div>

            <div class="log_out_popup_buttons_container">
                <button
                    class="log_out_popup_button log_out_cancel_button"
                    id="log-out-cancel"
                 data-i18n="Cancel">
                    Cancel
                </button>

                <button
                    class="log_out_popup_button log_out_confirm_button"
                    id="log-out-confirm"
                >
                    Confirm
                </button>
            </div>
        </div>
    `);

    document.getElementById("log-out-cancel")?.addEventListener(
        "click",
        hideLogOutPopup,
    );

    document.getElementById("log-out-confirm")?.addEventListener(
        "click",
        logOut,
    );
}

export function showLogOutPopup() {
    document.getElementById("log-out-popup")
        ?.classList.remove("hidden");

    document.getElementById("log-out-overlay")
        ?.classList.remove("hidden");
}

export function hideLogOutPopup() {
    document.getElementById("log-out-popup")
        ?.classList.add("hidden");

    document.getElementById("log-out-overlay")
        ?.classList.add("hidden");
}

// Transient notification
export function showMiniPopup(content = "Popup") {
    const popup = document.createElement("div");

    popup.className = "mini_popup";
    popup.textContent = content;

    document.body.append(popup);

    requestAnimationFrame(() => {
        popup.classList.add("mini_popup_visible");
    });

    setTimeout(() => {
        popup.classList.remove("mini_popup_visible");

        popup.addEventListener(
            "transitionend",
            () => popup.remove(),
            { once: true },
        );

        setTimeout(() => popup.remove(), 400);
    }, 2000);
}

const template = document.createElement("template");
template.innerHTML = `
    <style>:host { display: block; }\n${setupStyles}</style>
    <dialog class="game-setup" aria-labelledby="game-setup-title" aria-describedby="game-setup-description">
      <form>
        <h2 id="game-setup-title" data-i18n="Start Game">Start Game</h2>
        <p id="game-setup-description">Choose an event and establishment, or leave them blank.</p>
        <label for="game-setup-event">Event (optional)</label>
        <select id="game-setup-event" name="event">
          <option value="">No event</option>
        </select>
        <label for="game-setup-establishment">Establishment (optional)</label>
        <select id="game-setup-establishment" name="establishment">
          <option value="">No establishment</option>
        </select>
        <fieldset class="game-session-choice" hidden>
          <legend>Session</legend>
          <p class="game-session-summary"></p>
          <label class="new-session-option">
            <input type="checkbox" name="newSession">
            Start a new session instead
          </label>
        </fieldset>
        <p class="game-setup-note">When logged in, Next Shot saves your progress automatically. An event is optional.</p>
        <div class="game-setup-actions">
          <button type="button" class="cancel-game-setup" autofocus data-i18n="Cancel">Cancel</button>
          <button type="submit" data-i18n="Start Game">Start Game</button>
        </div>
      </form>
    </dialog>
`;

function sessionDate(value) {
    if (!value) return null;
    // The API stores UTC datetimes without an offset in SQL Server.
    const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

const SESSION_CONTINUATION_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Reusable game setup dialog.
 *
 * Add <game-setup-dialog></game-setup-dialog> to a page and import this module.
 * Call showSetup({ eventId }) to open it. On submit it emits a bubbling,
 * composed `game-setup-submit` event whose detail contains the selected event,
 * establishment, and any session continuation values.
 */
class GameSetupDialog extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.append(template.content.cloneNode(true));
        this.setupSessions = [];
        this.setupGames = [];
        this.unassignedEventId = null;
        this.matchingSession = null;
        this.openRequest = 0;

        this.dialog = this.shadowRoot.querySelector("dialog");
        this.form = this.shadowRoot.querySelector("form");
        this.eventSelect = this.shadowRoot.querySelector('[name="event"]');
        this.establishmentSelect = this.shadowRoot.querySelector('[name="establishment"]');
        this.sessionChoice = this.shadowRoot.querySelector(".game-session-choice");
        this.sessionSummary = this.shadowRoot.querySelector(".game-session-summary");
        this.newSession = this.shadowRoot.querySelector('[name="newSession"]');
        this.note = this.shadowRoot.querySelector(".game-setup-note");
        this.submitButton = this.form.querySelector('[type="submit"]');
        this.handleLanguageChange = () => this.updateTranslations();

        this.eventSelect.addEventListener("change", () => this.updateSessionChoice());
        this.establishmentSelect.addEventListener("change", () => this.updateSessionChoice());
        this.shadowRoot.querySelector(".cancel-game-setup").addEventListener("click", () => this.close());
        this.form.addEventListener("submit", (event) => this.submit(event));
        this.updateTranslations();
    }

    connectedCallback() {
        this.ownerDocument.defaultView?.addEventListener("languagechange", this.handleLanguageChange);
    }

    disconnectedCallback() {
        this.ownerDocument.defaultView?.removeEventListener("languagechange", this.handleLanguageChange);
    }

    updateTranslations() {
        for (const element of this.shadowRoot.querySelectorAll("[data-i18n]")) {
            element.textContent = translate(element.dataset.i18n);
        }
    }

    /** Open the dialog and preselect an event when one is provided. */
    async showSetup({ eventId = null } = {}) {
        const request = ++this.openRequest;
        this.form.reset();
        this.dialog.showModal();
        this.eventSelect.replaceChildren(new Option("No event", ""));
        this.establishmentSelect.replaceChildren(new Option("No establishment", ""));
        this.sessionChoice.hidden = true;
        this.matchingSession = null;
        this.setupSessions = [];
        this.setupGames = [];
        this.unassignedEventId = null;
        this.note.textContent = "When logged in, Next Shot saves your progress automatically. An event is optional.";
        this.submitButton.disabled = false;

        if (!getAuthToken()) return;

        this.submitButton.disabled = true;
        try {
            const [events, establishments, sessions, games] = await Promise.all([
                listAll("/events"), listAll("/establishments"), listAll("/sessions"), listAll("/games"),
            ]);
            if (request !== this.openRequest) return;

            this.setupSessions = sessions;
            this.setupGames = games;
            // SystemUnassigned events are hidden from /events. Infer its ID
            // from owned sessions whose event is absent from that endpoint.
            const visibleEventIds = new Set(events.map((event) => Number(event.event_id)));
            this.unassignedEventId = sessions.find((session) => !visibleEventIds.has(Number(session.event_id)))?.event_id ?? null;
            for (const event of events) {
                if (event.enabled === false || event.enabled === 0 || event.event_type === "SystemUnassigned") continue;
                const option = new Option(event.event_name, event.event_id);
                option.setAttribute("translate", "no"); this.eventSelect.append(option);
            }
            for (const establishment of establishments) {
                if (establishment.enabled === false || establishment.enabled === 0) continue;
                const option = new Option(establishment.establishment_name, establishment.establishment_id);
                option.setAttribute("translate", "no"); this.establishmentSelect.append(option);
            }

            if (eventId !== null) {
                const selected = events.find((event) => Number(event.event_id) === Number(eventId)
                    && event.enabled !== false && event.enabled !== 0 && event.event_type !== "SystemUnassigned");
                if (selected) {
                    this.eventSelect.value = String(selected.event_id);
                    const house = establishments.find((entry) => selected.location_id != null
                        && Number(entry.location_id) === Number(selected.location_id)
                        && entry.enabled !== false && entry.enabled !== 0);
                    if (house) this.establishmentSelect.value = String(house.establishment_id);
                } else {
                    this.note.textContent = "This event is no longer available. Please choose another event.";
                }
            } else {
                // Keep the most recent visit's context selected so continuation
                // is visible without reselecting it each game.
                const recent = this.recentSessions()[0];
                if (recent) {
                    const event = events.find((entry) => Number(entry.event_id) === Number(recent.event_id));
                    if (event && event.event_type !== "SystemUnassigned"
                        && event.enabled !== false && event.enabled !== 0) {
                        this.eventSelect.value = String(event.event_id);
                    }
                    const establishment = establishments.find((entry) =>
                        Number(entry.establishment_id) === Number(recent.establishment_id)
                        && entry.enabled !== false && entry.enabled !== 0,
                    );
                    if (establishment) this.establishmentSelect.value = String(establishment.establishment_id);
                }
            }
            this.updateSessionChoice();
        } catch {
            if (request === this.openRequest) {
                this.note.textContent = "Could not load your choices. You can continue without an event or establishment.";
            }
        } finally {
            if (request === this.openRequest) this.submitButton.disabled = false;
        }
    }

    close() {
        this.openRequest += 1;
        this.dialog.close();
    }

    recentSessions() {
        const now = Date.now();
        return this.setupSessions
            .filter((session) => {
                const startedAt = sessionDate(session.date_time);
                const elapsed = startedAt ? now - startedAt.getTime() : Infinity;
                return elapsed >= 0 && elapsed <= SESSION_CONTINUATION_WINDOW_MS
                    && this.setupGames.some((game) => Number(game.session_id) === Number(session.session_id));
            })
            .sort((a, b) => sessionDate(b.date_time) - sessionDate(a.date_time));
    }

    updateSessionChoice() {
        const selectedEvent = this.eventSelect.value;
        const eventId = selectedEvent ? Number(selectedEvent) : this.unassignedEventId;
        const selectedEstablishment = this.establishmentSelect.value;
        const establishmentId = selectedEstablishment ? Number(selectedEstablishment) : null;

        this.matchingSession = this.recentSessions().find((session) =>
            Number(session.event_id) === Number(eventId)
            && (session.establishment_id == null ? null : Number(session.establishment_id)) === establishmentId,
        ) ?? null;

        this.sessionChoice.hidden = !this.matchingSession;
        if (!this.matchingSession) {
            this.newSession.checked = false;
            return;
        }
        const gamesInSession = this.setupGames.filter((game) => Number(game.session_id) === Number(this.matchingSession.session_id));
        const nextGameNumber = Math.max(0, ...gamesInSession.map((game) => Number(game.game_number) || 0)) + 1;
        const startedAt = sessionDate(this.matchingSession.date_time);
        const startedLabel = startedAt
            ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(startedAt)
            : "recently";
        this.sessionSummary.textContent = `Continue the session from ${startedLabel} (${gamesInSession.length} game${gamesInSession.length === 1 ? "" : "s"}).`;
        this.sessionSummary.dataset.nextGameNumber = String(nextGameNumber);
    }

    submit(event) {
        event.preventDefault();
        const data = new FormData(this.form);
        const continuesSession = Boolean(this.matchingSession && !data.get("newSession"));
        this.close();
        this.dispatchEvent(new CustomEvent("game-setup-submit", {
            bubbles: true,
            composed: true,
            detail: {
                eventId: data.get("event") ? Number(data.get("event")) : null,
                establishmentId: data.get("establishment") ? Number(data.get("establishment")) : null,
                sessionId: continuesSession ? this.matchingSession.session_id : null,
                sessionEventId: continuesSession ? this.matchingSession.event_id : null,
                gameNumber: continuesSession ? Number(this.sessionSummary.dataset.nextGameNumber) : 1,
                startNewSession: Boolean(data.get("newSession")),
            },
        }));
    }
}

if (!customElements.get("game-setup-dialog")) {
    customElements.define("game-setup-dialog", GameSetupDialog);
}
