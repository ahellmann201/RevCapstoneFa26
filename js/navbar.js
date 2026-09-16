import "../css/navbar.css";
import "./theme.js";

export function openSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_inactive");
    sidebar.classList.add("sidebar_active");
}

export function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_active");
    sidebar.classList.add("sidebar_inactive");
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

        <div class="navbar" id="navbar>
            <h1>REVMETRIX</h1>
            <div class="body">
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
                        <div class="dropdown_area">
                            <div class="dropdown_section">Log In</div>
                            <div class="dropdown_section">Sign Up</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById("hamburger-button").addEventListener("click", openSidebar);
    document.getElementById("close-sidebar-button").addEventListener("click", closeSidebar);
    document.getElementById("home-button").addEventListener("click", goHome);
    document.getElementById("profile-picture-container").addEventListener("click", togglePfpDropdown);
}