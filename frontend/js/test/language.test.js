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
        expect(document.querySelector('[value="auto"]').textContent).toBe(translations[code].Auto);
        expect(document.querySelector('[value="dark"]').textContent).toBe(translations[code].Dark);
        expect(document.querySelector('[value="light"]').textContent).toBe(translations[code].Light);
        expect(document.querySelector("select").value).toBe("light");
        expect(getTheme()).toBe("light");
    }
    setTheme("dark");
});


it("automatically translates unmarked interface text, nested buttons, and accessible labels", async () => {
    const language = await import("../language.js");
    document.body.innerHTML = '<button title="Open navigation" aria-label="Open navigation"><svg></svg><span>Save</span></button><input placeholder="Find a game" value="Save"><p>Frame 3 · Shot 2</p><span translate="no">Save</span>';
    const button = document.querySelector("button");
    const click = vi.fn();
    button.addEventListener("click", click);
    language.setLanguage("es");
    expect(button.querySelector("span").textContent).toBe("Guardar");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.title).toBe("Abrir menú");
    expect(button.getAttribute("aria-label")).toBe("Abrir menú");
    expect(document.querySelector("input").placeholder).toBe("Buscar partida");
    expect(document.querySelector("input").value).toBe("Save");
    expect(document.querySelector("p").textContent).toBe("Cuadro 3 · Lanzamiento 2");
    expect(document.querySelector('[translate="no"]').textContent).toBe("Save");
    button.click();
    expect(click).toHaveBeenCalledOnce();
    language.setLanguage("fr");
    expect(button.querySelector("span").textContent).toBe("Enregistrer");
    language.setLanguage("en");
    expect(button.querySelector("span").textContent).toBe("Save");
    expect(document.querySelector("p").textContent).toBe("Frame 3 · Shot 2");
});

it("translates new content and changing status text without marking individual boxes", async () => {
    const language = await import("../language.js");
    language.setLanguage("es");
    const status = document.createElement("p");
    status.textContent = "Loading…";
    document.body.append(status);
    await vi.waitFor(() => expect(status.textContent).toBe("Cargando…"));
    status.textContent = "All confirmed shots saved.";
    await vi.waitFor(() => expect(status.textContent).toBe("Todos los lanzamientos guardados."));
    language.setLanguage("en");
    expect(status.textContent).toBe("All confirmed shots saved.");
    status.textContent = "Unknown new wording";
    language.setLanguage("de");
    expect(status.textContent).toBe("Unknown new wording");
});

it("preserves template values and does not interpret them as markup", async () => {
    const language = await import("../language.js");
    const text = document.createElement("p");
    text.textContent = "Edit <img src=x>";
    document.body.append(text);
    language.setLanguage("es");
    expect(text.textContent).toBe("Editar <img src=x>");
    expect(text.querySelector("img")).toBeNull();
    language.setLanguage("en");
    expect(text.textContent).toBe("Edit <img src=x>");
});


it("uses the most specific dynamic message and preserves its numeric values", async () => {
    const language = await import("../language.js");
    language.setLanguage("es");
    expect(language.translateText("Frame 2 of 10 · Shot 1")).toBe("Cuadro 2 de 10 · Lanzamiento 1");
    language.setLanguage("fr");
    expect(language.translateText("Frame 2 of 10 · Shot 1")).toBe("Frame 2 sur 10 · Lancer 1");
});


it("translates dynamic shadow-root component content while preserving user names", async () => {
    const language = await import("../language.js");
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = '<button>Start Game</button><p>Choose an event and establishment, or leave them blank.</p><span translate="no">Save</span>';
    document.body.append(host);
    language.setLanguage("es");
    expect(shadow.querySelector("button").textContent).toBe("Iniciar partida");
    expect(shadow.querySelector("p").textContent).not.toContain("Choose an event");
    shadow.querySelector("p").textContent = "Loading…";
    await vi.waitFor(() => expect(shadow.querySelector("p").textContent).toBe("Cargando…"));
    expect(shadow.querySelector("span").textContent).toBe("Save");
    language.setLanguage("en");
    expect(shadow.querySelector("p").textContent).toBe("Loading…");
});
