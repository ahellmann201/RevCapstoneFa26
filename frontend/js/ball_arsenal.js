/** Initializes the ball arsenal page and shared site navigation. */
import { loadNavbar } from "./navbar.js";

loadNavbar();

class BallListItem extends HTMLElement {
    static observedAttributes = ["name"];

    connectedCallback() {
        if (!this.querySelector(".ball_list_item_header")) {
            this.classList.add("ball_list_item");
            this.innerHTML = `
                <div class="ball_list_item_header">
                    <input class="ball_name" type="text" aria-label="Ball name" placeholder="Ball name">
                    <button class="ball_expand_button" type="button" aria-expanded="false">Expand</button>
                </div>
                <div class="ball_details" hidden>
                    <p>Ball details go here.</p>
                </div>
            `;

            this.querySelector(".ball_name").value = this.getAttribute("name") ?? "";
            this.querySelector(".ball_name").addEventListener("input", (event) => {
                this.setAttribute("name", event.currentTarget.value);
            });

            this.querySelector(".ball_expand_button").addEventListener("click", (event) => {
                const button = event.currentTarget;
                const expanded = button.getAttribute("aria-expanded") !== "true";
                this.setExpanded(expanded);
            });
        }
    }

    setExpanded(expanded) {
        if (expanded) {
            this.parentElement
                ?.querySelectorAll("ball-list-item.active")
                .forEach((item) => {
                    if (item !== this) item.setExpanded(false);
                });
        }

        this.classList.toggle("active", expanded);
        const button = this.querySelector(".ball_expand_button");
        button.setAttribute("aria-expanded", String(expanded));
        button.textContent = expanded ? "Collapse" : "Expand";
        this.querySelector(".ball_details").hidden = !expanded;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name !== "name" || oldValue === newValue) return;
        const input = this.querySelector(".ball_name");
        if (input && input.value !== newValue) input.value = newValue ?? "";
    }
}

if (!customElements.get("ball-list-item")) {
    customElements.define("ball-list-item", BallListItem);
}
