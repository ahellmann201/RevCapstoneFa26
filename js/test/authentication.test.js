import { describe, expect, it } from 'vitest'
import { setAuthToken, getAuthToken, logOut } from '../authentication'

describe('authentication test', () => {
    it('setAuthToken', () => {
        setAuthToken("Auth Token");
        expect(getAuthToken()).toEqual("Auth Token");
    }),
    it("clearAuthToken", () => {
        clearAuthToken();
        expect(getAuthToken()).toEqual(null);
    }),
    it("logOut", () => {
        setAuthToken("Auth Token");
        logOut();
        expect(getAuthToken()).toEqual(null);
    })
})