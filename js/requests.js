export function getUsername(authToken) {
    return "hakeBowling";
}
export function getDisplayName(authToken) {
    const displayName = "Don Hake"; //will be a database grab later
    if (displayName == null) return getUsername();
    else return parseDisplayName(displayName);
}

export function parseDisplayName(displayName) {
    return displayName.split(" ")[0];
}