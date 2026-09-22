import "../css/navbar.css";
import "./theme.js";
import { getAuthToken, logOut } from "./authentication.js"


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

export function loadNavbar() {
    const navbar = document.querySelector("navbar");

    const notLoggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section id="log-in">Log In</div>
        <div class="dropdown_section" id="sign-up">Sign Up</div>
    </div>
    `

    const loggedInPfpDropdownHTML = `
    <div class="dropdown_area">
        <div class="dropdown_section id="account-settings">Account Settings</div>
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
                        <img
                            src="/icons/default_pfp.png"
                            class="profile_picture"
                            id="profile-picture"
                        >
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

    document.getElementById("hamburger-button").addEventListener("click", openSidebar);
    document.getElementById("close-sidebar-button").addEventListener("click", closeSidebar);
    document.getElementById("home-button").addEventListener("click", goHome);
    document.getElementById("profile-picture-container").addEventListener("click", togglePfpDropdown);

    // Login popup
    if (!document.getElementById("login_popup")) {
        document.body.insertAdjacentHTML("beforeend", `
            <dialog id="login_popup" aria-labelledby="login_title">
                <h2 id="login_title">Log In</h2>

                <p>
                    <label for="login_email">Email</label>
                    <input id="login_email" type="email" placeholder="Email">
                </p>

                <p>
                    <label for="login_password">Password</label>
                    <input
                        id="login_password"
                        type="password"
                        placeholder="Password"
                    >
                </p>

                <button type="button">Log In</button>
                <button type="button" id="close_login">Close</button>
            </dialog>
        `);

        document.getElementById("close_login").addEventListener("click", () => {
            document.getElementById("login_popup").close();
        });
    }

    document.getElementById("login-button").addEventListener("click", () => {
        const dropdown = document.getElementById("pfp-dropdown");
        dropdown.classList.remove("pfp_dropdown_active");
        dropdown.classList.add("pfp_dropdown_inactive");

        document.getElementById("login_popup").showModal();
    });

    document.getElementById("signup-button").addEventListener("click", () => {
        window.location.href = "/signup.html";
    });
    const logOutButton = document.getElementById("log-out");
    if (logOutButton != null) logOutButton.addEventListener("click", logOut);
}