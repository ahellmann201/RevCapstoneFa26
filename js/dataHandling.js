import { applyPfpHue, getPfpHue } from "./theme";

export function parseDisplayName(displayName) {
    return displayName.split(" ")[0];
}

export function addPfpToContainer(containerID, pfpURL) {
    const img = `<img
                    src="${pfpURL}"
                    class="profile_picture"
                    id="profile-picture"
                ></img>`;
    const container = document.getElementById(containerID);

    container.innerHTML = img;
}