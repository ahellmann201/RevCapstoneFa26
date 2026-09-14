import "../css/navbar.css";
import "./theme.js";

export function hamburger() {
    alert("Just pretend this is a sidebar for now")
}

export function loadNavbar() {
    const navbar = document.querySelector("navbar");

    navbar.innerHTML = `
        <div class="navbar">
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
}