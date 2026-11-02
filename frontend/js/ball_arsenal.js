/** Initializes the ball arsenal page and shared site navigation. */
import { loadNavbar } from "./navbar.js";
import { createBall, deleteBall as deleteBallRequest, getBalls } from "./requests.js";
import {
    createBallFilterPopup,
    createBallPopup,
    createDeleteBallPopup,
    openBallFilterPopup,
    openBallPopup,
    openDeleteBallPopup,
    showMiniPopup,
} from "./popups.js";

loadNavbar();
let activeFilters = {};
let searchTimer = null;
let searchRequestId = 0;
let listRenderRequestId = 0;
let suggestionBalls = [];
let showingSuggestionResults = false;

const searchInput = document.getElementById("ball-search");
const suggestionsContainer = document.getElementById("ball-search-suggestions");
const ballListContainer = document.getElementById("ball-list-container");
const filterBallButton = document.getElementById("filter-ball-button");

createBallPopup(async (values) => {
    await createBall({
        ball_name: values.ball_name.trim(),
        color: values.color,
        core_type: values.core_type,
        weight: Number(values.weight),
    });
    resetSearch();
    await loadAndRenderBalls(activeFilters);
    showMiniPopup("Ball added to your arsenal");
});

createDeleteBallPopup(async (ball) => {
    await deleteBallRequest(ball.ball_id);
    resetSearch();
    const deletedItem = [...ballListContainer.querySelectorAll("ball-list-item")]
        .find((item) => item.dataset.ballId === String(ball.ball_id));
    deletedItem?.remove();
    if (!ballListContainer.querySelector("ball-list-item")) {
        renderBalls([]);
    }
    showMiniPopup(`${ball.ball_name} deleted`);
    loadAndRenderBalls(activeFilters).catch((error) => {
        console.error("Could not refresh balls after deletion:", error);
    });
});

createBallFilterPopup(async (filters) => {
    await loadAndRenderBalls(filters);
    ballListContainer.scrollTop = 0;
    activeFilters = filters;
    resetSearch();
});

filterBallButton.addEventListener("click", () => {
    openBallFilterPopup(activeFilters);
});

const addBallButton = document.getElementById("add-ball-button");
addBallButton.addEventListener("click", openBallPopup);

searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    const requestId = ++searchRequestId;
    window.clearTimeout(searchTimer);

    if (!query) {
        suggestionsContainer.hidden = true;
        suggestionsContainer.replaceChildren();
        suggestionBalls = [];
        if (showingSuggestionResults) {
            showingSuggestionResults = false;
            loadAndRenderBalls(activeFilters).catch((error) => {
                console.error("Could not restore balls:", error);
            });
        }
        return;
    }

    searchTimer = window.setTimeout(async () => {
        try {
            const balls = await getBalls({
                ...activeFilters,
                name_contains: query,
            });
            if (requestId !== searchRequestId) return;
            showSearchSuggestions(balls);
        } catch (error) {
            if (requestId !== searchRequestId) return;
            console.error("Could not search balls:", error);
            showSearchMessage("Could not load suggestions.");
        }
    }, 180);
});

suggestionsContainer.addEventListener("click", (event) => {
    const option = event.target.closest("button[data-ball-id]");
    if (!option) return;

    const ball = suggestionBalls.find(
        (candidate) => String(candidate.ball_id) === option.dataset.ballId,
    );
    if (!ball) return;

    window.clearTimeout(searchTimer);
    searchRequestId += 1;
    searchInput.value = ball.ball_name;
    suggestionsContainer.hidden = true;

    let item = [...document.querySelectorAll("ball-list-item")]
        .find((candidate) => candidate.dataset.ballId === String(ball.ball_id));
    if (!item) {
        listRenderRequestId += 1;
        renderBalls(suggestionBalls);
        showingSuggestionResults = true;
        item = [...document.querySelectorAll("ball-list-item")]
            .find((candidate) => candidate.dataset.ballId === String(ball.ball_id));
    }

    item?.setExpanded(true);
    requestAnimationFrame(() => {
        item?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".search_container")) {
        suggestionsContainer.hidden = true;
        searchRequestId += 1;
        window.clearTimeout(searchTimer);
    }
});

searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        suggestionsContainer.hidden = true;
        searchRequestId += 1;
        window.clearTimeout(searchTimer);
    }
});

loadAndRenderBalls().catch((error) => {
    console.error("Could not load balls:", error);
});

async function loadAndRenderBalls(filters = {}) {
    const requestId = ++listRenderRequestId;
    const balls = await getBalls(filters);
    if (requestId !== listRenderRequestId) return balls;
    renderBalls(balls);
    return balls;
}

function renderBalls(balls) {
    ballListContainer.replaceChildren();

    if (balls.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "no_balls_container";

        const message = document.createElement("p");
        message.textContent = "Whoops! You have no balls!";

        const addButton = document.createElement("button");
        addButton.id = "no-balls-add-button";
        addButton.className = "no_balls_add_button";
        addButton.type = "button";
        addButton.textContent = "Add a Ball";
        addButton.addEventListener("click", openBallPopup);

        emptyState.append(message, addButton);
        ballListContainer.appendChild(emptyState);
        return;
    }

    for (const ball of balls) {
        addBall(ball);
    }
}

function showSearchSuggestions(balls) {
    suggestionBalls = balls;
    suggestionsContainer.replaceChildren();

    if (balls.length === 0) {
        showSearchMessage("No matching balls.");
        return;
    }

    for (const ball of balls) {
        const option = document.createElement("button");
        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.dataset.ballId = String(ball.ball_id);
        option.textContent = ball.ball_name;
        suggestionsContainer.appendChild(option);
    }

    suggestionsContainer.hidden = false;
}

function showSearchMessage(message) {
    suggestionsContainer.replaceChildren();
    const status = document.createElement("p");
    status.className = "ball_search_empty";
    status.textContent = message;
    suggestionsContainer.appendChild(status);
    suggestionsContainer.hidden = false;
}

function resetSearch() {
    searchRequestId += 1;
    window.clearTimeout(searchTimer);
    searchInput.value = "";
    suggestionBalls = [];
    suggestionsContainer.replaceChildren();
    suggestionsContainer.hidden = true;
    showingSuggestionResults = false;
}

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

function resizeBallName(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
}

class BallListItem extends HTMLElement {
    static observedAttributes = ["name", "color", "details"];

    connectedCallback() {
        if (!this.querySelector(".ball_list_item_header")) {
            this.classList.add("ball_list_item");
            const imageFilter = ballImageFilter(this.getAttribute("color"));
            this.innerHTML = `
                <div class="ball_list_item_header">
                    <div class="ball_image_container" style="background-color: ${this.getAttribute("color")}; display: inline-block;">
                        <img src="./public/icons/ball.png" class="ball_image" style="display: block; mix-blend-mode: multiply">
                    </div>
                    <textarea class="ball_name" rows="1" wrap="soft" aria-label="Ball name" placeholder="Ball name"></textarea>
                    <button class="ball_expand_button" type="button" aria-expanded="false">Expand</button>
                </div>
                <div class="ball_details" hidden>
                    <p>${this.getAttribute("details")}</p>
                    <button class="ball_delete_button" type="button">Delete ball</button>
                </div>
            `;

            const nameField = this.querySelector(".ball_name");
            nameField.value = this.getAttribute("name") ?? "";
            resizeBallName(nameField);
            requestAnimationFrame(() => resizeBallName(nameField));
            this.querySelector(".ball_name").addEventListener("input", (event) => {
                this.setAttribute("name", event.currentTarget.value);
                resizeBallName(event.currentTarget);
            });

            this.querySelector(".ball_expand_button").addEventListener("click", (event) => {
                const button = event.currentTarget;
                const expanded = button.getAttribute("aria-expanded") !== "true";
                this.setExpanded(expanded);
            });

            this.querySelector(".ball_delete_button").addEventListener("click", () => {
                openDeleteBallPopup({
                    ball_id: this.dataset.ballId,
                    ball_name: this.getAttribute("name"),
                });
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
            if (input && input.value !== newValue) {
                input.value = newValue ?? "";
                resizeBallName(input);
            }
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
    item.dataset.ballId = String(ball.ball_id);
    item.setAttribute("name", ball.ball_name);
    item.setAttribute("details", `Weight: ${ball.weight}lbs<br>Core: ${ball.core_type}`)
    if (ball.color) item.setAttribute("color", ball.color);

    container.appendChild(item);
}
