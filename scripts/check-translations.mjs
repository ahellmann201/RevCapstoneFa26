/** Catch untranslated static page copy before new UI is shipped. */
import { readdirSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { translations } from "../frontend/js/translations.js";
const keys = Object.keys(translations.en);
const normalized = new Set(keys.map(key => key.toLowerCase()));
const patterns = keys.filter(key => key.includes("{")).map(key => new RegExp("^" + key.split(/(\{\w+\})/).map(part => /^\{\w+\}$/.test(part) ? ".+?" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("") + "$"));
function known(value) {
    const text = value.replace(/\s+/g, " ").trim();
    if (!/[a-z]{2}/i.test(text) || /^RevMetrix$/i.test(text)) return true;
    const brand = text.match(/^RevMetrix \| (.+)$/i);
    if (brand) return known(brand[1]);
    return normalized.has(text.toLowerCase()) || normalized.has(text.replace(/[:?]$/, "").toLowerCase()) || patterns.some(pattern => pattern.test(text));
}
const missing = new Map();
for (const file of readdirSync("frontend").filter(file => file.endsWith(".html"))) {
    const dom = new JSDOM(readFileSync(`frontend/${file}`, "utf8"));
    const document = dom.window.document;
    const walker = document.createTreeWalker(document, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('script, style, svg, code, [translate="no"]')) continue;
        if (!known(node.data)) missing.set(node.data.trim(), file);
    }
    for (const element of document.querySelectorAll("[placeholder], [aria-label], [title], [alt]")) {
        if (element.closest('[translate="no"]')) continue;
        for (const attribute of ["placeholder", "aria-label", "title", "alt"]) {
            const text = element.getAttribute(attribute);
            if (text && !known(text)) missing.set(text, file);
        }
    }
    dom.window.close();
}
for (const [locale, entries] of Object.entries(translations)) {
    for (const key of keys) if (!entries[key]) missing.set(`${locale}: ${key}`, "translations.js");
}
if (missing.size) {
    for (const [text, file] of missing) console.error(`${file}: ${text}`);
    process.exitCode = 1;
} else console.log("All static page text and supported language dictionaries have translation coverage.");
