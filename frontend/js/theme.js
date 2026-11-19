/** Manages the profile picture hue preference and applies it to the page. */
let pfpHue = getPfpHue();

if (pfpHue === null) {
    randomizePfpHue()
}
else {
    applyPfpHue(pfpHue);
}

export function randomizePfpHue() {
    pfpHue = Math.random() * 360;
    applyPfpHue(pfpHue);
    return pfpHue;
}

export function applyPfpHue(hue) {
    if (typeof hue === "number" && Number.isFinite(hue) && hue >= 0 && hue <= 360) { //check that hue is a valid value
        document.documentElement.style.setProperty(
            "--pfp-hue",
            `${hue}deg`
        );
        sessionStorage.setItem("pfp-hue", hue);
    }
    else {
        console.log("Number given for hue is not valid");
    }
}

export function getPfpHue() {
    return Number(sessionStorage.getItem("pfp-hue"));
}

window.randomizePfpHue = randomizePfpHue;
window.applyPfpHue = applyPfpHue;
window.getPfpHue = getPfpHue;


// Appearance is a browser preference and survives logout.
const THEME_KEY = "revmetrix.theme";
export function getTheme() {
    try {
        const theme = localStorage.getItem(THEME_KEY);
        return ["auto", "light", "dark"].includes(theme) ? theme : "dark";
    } catch { return "dark"; }
}
export function setTheme(value) {
    const preference = ["auto", "light", "dark"].includes(value) ? value : "dark";
    const theme = preference === "auto"
        ? (window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark")
        : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(THEME_KEY, preference); } catch { /* Apply even if storage is unavailable. */ }
    document.querySelectorAll("[data-theme-picker]").forEach(picker => { picker.value = preference; });
    return preference;
}
export function initializeTheme() {
    setTheme(getTheme());
    document.querySelectorAll("[data-theme-picker]").forEach(picker => {
        picker.onchange = () => setTheme(picker.value);
    });
}
setTheme(getTheme());
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeTheme, { once: true });
else initializeTheme();
window.addEventListener("storage", event => {
    if (event.key === THEME_KEY || event.key === null) initializeTheme();
});
const systemTheme = window.matchMedia?.("(prefers-color-scheme: light)");
systemTheme?.addEventListener?.("change", () => {
    if (getTheme() === "auto") setTheme("auto");
});
