import { loadNavbar } from "./navbar.js";
import * as Requests from "./requests.js";
import { addPfpToContainer } from "./dataHandling.js";

loadNavbar();
loadAccountInfoToFields();

export function loadAccountInfoToFields() {
    const pfpFieldPictureContainer = document.getElementById("pfp-field-picture-container");
    addPfpToContainer("pfp-field-picture-container", "/icons/default_pfp.png");

    const pfps = document.querySelectorAll("#profile-picture");
    for (const pfp of pfps) {
        console.log(getComputedStyle(pfp).filter)
    }
}