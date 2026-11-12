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
        syncSidebarLanguagePicker(picker);
    }
}

function syncSidebarLanguagePicker(picker) {
    const wrapper = picker.closest(".language-preference")?.querySelector("[data-sidebar-language-picker]");
    if (!wrapper) return;
    const trigger = wrapper.querySelector("[data-language-picker-trigger]");
    const label = wrapper.querySelector("[data-language-picker-label]");
    const menu = wrapper.querySelector("[data-language-picker-menu]");
    const selectedOption = [...picker.options].find((option) => option.value === picker.value);
    if (label && selectedOption) label.textContent = selectedOption.textContent;
    if (trigger) trigger.setAttribute("aria-label", translate("Language"));
    if (menu) {
        for (const optionButton of menu.querySelectorAll("[role=option]")) {
            const selected = optionButton.dataset.value === picker.value;
            optionButton.setAttribute("aria-selected", String(selected));
            optionButton.tabIndex = selected ? 0 : -1;
        }
    }
}

function initializeSidebarLanguagePicker(picker) {
    const wrapper = picker.closest(".language-preference")?.querySelector("[data-sidebar-language-picker]");
    if (!wrapper || wrapper.dataset.ready) return;
    wrapper.dataset.ready = "true";
    const trigger = wrapper.querySelector("[data-language-picker-trigger]");
    const menu = wrapper.querySelector("[data-language-picker-menu]");
    if (!trigger || !menu) return;

    for (const option of picker.options) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "option");
        button.dataset.value = option.value;
        button.textContent = option.textContent;
        button.addEventListener("click", () => {
            menu.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            saveLanguage(option.value);
            trigger.focus();
        });
        menu.append(button);
    }

    trigger.addEventListener("click", () => {
        const isOpening = menu.hidden;
        menu.hidden = !isOpening;
        trigger.setAttribute("aria-expanded", String(isOpening));
        if (isOpening) menu.querySelector('[aria-selected="true"]')?.focus();
    });
    menu.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            menu.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            trigger.focus();
        }
    });
    syncSidebarLanguagePicker(picker);
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
        initializeSidebarLanguagePicker(picker);
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
