const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye preview-icon" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off preview-icon" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`;

export function setPasswordVisibilityButton(button, visible) {
    button.innerHTML = visible ? eyeOpen : eyeClosed;
    button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    button.setAttribute("aria-pressed", String(visible));
    button.title = visible ? "Hide password" : "Show password";
}

export function bindPasswordVisibility(button, input) {
    setPasswordVisibilityButton(button, false);
    const toggle = () => {
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        setPasswordVisibilityButton(button, visible);
    };
    let lastPointerToggle = 0;

    button.addEventListener("pointerup", (event) => {
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        event.preventDefault();
        event.stopPropagation();
        toggle();
        lastPointerToggle = performance.now();
        if (event.pointerType !== "keyboard") button.blur();
    });
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Keyboard activation produces click without a preceding pointer event.
        if (event.detail === 0 || performance.now() - lastPointerToggle > 700) toggle();
    });
}
