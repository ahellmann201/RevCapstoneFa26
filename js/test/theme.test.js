/** Tests profile picture hue storage and validation. */
import { describe, expect, it } from 'vitest'
import { getPfpHue, applyPfpHue } from "../theme.js"

describe ("theme test", () => {
    it("applyPfpHue", () => {
        applyPfpHue(0);
        expect(getPfpHue()).toEqual(0);
        applyPfpHue("this should not be allowed");
        expect(getPfpHue()).toEqual(0);
    })
})
