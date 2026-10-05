/**
 * Represents a request to the backend.
 *
 * A Request describes the operation and resource being requested,
 * along with any parameters required by that request.
 *
 * Authentication information is added by RequestHandler when the
 * request is sent.
 *
 * Debug options are intended for development/testing only.
 */
export class Request {
    constructor({
        operation,
        resource,
        parameters = {},
        debug = {}
    }) {
        this._operation = operation;
        this._resource = resource;
        this._parameters = parameters;

        this._debug = {
            forceDatabaseUnavailable:
                debug.forceDatabaseUnavailable ?? false,

            forceInvalidSession:
                debug.forceInvalidSession ?? false
        };
    }

    get operation() { return this._operation; }
    get resource() { return this._resource; }
    get parameters() { return this._parameters; }
    get debug() { return this._debug; }

    get forceDatabaseUnavailable() {
        return this._debug.forceDatabaseUnavailable;
    }

    get forceInvalidSession() {
        return this._debug.forceInvalidSession;
    }
}
