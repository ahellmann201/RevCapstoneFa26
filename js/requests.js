import { getAuthToken } from "./authentication.js";
import { Account } from "./account.js"

export function getUsername() {
    if (getAuthToken() == null) return Account.username;
    return "hakeBowling";
}
export function getDisplayName() {
    if (getAuthToken() == null) return Account.username;

    const displayName = "Don Hake"; //will be a database grab later
    if (displayName == null) return Account.username;
    else return displayName;
}
export function getDisplayNameBlank() {
    if (getAuthToken() == null) return null;

    const displayName = "Don Hake"; //will be a database grab later
    if (displayName == null) return null;
    else return displayName;
}