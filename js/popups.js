import { logOut, submitAuth } from "./authentication.js";
import * as Cache from "./cache.js";

export function openAuthPopup(id) {
    const dropdown = document.getElementById("pfp-dropdown");

    dropdown.classList.remove("pfp_dropdown_active");
    dropdown.classList.add("pfp_dropdown_inactive");

    document.getElementById(id).showModal();
}


export function createAuthPopup(type) {
    const popupId = `${type}_popup`;

    if (document.getElementById(popupId)) {
        return;
    }

    const isSignup = type === "signup";
    const title = isSignup ? "Create Account" : "Log In";
    const buttonText = isSignup ? "Sign Up" : "Log In";


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

                    <label for="signup_name">Name</label>
                    <input
                        id="signup_name"
                        type="text"
                        class="text_input"
                        placeholder="Your name"
                    >
                ` : ""}

                <label for="${type}_email">Email</label>
                <input
                    id="${type}_email"
                    type="email"
                    class="text_input"
                    placeholder="Your email"
                >

                <label for="${type}_password">Password</label>
                <input
                    id="${type}_password"
                    type="password"
                    class="text_input"
                    placeholder="Your password"
                >

                <button type="button" class="popup_primary" id="submit-button">
                    ${buttonText}
                </button>

                <button type="button" class="popup_close">
                    Close
                </button>
            </div>
        </dialog>
    `);


    setupPopupDrag(document.getElementById(popupId));

    const submitButton = document.getElementById("submit-button");
    submitButton?.addEventListener("click", () => {
        submitAuth(type);
    });
}

function setupPopupDrag(popup) {
    const dragArea = popup.querySelector(".popup_drag_area");

    let activePointer = null;
    let startY = 0;
    let distance = 0;


    function resetDrag() {
        const pointer = activePointer;

        activePointer = null;
        distance = 0;

        if (pointer !== null && dragArea.hasPointerCapture(pointer)) {
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


    popup.querySelector(".popup_close").addEventListener("click", () => {
        popup.close();
    });


    popup.addEventListener("close", resetDrag);
}

export function createLogoutPopup() {
    document.body.insertAdjacentHTML("beforeend", `
        <div class="log_out_overlay hidden" id="log-out-overlay">asdfghj</div>
        <div class="log_out_popup hidden" id="log-out-popup">
            <div class="log_out_popup_header_container">
                <h1>Log Out?</h1>
                <h3>You will not have access to your data on this device until you log in again.</h3>
            </div>
            <div class="log_out_popup_buttons_container">
                <button class="log_out_popup_button log_out_cancel_button" id="log-out-cancel">Cancel</button>
                <button class="log_out_popup_button log_out_confirm_button" id="log-out-confirm">Confirm</button>
            </div>
        </div>
    `);

    const logOutCancelButton = document.getElementById("log-out-cancel");
    logOutCancelButton?.addEventListener("click", hideLogOutPopup)
    const logOutConfirmButton = document.getElementById("log-out-confirm");
    logOutConfirmButton?.addEventListener("click", logOut);
}

export function showLogOutPopup() {
    const popup = document.getElementById("log-out-popup");
    popup.classList.remove("hidden");
    const overlay = document.getElementById("log-out-overlay");
    overlay.classList.remove("hidden");
}

export function hideLogOutPopup() {
    console.log("ehfisefiusi");
    const popup = document.getElementById("log-out-popup");
    popup.classList.add("hidden");
    const overlay = document.getElementById("log-out-overlay");
    overlay.classList.add("hidden");
}