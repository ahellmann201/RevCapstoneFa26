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
    try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; }
    catch { return "dark"; }
}
export function setTheme(value) {
    const theme = value === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* Apply even if storage is unavailable. */ }
    document.querySelectorAll("[data-theme-picker]").forEach(picker => { picker.value = theme; });
    return theme;
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
