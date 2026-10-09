/** Provides authenticated profile lookups with database-first cache fallback. */
import { getAuthToken } from "./authentication.js";
import * as Cache from "./cache.js";
import { GuestAccount } from "./defaults/guest_account.js";
import * as Database from "./database.js";

/** Returns the signed-in user's username, falling back to the guest username or cache. */
export async function getUsername() {
    if (getAuthToken() == null) return GuestAccount.username;
    try {
        var username = await Database.getUsername();
        if (username === Database.DB_UNAVAILABLE) return Cache.getUsername();
        Cache.setUsername(username);
        return username;
    } catch {
        return Cache.getUsername();
    }
}
/** Returns the signed-in user's display name, falling back to username or cached data. */
export async function getDisplayName() {
    if (getAuthToken() == null) return GuestAccount.username;
    try {
        const displayName = await Database.getDisplayName();
        if (displayName === Database.DB_UNAVAILABLE) return Cache.getDisplayName() ?? getUsername();
        if (displayName == null) return getUsername();
        Cache.setDisplayName(displayName);
        return displayName;
    } catch {
        return Cache.getDisplayName() ?? getUsername();
    }
}
/** Returns the signed-in user's display name, or null when unavailable. */
export async function getDisplayNameBlank() {
    if (getAuthToken() == null) return null;
    try {
        const displayName = await Database.getDisplayName();
        if (displayName === Database.DB_UNAVAILABLE) return Cache.getDisplayName();
        if (displayName == null) return null;
        Cache.setDisplayName(displayName);
        return displayName;
    } catch {
        return Cache.getDisplayName();
    }
}
/** Returns the signed-in user's mainhand, falling back to the guest setting or cache. */
export function getMainhand() {
    if (getAuthToken() == null) return GuestAccount.mainhand;
    try {
        const mainhand = Database.getMainhand();
        if (mainhand === Database.DB_UNAVAILABLE) return Cache.getMainhand();
        Cache.setMainhand(mainhand);
        return mainhand;
    } catch {
        return Cache.getMainhand();
    }
}

window.requestUsername = getUsername;