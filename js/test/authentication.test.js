import { describe, expect, it } from 'vitest'
import { setAuthToken, getAuthToken } from '../authentication'

describe('authentication test', () => {
    it('setAuthToken', () => {
        setAuthToken("Auth Token 1");
        expect(getAuthToken()).toEqual("Auth Token 1");
    }),
    it("clearAuthToken", () => {
        clearAuthToken();
        expect(getAuthToken()).toEqual(null);
    })
})