import { getAuthToken } from "./authentication.js";
import * as Cache from "./cache";
import { GuestAccount } from "./guest_account.js";
import * as Database from "./database.js";

export function getUsername() {
    if (getAuthToken() == null) return GuestAccount.username;
    const cachedUsername = Cache.getUsername();
    if (cachedUsername != null) return cachedUsername;

    const username = Database.getUsername();
    Cache.setUsername(username);
    return username;
}
export function getDisplayName() {
    if (getAuthToken() == null) return GuestAccount.username;

    const cachedDisplayName = Cache.getDisplayName();
    if (cachedDisplayName != null) return cachedDisplayName;

    const displayName = Database.getDisplayName();
    if (displayName == null) return getUsername();
    Cache.setDisplayName(displayName);
    return displayName;
}
export function getDisplayNameBlank() {
    if (getAuthToken() == null) return null;

    const cachedDisplayName = Cache.getDisplayName();
    if (cachedDisplayName != null) return cachedDisplayName;

    const displayName = Database.getDisplayName();
    if (displayName == null) return null;
    Cache.setDisplayName(displayName);
    return displayName;
}
export function getMainhand() {
    if (getAuthToken() == null) return GuestAccount.mainhand;
    const cachedMainhand = Cache.getMainhand();
    if (cachedMainhand != null) return cachedMainhand;

    const mainhand = Database.getMainhand();
    Cache.setMainhand(mainhand);
    return mainhand;
}