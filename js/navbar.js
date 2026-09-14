import "../css/navbar.css";
import "./theme.js";

export function hamburger() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_inactive");
    sidebar.classList.add("sidebar_active");
}

export function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("sidebar_active");
    sidebar.classList.add("sidebar_inactive");
}

export function loadNavbar() {
    const navbar = document.querySelector("navbar");

    navbar.innerHTML = `
        <div class="sidebar sidebar_inactive" id="sidebar">
            <button class="close_sidebar_button" id="close-sidebar-button"></button>
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

                    <div class="profile_picture_container">
                        <img
                            src="/icons/default_pfp.png"
                            class="profile_picture"
                            id="profile-picture">
                    </div>
                </div>
            </div>
        </div>
    `;

    const hamburgerButton = document.getElementById("hamburger-button");
    hamburgerButton.addEventListener("click", hamburger);

    const closeSidebarButton = document.getElementById("close-sidebar-button");
    closeSidebarButton.addEventListener("click", closeSidebar);
}