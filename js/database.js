/** Returns the database's mainhand value. */

export const DB_UNAVAILABLE = Symbol("Database Unavailable");

//TODO: make the unctions actually interface with the db
//TODO: have function ouptut DB_UNAVAILABLE if db cant be reached (will be used to know if to go to the cache)

/** Provides the application's current user profile values from its data source. */
export function getMainhand() {
    return "right";
}

/** Returns the database's display name. */
export function getDisplayName() {
    return "Don Hake";
}

/** Returns the database's username. */
export function getUsername() {
    return "hakeBowling";
}
