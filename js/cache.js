/** Removes all values from session storage. */
/** Reads and writes user preferences and profile data in browser session storage. */
export function clearCache() {
    sessionStorage.clear();
}

/** Stores the username in session storage. @param {string} username */
export function setUsername(username) {
    sessionStorage.setItem("username", username);
}
/** Returns the cached username, or null when none is stored. */
export function getUsername() {
    const username = sessionStorage.getItem("username");
    if (username == null) return null;
    else return username;
}

/** Stores the display name in session storage. @param {string} displayName */
export function setDisplayName(displayName) {
    sessionStorage.setItem("displayName", displayName);
}
/** Returns the cached display name, or null when none is stored. */
export function getDisplayName() {
    const displayName = sessionStorage.getItem("displayName");
    if (displayName == null) return null;
    else return displayName;
}

/** Stores the email address in session storage. @param {string} email */
export function setEmail(email) {
    sessionStorage.setItem("email", email);
}
/** Returns the cached email address, or null when none is stored. */
export function getEmail() {
    const email = sessionStorage.getItem("email");
    if (email == null) return null;
    else return email;
}

/** Stores the mainhand preference in session storage. @param {string} mainhand */
export function setMainhand(mainhand) {
    sessionStorage.setItem("mainhand", mainhand);
}
/** Returns the cached mainhand preference, defaulting to "both". */
export function getMainhand() {
    const mainhand = sessionStorage.getItem("mainhand");
    if (mainhand == null) return "both";
    else return mainhand;
}

/** Returns whether the full display name preference is enabled. */
export function getShowFullDisplayName() {
    const showFull = sessionStorage.getItem("showFullDisplayName");
    if (showFull == null || showFull === "") return false;
    else {
        if (showFull === "true") return true;
        else return false;
    }
}

/** Stores whether to show the full display name. @param {boolean} showFull */
export function setShowFullDisplayName(showFull) {
    sessionStorage.setItem("showFullDisplayName", showFull);
}

window.clearCache = clearCache;
