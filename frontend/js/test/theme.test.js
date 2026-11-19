/** Tests profile picture hue storage and validation. */
import { describe, expect, it, vi } from 'vitest'
import { getPfpHue, applyPfpHue } from "../theme.js"

describe ("theme test", () => {
    it("applyPfpHue", () => {
        applyPfpHue(0);
        expect(getPfpHue()).toEqual(0);
        applyPfpHue("this should not be allowed");
        expect(getPfpHue()).toEqual(0);
    })
})


describe("appearance preference", () => {
    it("defaults to dark and rejects unknown values", async () => {
        const { getTheme, setTheme } = await import("../theme.js");
        localStorage.removeItem("revmetrix.theme");
        expect(getTheme()).toBe("dark");
        expect(setTheme("unknown")).toBe("dark");
        expect(document.documentElement.dataset.theme).toBe("dark");
    });
    it("applies the picker immediately and restores the saved preference", async () => {
        const { initializeTheme, getTheme } = await import("../theme.js");
        document.body.innerHTML = '<select data-theme-picker><option value="dark">Dark</option><option value="light">Light</option></select>';
        initializeTheme();
        const picker = document.querySelector("[data-theme-picker]");
        picker.value = "light";
        picker.dispatchEvent(new Event("change"));
        expect(getTheme()).toBe("light");
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(document.documentElement.style.colorScheme).toBe("light");
        sessionStorage.clear();
        initializeTheme();
        expect(picker.value).toBe("light");
        picker.value = "dark";
        picker.dispatchEvent(new Event("change"));
        expect(getTheme()).toBe("dark");
        document.body.innerHTML = "";
    });
    it("follows the system color scheme while Auto is selected", async () => {
        const { setTheme, getTheme } = await import("../theme.js");
        const listeners = [];
        vi.stubGlobal("window", {
            addEventListener: vi.fn(),
            matchMedia: vi.fn(() => ({ matches: true, addEventListener: (_event, listener) => listeners.push(listener) })),
        });
        document.body.innerHTML = '<select data-theme-picker><option value="auto">Auto</option><option value="dark">Dark</option><option value="light">Light</option></select>';
        expect(setTheme("auto")).toBe("auto");
        expect(getTheme()).toBe("auto");
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(document.querySelector("select").value).toBe("auto");
    });
});
