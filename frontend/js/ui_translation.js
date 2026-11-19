/** Translates interface text without replacing elements or touching form values. */
const originals = new WeakMap();
const attributes = new WeakMap();
const excluded = 'script, style, svg, code, pre, textarea, [contenteditable], [translate="no"], .notranslate, [data-language-picker], [data-language-picker-label], [data-language-picker-menu]';
const normalize = value => value.replace(/\s+/g, " ").trim();

export function translateInterface(root, translateText) {
    const document = root.ownerDocument ?? root;
    const walker = document.createTreeWalker(root, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(excluded) || parent.closest("[data-i18n]")) continue;
        const previous = originals.get(node);
        const source = previous && node.data === previous.rendered ? previous.source : node.data;
        const key = normalize(source);
        if (!key) continue;
        const value = translateText(key);
        const rendered = value === key ? source : source.replace(source.trim(), value);
        originals.set(node, { source, rendered });
        if (node.data !== rendered) node.data = rendered;
    }
    const elements = root.querySelectorAll?.("[placeholder], [title], [aria-label], [alt]") ?? [];
    for (const element of elements) {
        if (element.closest(excluded.replace("textarea, ", ""))) continue;
        const saved = attributes.get(element) ?? {};
        for (const name of ["placeholder", "title", "aria-label", "alt"]) {
            if (!element.hasAttribute(name)) continue;
            const current = element.getAttribute(name);
            const previous = saved[name];
            const source = previous && current === previous.rendered ? previous.source : current;
            const rendered = translateText(source);
            saved[name] = { source, rendered };
            if (current !== rendered) element.setAttribute(name, rendered);
        }
        attributes.set(element, saved);
    }
}
