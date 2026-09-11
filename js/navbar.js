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
                            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDxH2djFGjf3l34_PiQU2Ugr57QRDSoR0XzZwG49lpAsUqx3Sp62582Rum&s=10"
                            class="profile_picture"
                        >
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