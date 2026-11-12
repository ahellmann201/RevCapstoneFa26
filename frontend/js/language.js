/** Device-local interface language, shared by guests and signed-in users. */
import { translations } from "./translations.js";

const storageKey = "revmetrix.language";
export const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "EspaÃ±ol" },
    { code: "fr", name: "FranÃ§ais" },
    { code: "de", name: "Deutsch" },
    { code: "zh-CN", name: "ç®€ä½“ä¸­æ–‡" },
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
        picker.addEventListener("change", () => setLanguage(picker.value));
    }
    translatePage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeLanguage(), { once: true });
} else {
    initializeLanguage();
}
