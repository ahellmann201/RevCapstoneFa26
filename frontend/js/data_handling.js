/** Provides shared formatting and DOM helpers for user profile data. */
import { applyPfpHue, getPfpHue } from "./theme.js";
import * as Requests from "./requests.js";
import * as Cache from "./cache.js";

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
