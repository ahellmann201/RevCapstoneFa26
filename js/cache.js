export function clearCache() {
    sessionStorage.clear();
}

export function setUsername(username) {
    sessionStorage.setItem("username", username);
}
export function getUsername() {
    const username = sessionStorage.getItem("username");
    if (username == null) return null;
    else return username;
}

export function setDisplayName(displayName) {
    sessionStorage.setItem("displayName", displayName);
}
export function getDisplayName() {
    const displayName = sessionStorage.getItem("displayName");
    if (displayName == null) return null;
    else return displayName;
}

export function setEmail(email) {
    sessionStorage.setItem("email", email);
}
export function getEmail() {
    const email = sessionStorage.getItem("email");
    if (email == null) return null;
    else return email;
}

export function setMainhand(mainhand) {
    sessionStorage.setItem("mainhand", mainhand);
}
export function getMainhand() {
    const mainhand = sessionStorage.getItem("mainhand");
    if (mainhand == null) return "both";
    else return mainhand;
}

export function getShowFullDisplayName() {
    const showFull = sessionStorage.getItem("showFullDisplayName");
    if (showFull == null || showFull === "") return false;
    else {
        if (showFull === "true") return true;
        else return false;
    }
}

export function setShowFullDisplayName(showFull) {
    sessionStorage.setItem("showFullDisplayName", showFull);
}

window.clearCache = clearCache;