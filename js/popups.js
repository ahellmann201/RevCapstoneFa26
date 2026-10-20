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

                    <label for="signup_username">Username</label>
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

                <label for="${type}_password">Password</label>
                <input
                    id="${type}_password"
                    type="password"
                    class="text_input"
                    placeholder="${isSignup ? "At least 8 characters" : "Your password"}"
                    autocomplete="${isSignup ? "new-password" : "current-password"}"
                    maxlength="128"
                >

                <button type="button" class="popup_primary">
                    ${buttonText}
                </button>

                <button type="button" class="popup_switch">
                    ${switchText}
                </button>

                <button type="button" class="popup_close">
                    Close
                </button>
            </div>
        </dialog>
    `);

    const popup = document.getElementById(popupId);

    setupPopupDrag(popup);

    popup.querySelector(".popup_primary")?.addEventListener(
        "click",
        () => submitAuth(type),
    );

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
                >
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