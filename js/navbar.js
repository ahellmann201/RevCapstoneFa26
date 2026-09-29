import "../css/navbar.css";
import "./theme.js";
import { clearAuthToken, getAuthToken, logOut, setAuthToken } from "./authentication.js"
import { addPfpToContainer } from "./data_handling.js"


export function openSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_inactive");
    sidebar.classList.add("sidebar_active");
}

export function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_active");
    sidebar.classList.add("sidebar_inactive");

    navigator.vibrate(10);
}

export function goHome() {
    window.location.href = "/index.html"
}
export function goToAccountSettings() {
    window.location.href = "/account_settings.html"
}

export function togglePfpDropdown() {
    const dropdown = document.getElementById("pfp-dropdown");
    if (dropdown.classList.contains("pfp_dropdown_inactive")) {
        dropdown.classList.add("pfp_dropdown_active");
        dropdown.classList.remove("pfp_dropdown_inactive");
        return
    }
    if (dropdown.classList.contains("pfp_dropdown_active")) {
        dropdown.classList.add("pfp_dropdown_inactive");
        dropdown.classList.remove("pfp_dropdown_active");
        return
    }
}

export function quickLogin() {
    setAuthToken("quik");
}

export function loadNavbar() {
    const navbar = document.querySelector("navbar");

    const notLoggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section" id="login-button">Log In</div>
        <div class="dropdown_section" id="signup-button">Sign Up</div>
    </div>
    `

    const loggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section" id="account-settings">Account Settings</div>
        <div class="dropdown_section" id="log-out">Log Out</div>
    </div>
    `

    var pfpDropdownHTML = notLoggedInPfpDropdownHTML;
    if (getAuthToken() != null) pfpDropdownHTML = loggedInPfpDropdownHTML;


    navbar.innerHTML = `
        <div class="sidebar sidebar_inactive" id="sidebar">
            <div class="sidebar_section sidebar_section_close_sidebar">
                <button class="close_sidebar_button" id="close-sidebar-button">
                    <div></div>
                    <div></div>
                </button>
            </div>
            <div class="sidebar_section">
                <button class="home_button" id="home-button">Home</button>
            </div>
        </div>

        <div class="navbar" id="navbar">
            <h1>REVMETRIX</h1>
            <div class="navbar_body">
                <div class="elements_container">
                    <button class="hamburger_button" id="hamburger-button">
                        <div></div>
                        <div></div>
                        <div></div>
                    </button>

                    <div class="profile_picture_container" id="profile-picture-container">
                    </div>
                    <div class="pfp_dropdown pfp_dropdown_inactive" id="pfp-dropdown">
                        <div class="dropdown_arrow_container">
                            <svg class="dropdown_arrow" viewBox="0 0 100 100">
                                <polygon points="50,0 0,100 100,100"/>
                            </svg>
                        </div>
                        ${pfpDropdownHTML}
                    </div>
                </div>
            </div>
        </div>
    `;

    addPfpToContainer("profile-picture-container", "/icons/default_pfp.png")

    document.getElementById("hamburger-button").addEventListener("click", openSidebar);
    document.getElementById("close-sidebar-button").addEventListener("click", closeSidebar);
    document.getElementById("home-button").addEventListener("click", goHome);
    document.getElementById("profile-picture-container").addEventListener("click", togglePfpDropdown);

    const accountSettingsButton = document.getElementById("account-settings");
    accountSettingsButton?.addEventListener("click", goToAccountSettings);

    // Create the login and signup popups.
    createAuthPopup("login");
    createAuthPopup("signup");

    const loginButton = document.getElementById("login-button");
    const signupButton = document.getElementById("signup-button");
    const logOutButton = document.getElementById("log-out");

    loginButton?.addEventListener("click", () => {
        openAuthPopup("login_popup");
    });

    signupButton?.addEventListener("click", () => {
        openAuthPopup("signup_popup");
    });

    logOutButton?.addEventListener("click", logOut);

   
}

function openAuthPopup(id) {
    const dropdown = document.getElementById("pfp-dropdown");
    dropdown.classList.remove("pfp_dropdown_active");
    dropdown.classList.add("pfp_dropdown_inactive");

    document.getElementById(id).showModal();
}

function createAuthPopup(type) {
    const popupId = `${type}_popup`;

    if (document.getElementById(popupId)) return;

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
                        placeholder="Your name"
                    >
                ` : ""}

                <label for="${type}_email">Email</label>
                <input
                    id="${type}_email"
                    type="email"
                    placeholder="Your email"
                >

                <label for="${type}_password">Password</label>
                <input
                    id="${type}_password"
                    type="password"
                    placeholder="Your password"
                >

                <button type="button" class="popup_primary">
                    ${buttonText}
                </button>

                <button type="button" class="popup_close">
                    Close
                </button>
            </div>
        </dialog>
    `);

    setupPopupDrag(document.getElementById(popupId));
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
        if (!event.isPrimary || event.button !== 0) return;

        activePointer = event.pointerId;
        startY = event.clientY;
        distance = 0;

        popup.classList.add("is_dragging");
        dragArea.setPointerCapture(activePointer);
    });

    dragArea.addEventListener("pointermove", (event) => {
        if (event.pointerId !== activePointer) return;

        distance = Math.max(0, event.clientY - startY);
        popup.style.transform = `translateY(${distance}px)`;
    });

    dragArea.addEventListener("pointerup", (event) => {
        if (event.pointerId !== activePointer) return;

        const shouldClose = distance >= 90;
        resetDrag();

        if (shouldClose) popup.close();
    });

    dragArea.addEventListener("pointercancel", resetDrag);
    dragArea.addEventListener("lostpointercapture", resetDrag);

    popup.querySelector(".popup_close").addEventListener("click", () => {
        popup.close();
    });

    popup.addEventListener("close", resetDrag);
}
