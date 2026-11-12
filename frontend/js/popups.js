import { logOut, submitAuth } from "./authentication.js";

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
