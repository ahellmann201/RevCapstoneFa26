/** Device-local interface language, shared by guests and signed-in users. */
import { translations } from "./translations.js";
import { request } from "./api_client.js";

const storageKey = "revmetrix.language";
export const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Espa\u00f1ol" },
    { code: "fr", name: "Fran\u00e7ais" },
    { code: "de", name: "Deutsch" },
    { code: "zh-CN", name: "\u7b80\u4f53\u4e2d\u6587" },
];

function storedLanguage() {
    try {
        return localStorage.getItem(storageKey);
    } catch {
        return null;
    }
}

function supported(code) {
    return Object.hasOwn(translations, code);
}

let revision = 0;
let saving = false;
let currentLanguage = storedLanguage();
if (!supported(currentLanguage)) currentLanguage = "en";

export function getLanguage() {
    return currentLanguage;
}

export function translate(key) {
    return translations[currentLanguage][key] ?? translations.en[key] ?? key;
}

export function translatePage(root = document) {
    document.documentElement.lang = currentLanguage;
    for (const element of root.querySelectorAll("[data-i18n]")) {
        element.textContent = translate(element.dataset.i18n);
    }
    for (const element of root.querySelectorAll("[data-i18n-placeholder]")) {
        element.setAttribute("placeholder", translate(element.dataset.i18nPlaceholder));
    }
    for (const picker of root.querySelectorAll("[data-language-picker]")) {
        picker.value = currentLanguage;
        picker.setAttribute("aria-label", translate("Language"));
    }
}

export function setLanguage(code) {
    if (!supported(code)) return;
    revision += 1;
    currentLanguage = code;
    try {
        localStorage.setItem(storageKey, code);
    } catch {
        // The selection still works for this page when storage is unavailable.
    }
    translatePage();
    window.dispatchEvent(new CustomEvent("languagechange", { detail: code }));
}

export function initializeLanguage(root = document) {
    for (const picker of root.querySelectorAll("[data-language-picker]")) {
        if (picker.dataset.languageReady) continue;
        picker.dataset.languageReady = "true";
        for (const language of languages) {
            const option = document.createElement("option");
            option.value = language.code;
            option.textContent = language.name;
            picker.append(option);
        }
        picker.addEventListener("change", () => saveLanguage(picker.value));
    }
    translatePage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeLanguage(), { once: true });
} else {
    initializeLanguage();
}


function showLanguageStatus(message) {
    for (const status of document.querySelectorAll("[data-language-status]")) {
        status.textContent = message;
    }
}

export async function saveLanguage(code) {
    if (!supported(code) || saving) return false;
    const token = sessionStorage.getItem("authentication_token");
    if (!token || token === "null") {
        setLanguage(code);
        return true;
    }
    revision += 1;
    saving = true;
    for (const picker of document.querySelectorAll("[data-language-picker]")) picker.disabled = true;
    showLanguageStatus("Saving language…");
    try {
        const user = await request("/auth/me/language", {
            method: "PUT",
            body: JSON.stringify({ main_language: code }),
        });
        if (sessionStorage.getItem("authentication_token") !== token) return false;
        setLanguage(user.main_language);
        showLanguageStatus("");
        return true;
    } catch {
        translatePage();
        showLanguageStatus("Could not save language. Please try again.");
        return false;
    } finally {
        saving = false;
        for (const picker of document.querySelectorAll("[data-language-picker]")) picker.disabled = false;
    }
}

export async function syncAccountLanguage() {
    const token = sessionStorage.getItem("authentication_token");
    if (!token || token === "null") return;
    const startedAt = revision;
    try {
        const user = await request("/auth/me");
        if (startedAt === revision && sessionStorage.getItem("authentication_token") === token) {
            setLanguage(user.main_language ?? "en");
        }
    } catch {
        // Keep the device preference when the account cannot be reached.
    }
}
