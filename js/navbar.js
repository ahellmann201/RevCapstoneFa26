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

export function hamburger() {
    alert("Just pretend this is a sidebar for now")
}

export function getPfp(useDefault = false) {
    if (useDefault) colorizePfp();
    else {
        document.documentElement.style.setProperty("--pfp-hue", `0`);
        document.documentElement.style.setProperty("--pfp-saturate", `0`);
        document.documentElement.style.setProperty("--pfp-sepia", `0`);
        document.documentElement.style.setProperty("--pfp-bg-brightness", `1`);
        document.documentElement.style.setProperty("--pfp-brightness", `1`);
    }
}

export function colorizePfp() {
    const pfpHue = Math.random() * 360;
    document.documentElement.style.setProperty("--pfp-hue", `${pfpHue}deg`);
}

document.addEventListener("DOMContentLoaded", pageLoad);

export function pageLoad() {
    getPfp(true);
}