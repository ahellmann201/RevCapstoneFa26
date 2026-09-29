import { applyPfpHue, getPfpHue } from "./theme";
import * as Requests from "./requests";
import * as Cache from "./cache";

export function parseDisplayName(displayName) {
    const showFull = Cache.getShowFullDisplayName();
    if (showFull) return displayName;
    else return displayName.split(" ")[0];
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