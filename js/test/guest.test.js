import { describe, expect, it } from 'vitest'
import { clearAuthToken } from "../authentication"
import { getDisplayName, getUsername } from "../requests"

describe('guest test', () => {
    clearAuthToken(),

    it('guestUsername', () => {
        expect(getUsername()).toEqual("Guest");
    }),
    it('getDisplayName', () => {
        expect(getDisplayName()).toEqual("Guest");
    })
})