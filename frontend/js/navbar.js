/** Implements the site navbar, sidebar, and its authentication controls. */
import "../css/navbar.css";
import "../css/responsive.css";
import "./theme.js";
import { initializeLanguage, syncAccountLanguage } from "./language.js";
import { clearAuthToken, getAuthToken, logOut, setAuthToken } from "./authentication.js";
import { addPfpToContainer } from "./data_handling.js";
import { createAuthPopup, openAuthPopup, createLogoutPopup, showLogOutPopup } from "./popups.js";
import { retryConnection } from "./reconnect.js";
import "./api_client.js";

retryConnection(true);

let swipeListeners;
function enableMenuSwipe() {
    swipeListeners?.abort();
    swipeListeners = new AbortController();
    const signal = swipeListeners.signal;
    let start = null;
    let suppressClickUntil = 0;
    const blocked = "input, textarea, select, button, a, [contenteditable], dialog, .lane_panel";
    document.body.addEventListener("touchstart", event => {
        start = null;
        if (event.touches.length !== 1 || window.matchMedia("(min-width: 1100px)").matches ||
            document.querySelector("dialog[open]") || event.target.closest(blocked)) return;
        // Leave horizontal scorecards, tables, and carousels to their own gestures.
        for (let node = event.target; node && node !== document.body; node = node.parentElement) {
            if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
        }
        const touch = event.touches[0];
        if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
        start = { x: touch.clientX, y: touch.clientY, id: touch.identifier, time: event.timeStamp,
            open: document.body.classList.contains("navigation-open") };
    }, { passive: true, signal });
    document.body.addEventListener("touchmove", event => {
        if (!start) return;
        if (event.touches.length !== 1) { start = null; return; }
        const touch = event.touches[0];
        const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
        if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { start = null; return; }
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5 &&
            (start.open ? dx < 0 : dx > 0) && event.cancelable) event.preventDefault();
    }, { passive: false, signal });
    document.body.addEventListener("touchend", event => {
        const gesture = start;
        start = null;
        if (!gesture || event.touches.length || window.matchMedia("(min-width: 1100px)").matches) return;
        const touch = [...event.changedTouches].find(item => item.identifier === gesture.id);
        if (!touch) return;
        const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
        if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.5 || event.timeStamp - gesture.time > 1000) return;
        if (!gesture.open && dx > 0) openSidebar();
        else if (gesture.open && dx < 0) closeSidebar();
        else return;
        suppressClickUntil = performance.now() + 400;
    }, { passive: true, signal });
    document.body.addEventListener("touchcancel", () => { start = null; }, { passive: true, signal });
    document.body.addEventListener("click", event => {
        if (event.detail && performance.now() < suppressClickUntil) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, { capture: true, signal });
}

function updateSidebarAccessibility() {
    const sidebar = document.getElementById("sidebar");
    const desktop = window.matchMedia("(min-width: 1100px)").matches;
    const open = desktop || sidebar.classList.contains("sidebar_active");
    sidebar.inert = !open;
    sidebar.setAttribute("aria-hidden", String(!open));
    document.getElementById("hamburger-button").setAttribute("aria-expanded", String(open));
    document.getElementById("sidebar-backdrop").hidden = desktop || !open;
    document.body.classList.toggle("navigation-open", !desktop && open);
}

export function openSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.replace("sidebar_inactive", "sidebar_active");
    updateSidebarAccessibility();
    document.getElementById("close-sidebar-button").focus();
}

export function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.replace("sidebar_active", "sidebar_inactive");
    updateSidebarAccessibility();
    if (!window.matchMedia("(min-width: 1100px)").matches && sidebar.contains(document.activeElement)) {
        document.getElementById("hamburger-button").focus();
    }
    navigator.vibrate?.(10);
}

export function goHome() {window.location.href = "/index.html";}
export function goToGames() {window.location.href = "/games.html";}
export function goToStartGame() {window.location.href = "/index.html?start_game=1";}
export function goToBallArsenal() {window.location.href = "/ball_arsenal.html";}
export function goToCompareBalls() {window.location.href = "/compare_balls.html";}
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
    document.body.classList.add("has-app-shell");

    const notLoggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section" id="login-button" data-i18n="Log In">Log In</div>
        <div class="dropdown_section" id="signup-button" data-i18n="Sign Up">Sign Up</div>
    </div>
    `;

    const loggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section" id="account-settings-button" data-i18n="Account Settings">Account Settings</div>
        <div class="dropdown_section" id="log-out-button" data-i18n="Log Out">Log Out</div>
    </div>
    `;

    let pfpDropdownHTML = notLoggedInPfpDropdownHTML;

    if (getAuthToken() != null) {
        pfpDropdownHTML = loggedInPfpDropdownHTML;
    }


    navbar.innerHTML = `
        <button type="button" class="sidebar-backdrop" id="sidebar-backdrop" aria-label="Close navigation" hidden></button>
        <div class="sidebar sidebar_inactive" id="sidebar" role="navigation" aria-label="Main navigation">
            <div class="sidebar-brand">REVMETRIX</div>
            <div class="sidebar_section sidebar_section_close_sidebar">
                <button type="button" class="close_sidebar_button" id="close-sidebar-button" aria-label="Close navigation">
                    <div></div>
                    <div></div>
                </button>
            </div>

            <div class="sidebar_links">
            <div class="sidebar_section">
                <button class="home_button sidebar_button" id="home-button" data-i18n="Home">Home</button>
            </div>
            <div class="sidebar_section">
                <button class="sidebar_button" id="start-game-nav-button" data-i18n="Start Game">Start Game</button>
            </div>
            <div class="sidebar_section">
                <button class="sidebar_button" id="games-button" data-i18n="Games">Games</button>
            </div>
            <div class="sidebar_section">
                <button class="ball_arsenal_button sidebar_button" id="ball-arsenal-button" data-i18n="Ball Arsenal">Ball Arsenal</button>
            </div>
            <div class="sidebar_section">
                <button class="compare_balls_button sidebar_button" id="compare-balls-button" data-i18n="Compare Balls">Compare Balls</button>
            </div>
            <div class="sidebar_section">
                <button class="establishments_button sidebar_button" id="establishments-button" data-i18n="Establishments">Establishments</button>
            </div>
            <div class="sidebar_section">
                <button class="events_button sidebar_button" id="events-button" data-i18n="Events">Events</button>
            </div>
            <div class="sidebar_section">
                <button class="sidebar_button stats_button" id="stats-button" data-i18n="Stats">Stats</button>
            </div>



            <div class="sidebar_section">
                <button class="sidebar_button" id="sidebar-account-settings-button" data-i18n="Account Settings">Account Settings</button>
            </div>
            </div>
            <div class="sidebar_section language-preference">
                <label for="sidebar-language" data-i18n="Language">Language</label>
                <select id="sidebar-language" data-language-picker></select>
                <span role="status" data-language-status></span>
            </div>
            <div class="sidebar_auth" id="sidebar-auth">
                <button class="sidebar_login_button" id="sidebar-login-button" data-i18n="Log In">Log In</button>
                <button class="sidebar_logout_button" id="sidebar-logout-button" data-i18n="Log Out">Log Out</button>
            </div>
        </div>

        <div class="navbar" id="navbar">
            <h1>REVMETRIX</h1>

            <div class="navbar_body">
                <div class="elements_container">
                    <button type="button" class="hamburger_button" id="hamburger-button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">
                        <div></div>
                        <div></div>
                        <div></div>
                    </button>

                    <button type="button" class="profile_picture_container" id="profile-picture-container" aria-label="Open account menu">
                    </button>

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
        .getElementById("compare-balls-button")
        .addEventListener("click", goToCompareBalls);
    document
        .getElementById("establishments-button")
        .addEventListener("click", goToEstablishments);
    document
        .getElementById("events-button")
        .addEventListener("click", goToEvents);




    document
        .getElementById("stats-button")
        .addEventListener("click", goToStats);


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
    document.getElementById("sidebar-backdrop").addEventListener("click", () => {
        closeSidebar();
        document.getElementById("hamburger-button").focus();
    });
    document.getElementById("sidebar-account-settings-button").addEventListener("click", goToAccountSettings);
    document.getElementById("start-game-nav-button").addEventListener("click", goToStartGame);
    document.getElementById("games-button").addEventListener("click", goToGames);
    const routes = {
        "home-button": "index.html",
        "games-button": "games.html",
        "ball-arsenal-button": "ball_arsenal.html",
        "compare-balls-button": "compare_balls.html",
        "establishments-button": "establishments.html",
        "events-button": "events.html",
        "stats-button": "stats.html",
        "sidebar-account-settings-button": "account_settings.html",
    };
    let page = window.location.pathname.split("/").pop() || "index.html";
    if (page === "game.html" || page === "game_info.html") page = "games.html";
    for (const [id, path] of Object.entries(routes)) {
        if (path === page) document.getElementById(id).setAttribute("aria-current", "page");
    }
    const desktopQuery = window.matchMedia("(min-width: 1100px)");
    desktopQuery.addEventListener("change", () => {
        closeSidebar();
        if (!desktopQuery.matches) document.getElementById("hamburger-button").focus();
    });
    navbar.addEventListener("keydown", event => {
        if (desktopQuery.matches || !document.body.classList.contains("navigation-open")) return;
        if (event.key === "Escape") {
            closeSidebar();
            document.getElementById("hamburger-button").focus();
        }
        if (event.key === "Tab") {
            const controls = [...document.getElementById("sidebar").querySelectorAll("button:not(.hidden), select")]
                .filter(element => !element.disabled);
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    updateSidebarAccessibility();
    enableMenuSwipe();
    initializeLanguage();
    void syncAccountLanguage();

}
