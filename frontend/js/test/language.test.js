import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../api_client.js", () => ({ request: vi.fn() }));
import { request } from "../api_client.js";

beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
        <span role="status" data-language-status></span>
        <label data-i18n="Language">Language</label>
        <select data-language-picker></select>
        <button data-i18n="Save Changes">Save Changes</button>
        <input data-i18n-placeholder="No Display Name" value="My custom name">
        <span id="record-name">My League</span>
        <select id="weekday"><option value="Monday" data-i18n="Monday">Monday</option></select>
    `;
});
afterEach(() => vi.restoreAllMocks());

it("changes interface language without changing user data or submitted values", async () => {
    const language = await import("../language.js");
    language.initializeLanguage();
    const picker = document.querySelector("[data-language-picker]");
    expect(picker.options).toHaveLength(5);
    picker.value = "es";
    picker.dispatchEvent(new Event("change"));
    expect(document.documentElement.lang).toBe("es");
    expect(document.querySelector("button").textContent).toBe("Guardar cambios");
    expect(document.querySelector("input").placeholder).toBe("Sin nombre visible");
    expect(document.querySelector("input").value).toBe("My custom name");
    expect(document.getElementById("record-name").textContent).toBe("My League");
    expect(document.getElementById("weekday").value).toBe("Monday");
    expect(localStorage.getItem("revmetrix.language")).toBe("es");
    language.setLanguage("en");
    expect(document.querySelector("button").textContent).toBe("Save Changes");
});

it("restores the device preference on another page and survives logout", async () => {
    localStorage.setItem("revmetrix.language", "fr");
    sessionStorage.clear();
    const language = await import("../language.js");
    language.initializeLanguage();
    language.initializeLanguage();
    expect(document.querySelector("[data-language-picker]").value).toBe("fr");
    expect(document.querySelector("[data-language-picker]").options).toHaveLength(5);
    expect(document.querySelector("button").textContent).toBe("Enregistrer les modifications");
});

it("handles invalid preferences and unavailable browser storage", async () => {
    localStorage.setItem("revmetrix.language", "unknown");
    const language = await import("../language.js");
    expect(language.getLanguage()).toBe("en");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    language.setLanguage("de");
    expect(language.getLanguage()).toBe("de");
    expect(document.querySelector("button").textContent).toBe("Änderungen speichern");
    language.setLanguage("unsupported");
    expect(language.getLanguage()).toBe("de");
});

it("provides all interface translations in every supported language", async () => {
    const { translations } = await import("../translations.js");
    for (const entries of Object.values(translations)) {
        expect(Object.keys(entries)).toEqual(Object.keys(translations.en));
        expect(Object.values(entries).every(value => typeof value === "string" && value.length > 0)).toBe(true);
    }
});


it("saves a signed-in preference and restores account language on another device", async () => {
    sessionStorage.setItem("authentication_token", "token");
    const language = await import("../language.js");
    language.initializeLanguage();
    request.mockResolvedValueOnce({ main_language: "es" });
    expect(await language.saveLanguage("es")).toBe(true);
    expect(request).toHaveBeenCalledWith("/auth/me/language", {
        method: "PUT", body: JSON.stringify({ main_language: "es" }),
    });
    localStorage.clear();
    request.mockResolvedValueOnce({ main_language: "fr" });
    await language.syncAccountLanguage();
    expect(language.getLanguage()).toBe("fr");
    expect(localStorage.getItem("revmetrix.language")).toBe("fr");
});

it("keeps the prior selection and shows a message when the account save fails", async () => {
    sessionStorage.setItem("authentication_token", "token");
    const language = await import("../language.js");
    language.initializeLanguage();
    request.mockRejectedValueOnce(new Error("Offline"));
    expect(await language.saveLanguage("de")).toBe(false);
    expect(language.getLanguage()).toBe("en");
    expect(document.querySelector("[data-language-picker]").value).toBe("en");
    expect(document.querySelector("[data-language-status]").textContent).toContain("Could not save");
});

it("ignores a late profile response after the user chooses a new language", async () => {
    sessionStorage.setItem("authentication_token", "token");
    const language = await import("../language.js");
    let resolveProfile;
    request.mockImplementationOnce(() => new Promise(resolve => { resolveProfile = resolve; }));
    const syncing = language.syncAccountLanguage();
    request.mockResolvedValueOnce({ main_language: "de" });
    await language.saveLanguage("de");
    resolveProfile({ main_language: "en" });
    await syncing;
    expect(language.getLanguage()).toBe("de");
});


it("renders native language names with the correct Unicode characters", async () => {
    const language = await import("../language.js");
    language.initializeLanguage();
    expect([...document.querySelector("[data-language-picker]").options].map(option => option.textContent))
        .toEqual(["English", "Espa\u00f1ol", "Fran\u00e7ais", "Deutsch", "\u7b80\u4f53\u4e2d\u6587"]);
});


it("translates the real appearance controls in every language without changing the theme", async () => {
    const { readFileSync } = await import("node:fs");
    const html = readFileSync("frontend/account_settings.html", "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.body.replaceChildren(parsed.querySelector(".appearance-preference"));
    const { setLanguage } = await import("../language.js");
    const { initializeTheme, setTheme, getTheme } = await import("../theme.js");
    const { translations } = await import("../translations.js");
    initializeTheme();
    setTheme("light");
    for (const code of ["es", "fr", "de", "zh-CN", "en"]) {
        setLanguage(code);
        expect(document.querySelector("label").textContent).toBe(translations[code].Appearance);
        expect(document.querySelector('[value="dark"]').textContent).toBe(translations[code].Dark);
        expect(document.querySelector('[value="light"]').textContent).toBe(translations[code].Light);
        expect(document.querySelector("small").textContent).toBe(translations[code]["Saved on this browser, including when logged out."]);
        expect(document.querySelector("select").value).toBe("light");
        expect(getTheme()).toBe("light");
    }
    setTheme("dark");
});
