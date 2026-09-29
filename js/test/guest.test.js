import { describe, expect, it } from 'vitest'
import { clearAuthToken } from "../authentication"
import { getDisplayNameBlank, getMainhand, getUsername } from "../requests"

describe('guest test', () => {
    clearAuthToken(),

    it('guestUsername', () => {
        expect(getUsername()).toEqual("Guest");
    }),
    it('getDisplayName', () => {
        expect(getDisplayNameBlank()).toEqual(null);
    }),
    it('getMainhand', () => {
        expect(getMainhand()).toEqual("both");
    })
})