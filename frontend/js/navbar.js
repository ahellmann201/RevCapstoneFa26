/** Implements the site navbar, sidebar, and its authentication controls. */
import "../css/navbar.css";
import "./theme.js";
import { clearAuthToken, getAuthToken, logOut, setAuthToken } from "./authentication.js";
import { addPfpToContainer } from "./data_handling.js";
import { createAuthPopup, openAuthPopup, createLogoutPopup, showLogOutPopup } from "./popups.js";
import { retryConnection } from "./reconnect.js";
import "./api_client.js";

retryConnection(true);

export function openSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_inactive");
    sidebar.classList.add("sidebar_active");
}


export function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_active");
    sidebar.classList.add("sidebar_inactive");

    navigator.vibrate?.(10);
}


export function goHome() {window.location.href = "/index.html";}
export function goToBallArsenal() {window.location.href = "/ball_arsenal.html";}
export function goToEstablishments() {window.location.href = "/establishments.html";}
export function goToEvents() {window.location.href = "/events.html";}
export function goToSessions() {window.location.href = "/sessions.html";}
export function goToCiclops() {window.location.href = "/ciclops.html";}
export function goToSmartDot() {window.location.href = "/smart_dot.html";}
export function goToStats() {window.location.href = "/stats.html";}
export function goToSmartWatch() {window.location.href = "/smart_watch.html";}
export function goToAccountSettings() {window.location.href = "/account_settings.html";}

export function togglePfpDropdown() {
    const dropdown = document.getElementById("pfp-dropdown");

    if (dropdown.classList.contains("pfp_dropdown_inactive")) {
        dropdown.classList.add("pfp_dropdown_active");
        dropdown.classList.remove("pfp_dropdown_inactive");
        return;
    }

    if (dropdown.classList.contains("pfp_dropdown_active")) {
        dropdown.classList.add("pfp_dropdown_inactive");
        dropdown.classList.remove("pfp_dropdown_active");
        return;
    }
}

export function loadNavbar() {
    const navbar = document.querySelector("navbar");

    const notLoggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section" id="login-button">Log In</div>
        <div class="dropdown_section" id="signup-button">Sign Up</div>
    </div>
    `;

    const loggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section" id="account-settings-button">Account Settings</div>
        <div class="dropdown_section" id="log-out-button">Log Out</div>
    </div>
    `;

    let pfpDropdownHTML = notLoggedInPfpDropdownHTML;

    if (getAuthToken() != null) {
        pfpDropdownHTML = loggedInPfpDropdownHTML;
    }


    navbar.innerHTML = `
        <div class="sidebar sidebar_inactive" id="sidebar">
            <div class="sidebar_section sidebar_section_close_sidebar">
                <button class="close_sidebar_button" id="close-sidebar-button">
                    <div></div>
                    <div></div>
                </button>
            </div>

            <div class="sidebar_section">
                <button class="home_button sidebar_button" id="home-button">Home</button>
            </div>
            <div class="sidebar_section">
                <button class="ball_arsenal_button sidebar_button" id="ball-arsenal-button">Ball Arsenal</button>
            </div>
            <div class="sidebar_section">
                <button class="establishments_button sidebar_button" id="establishments-button">Establishments</button>
            </div>
            <div class="sidebar_section">
                <button class="events_button sidebar_button" id="events-button">Events</button>
            </div>
            <div class="sidebar_section">
                <button class="sessions_button sidebar_button" id="sessions-button">Sessions</button>
            </div>
            <div class="sidebar_section">
                <button class="sidebar_button ciclops_button" id="ciclops-button">Ciclops</button>
            </div>
            <div class="sidebar_section">
                <button class="sidebar_button smart_dot_button" id="smart-button">Smart Dot</button>
            </div>
            <div class="sidebar_section">
                <button class="sidebar_button stats_button" id="stats-button">Stats</button>
            </div>
            <div class="sidebar_section">
                <button class="sidebar_button smart_watch_button" id="smart-watch-button">Smart Watch</button>
            </div>



            <div class="sidebar_auth" id="sidebar-auth">
                <button class="sidebar_login_button" id="sidebar-login-button">Log In</button>
                <button class="sidebar_logout_button" id="sidebar-logout-button">Log Out</button>
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


    addPfpToContainer("profile-picture-container", "/icons/default_pfp.png");


    document
        .getElementById("hamburger-button")
        .addEventListener("click", openSidebar);

    document
        .getElementById("close-sidebar-button")
        .addEventListener("click", closeSidebar);

    document
        .getElementById("home-button")
        .addEventListener("click", goHome);
    document
        .getElementById("ball-arsenal-button")
        .addEventListener("click", goToBallArsenal);
    document
        .getElementById("establishments-button")
        .addEventListener("click", goToEstablishments);
    document
        .getElementById("events-button")
        .addEventListener("click", goToEvents);
    document
        .getElementById("sessions-button")
        .addEventListener("click", goToSessions);


    document
        .getElementById("ciclops-button")
        .addEventListener("click", goToCiclops);

    document
        .getElementById("smart-button")
        .addEventListener("click", goToSmartDot);

    document
        .getElementById("stats-button")
        .addEventListener("click", goToStats);

    document
        .getElementById("smart-watch-button")
        .addEventListener("click", goToSmartWatch);

    document
        .getElementById("profile-picture-container")
        .addEventListener("click", togglePfpDropdown);

    document
        .getElementById("sidebar-login-button")?.addEventListener("click", () => openAuthPopup("login_popup"));
    if (getAuthToken() != null) {
        const element = document.getElementById("sidebar-login-button")
        if (element != null && !element.classList.contains("hidden")) {
            element.classList.add("hidden");
        }
    }
    document
        .getElementById("sidebar-logout-button")?.addEventListener("click", showLogOutPopup);
    if (getAuthToken() == null) {
        const element = document.getElementById("sidebar-logout-button")
        if (element != null && !element.classList.contains("hidden")) {
            element.classList.add("hidden");
        }
    }


    const accountSettingsButton = document.getElementById("account-settings-button");
    accountSettingsButton?.addEventListener("click", goToAccountSettings);


    // Create the login and signup popups.
    createAuthPopup("login");
    createAuthPopup("signup");
    createLogoutPopup();


    const loginButton = document.getElementById("login-button");
    const signupButton = document.getElementById("signup-button");
    const logOutButton = document.getElementById("log-out-button");


    loginButton?.addEventListener("click", () => {
        openAuthPopup("login_popup");
    });


    signupButton?.addEventListener("click", () => {
        openAuthPopup("signup_popup");
    });


    logOutButton?.addEventListener("click", showLogOutPopup);
}
