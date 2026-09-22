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