import { loadNavbar } from "./navbar.js";
import * as Requests from "./requests.js";
import { addPfpToContainer } from "./dataHandling.js";

const leftHandOverlay = document.getElementById("left-hand-overlay");
const bothHandsOverlay = document.getElementById("both-hands-overlay");
const rightHandOverlay = document.getElementById("right-hand-overlay");
const leftHandUnderlay = document.getElementById("left-hand");
const bothHandsUnderlay = document.getElementById("both-hands");
const rightHandUnderlay = document.getElementById("right-hand");
const selection = document.getElementById("mainhand-selection");

var mainhand = Requests.getMainhand();

leftHandOverlay.addEventListener("click", () => {
    mainhand = "left";
    setMainhandSelection("left");
})
bothHandsOverlay.addEventListener("click", () => {
    mainhand = "both";
    setMainhandSelection("both");
})
rightHandOverlay.addEventListener("click", () => {
    mainhand = "left";
    setMainhandSelection("right");
})
leftHandUnderlay.addEventListener("click", () => {
    mainhand = "left";
    setMainhandSelection("left");
})
bothHandsUnderlay.addEventListener("click", () => {
    mainhand = "both";
    setMainhandSelection("both");
})
rightHandUnderlay.addEventListener("click", () => {
    mainhand = "left";
    setMainhandSelection("right");
})

loadNavbar();
loadAccountInfoToFields();

export function loadAccountInfoToFields() {
    const pfpFieldPictureContainer = document.getElementById("pfp-field-picture-container");
    addPfpToContainer("pfp-field-picture-container", "/icons/default_pfp.png");

    const username = Requests.getUsername();
    const usernameField = document.getElementById("username-field");
    let usernameValue = usernameField.innerHTML;
    usernameField.innerHTML = usernameValue + username;

    loadMainhand();
}

export function loadMainhand() {
    setMainhandSelection(mainhand);
}

export function setMainhandSelection(mainhand = "both") {
    if (mainhand == "left") {
        selection.style.left = "-0.5rem";
        leftHandOverlay.style.left = "0.5rem";
        bothHandsOverlay.style.left = "4.5rem";
        rightHandOverlay.style.left = "8.5rem";
    }
    else if (mainhand == "both") {
        selection.style.left = "3.5rem";

        leftHandOverlay.style.left = "-3.5rem";
        bothHandsOverlay.style.left = "0.5rem";
        rightHandOverlay.style.left = "4.5rem";
    }
    else if (mainhand == "right") {
        selection.style.left = "7.5rem";

        leftHandOverlay.style.left = "-7.5rem";
        bothHandsOverlay.style.left = "-3.5rem";
        rightHandOverlay.style.left = "0.5rem";
    }
}
