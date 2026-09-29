import { beforeEach, describe, expect, it } from 'vitest'
import { clearAuthToken, getAuthToken, logOut, setAuthToken } from '../authentication'
import * as Requests from '../requests.js'
import * as Cache from '../cache.js'

describe('authentication', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    it('stores and returns an authentication token', () => {
        setAuthToken('Auth Token')

        expect(getAuthToken()).toBe('Auth Token')
    })

    it('returns null when no token has been stored', () => {
        expect(getAuthToken()).toBeNull()
    })

    it('treats a stored "null" value as no token', () => {
        setAuthToken(null)

        expect(sessionStorage.getItem('authentication_token')).toBe('null')
        expect(getAuthToken()).toBeNull()
    })

    it('can suppress a stored token with forceNoToken', () => {
        setAuthToken('Auth Token')

        expect(getAuthToken(true)).toBeNull()
        expect(getAuthToken()).toBe('Auth Token')
    })

    it('clears the authentication token', () => {
        setAuthToken('Auth Token')

        clearAuthToken()

        expect(getAuthToken()).toBeNull()
    })

    it('logs out and clears session preferences', () => {
        setAuthToken('Auth Token')
        Cache.setShowFullDisplayName(true)
        Cache.setMainhand('left')

        logOut()

        expect(getAuthToken()).toBeNull()
        expect(Cache.getShowFullDisplayName()).toBe(false)
        expect(sessionStorage.getItem('mainhand')).toBeNull()
    })
})
