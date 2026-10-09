/** Controls account settings, including profile picture and handedness preferences. */
import { loadNavbar } from "./navbar.js";
import * as Requests from "./requests.js";
import * as Cache from "./cache.js";
import { addPfpToContainer } from "./data_handling.js";

const leftHandOverlay = document.getElementById("left-hand-overlay");
const bothHandsOverlay = document.getElementById("both-hands-overlay");
const rightHandOverlay = document.getElementById("right-hand-overlay");
const leftHandUnderlay = document.getElementById("left-hand");
const bothHandsUnderlay = document.getElementById("both-hands");
const rightHandUnderlay = document.getElementById("right-hand");
const selection = document.getElementById("mainhand-selection");

var mainhand = Requests.getMainhand();

leftHandOverlay.addEventListener("click", () => {setMainhandSelection("left");})
bothHandsOverlay.addEventListener("click", () => {setMainhandSelection("both");})
rightHandOverlay.addEventListener("click", () => {setMainhandSelection("right");})
leftHandUnderlay.addEventListener("click", () => {setMainhandSelection("left");})
bothHandsUnderlay.addEventListener("click", () => {setMainhandSelection("both");})
rightHandUnderlay.addEventListener("click", () => {setMainhandSelection("right");})

loadNavbar();
loadAccountInfoToFields();
setShowFullDisplayName();

export async function loadAccountInfoToFields() {
    const pfpFieldPictureContainer = document.getElementById("pfp-field-picture-container");
    addPfpToContainer("pfp-field-picture-container", "/icons/default_pfp.png");

    const username = await Requests.getUsername();
    const usernameField = document.getElementById("username-field");
    let usernameValue = usernameField.innerHTML;
    usernameField.innerHTML = usernameValue + username;

    const displayNameField = document.getElementById("display-name-field");
    const displayName = await Requests.getDisplayNameBlank();
    if (displayName != null) displayNameField.value = displayName;

    await setMainhandSelection(mainhand);
}

export async function setMainhandSelection(setMainhand = "both") {
    mainhand = await setMainhand;
    if (mainhand == "left") {
        selection.style.left = "var(--left-hand-left)";
        leftHandOverlay.style.left = "0rem";
        bothHandsOverlay.style.left = "calc(var(--both-hands-left) - var(--left-hand-left))";
        rightHandOverlay.style.left = "calc(var(--right-hand-left) - var(--left-hand-left))";
    }
    else if (mainhand == "both") {
        selection.style.left = "var(--both-hands-left)";
        leftHandOverlay.style.left = "calc(var(--left-hand-left) - var(--both-hands-left))";
        bothHandsOverlay.style.left = "0rem";
        rightHandOverlay.style.left = "calc(var(--right-hand-left) - var(--both-hands-left))";
    }
    else if (mainhand == "right") {
        selection.style.left = "var(--right-hand-left)";
        leftHandOverlay.style.left = "calc(var(--left-hand-left) - var(--right-hand-left))";
        bothHandsOverlay.style.left = "calc(var(--both-hands-left) - var(--right-hand-left))";
        rightHandOverlay.style.left = "0rem";
    }

    Cache.setMainhand(mainhand);
}

export function setShowFullDisplayName() {
    const displayNameFullToggle = document.getElementById("display-name-full-toggle");
    displayNameFullToggle.checked = Cache.getShowFullDisplayName();

    var displayNameFull = true;
    displayNameFullToggle.addEventListener("change", () => {
        displayNameFull = displayNameFullToggle.checked;
        Cache.setShowFullDisplayName(displayNameFull);
    });
}
