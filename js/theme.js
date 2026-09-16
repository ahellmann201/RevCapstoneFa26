let pfpHue = sessionStorage.getItem("pfpHue");

if (pfpHue === null) {
    pfpHue = Math.random() * 360;
    sessionStorage.setItem("pfpHue", pfpHue);
}

document.documentElement.style.setProperty(
    "--pfp-hue",
    `${pfpHue}deg`
);