/** Initializes the ball arsenal page and shared site navigation. */
import { loadNavbar } from "./navbar.js";
import { getBalls } from "./requests.js";

loadNavbar();

getBalls().then((balls) => {
    for (const ball of balls) {
        addBall(ball);
    }
    console.log(balls);
});

function ballImageFilter(color) {
    if (!color) return "";

    const probe = document.createElement("span");
    probe.style.color = color;
    if (!probe.style.color) return "";
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    probe.remove();
    if (!rgb || rgb.length !== 3) return "";

    const [red, green, blue] = rgb.map((value) => value / 255);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;
    if (delta !== 0) {
        if (max === red) hue = 60 * (((green - blue) / delta) % 6);
        else if (max === green) hue = 60 * ((blue - red) / delta + 2);
        else hue = 60 * ((red - green) / delta + 4);
    }
    return `sepia(1) saturate(100) hue-rotate(${(hue + 360 - 35) % 360}deg)`;
}

class BallListItem extends HTMLElement {
    static observedAttributes = ["name", "color", "details"];

    connectedCallback() {
        if (!this.querySelector(".ball_list_item_header")) {
            this.classList.add("ball_list_item");
            const imageFilter = ballImageFilter(this.getAttribute("color"));
            this.innerHTML = `
                <div class="ball_list_item_header">
                    <img src="./public/icons/ball.png" class="ball_image" style="filter: ${imageFilter}">
                    <input class="ball_name" type="text" aria-label="Ball name" placeholder="Ball name">
                    <button class="ball_expand_button" type="button" aria-expanded="false">Expand</button>
                </div>
                <div class="ball_details" hidden>
                    <p>${this.getAttribute("details")}</p>
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
        if (oldValue === newValue) return;
        if (name === "name") {
            const input = this.querySelector(".ball_name");
            if (input && input.value !== newValue) input.value = newValue ?? "";
        } else if (name === "color") {
            const image = this.querySelector(".ball_image");
            if (image) image.style.filter = ballImageFilter(newValue);
        }
    }
}

if (!customElements.get("ball-list-item")) {
    customElements.define("ball-list-item", BallListItem);
}

export function addBall(ball) {
    const container = document.getElementById("ball-list-container");

    const item = document.createElement("ball-list-item");
    item.setAttribute("name", ball.ball_name);
    item.setAttribute("details", `Weight: ${ball.weight}lbs`) 
    if (ball.color) item.setAttribute("color", ball.color);

    container.appendChild(item);
}
