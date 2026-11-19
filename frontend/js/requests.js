// Backward-compatible exports for older callers. New frontend code should use
// database.js, which owns application-level access to api_client.js.
export {
    getCachedUsername as getUsername,
    getCachedDisplayName as getDisplayName,
    getCachedDisplayNameBlank as getDisplayNameBlank,
    getCachedMainhand as getMainhand,
    getCachedBalls as getBalls,
    createBallForCurrentUser as createBall,
    deleteBallForCurrentUser as deleteBall,
} from "./database.js";
