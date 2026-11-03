/**
 * Background database reconnection support.
 *
 * When `sessionStorage.canReachDatabase` is `"false"`, this module retries the
 * database connection asynchronously and without interrupting the user. If a
 * retry succeeds, it updates `canReachDatabase` to `"true"` so subsequent
 * requests can use the restored connection.
 */

import { testDatabaseConnection } from "./database";

export async function retryConnection(forceFail = false) {
    var connected = sessionStorage.getItem("canReachDatabase");

    while (connected === "false") {
        await testDatabaseConnection(forceFail, true);
        connected = sessionStorage.getItem("canReachDatabase");
        console.log(connected);
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}