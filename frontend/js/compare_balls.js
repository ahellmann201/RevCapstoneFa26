/** Loads the shared navigation and compares selected balls from the arsenal. */
import { loadNavbar } from "./navbar.js";
import { getBalls } from "./requests.js";

loadNavbar();

const ballList = document.getElementById("ball-list");
const status = document.getElementById("compare-status");
const results = document.getElementById("comparison-results");
const tableHead = document.getElementById("comparison-head");
const tableBody = document.getElementById("comparison-body");
let balls = [];
let sortKey = null;
let sortDirection = 1;

ballList.addEventListener("click", (event) => {
    const choice = event.target.closest("button[data-ball-id]");
    if (!choice) return;

    const selected = choice.getAttribute("aria-pressed") === "true";
    choice.setAttribute("aria-pressed", String(!selected));
    renderComparison();
});
tableHead.addEventListener("click", (event) => {
    const sortButton = event.target.closest("button[data-sort-key]");
    if (!sortButton) return;

    if (sortKey === sortButton.dataset.sortKey) {
        sortDirection *= -1;
    } else {
        sortKey = sortButton.dataset.sortKey;
        sortDirection = 1;
    }
    renderComparison();
});
loadBalls();

async function loadBalls() {
    try {
        balls = await getBalls();
        if (balls.length === 0) {
            status.textContent = "Your ball arsenal is empty. Add balls in Ball Arsenal to compare them here.";
            return;
        }

        renderBallChoices();
        status.textContent = "Select one or more balls to compare their weight and core type.";
    } catch (error) {
        console.error("Could not load balls for comparison:", error);
        status.textContent = "Could not load your balls. Please try again later.";
    }
}

function renderBallChoices() {
    const fragment = document.createDocumentFragment();
    balls.forEach((ball, index) => {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = "ball-choice";
        choice.dataset.ballId = String(ball.ball_id);
        choice.setAttribute("aria-pressed", "false");
        choice.textContent = ball.ball_name;
        choice.id = `compare-ball-${index}`;
        fragment.append(choice);
    });
    ballList.replaceChildren(fragment);
}

function renderComparison() {
    const selectedIds = new Set(
        [...ballList.querySelectorAll('button[aria-pressed="true"]')]
            .map((button) => button.dataset.ballId),
    );
    const selectedBalls = balls.filter((ball) => selectedIds.has(String(ball.ball_id)));
    if (sortKey) selectedBalls.sort(compareBalls);

    if (selectedBalls.length === 0) {
        results.hidden = true;
        status.hidden = false;
        status.textContent = "Select one or more balls to compare their weight and core type.";
        tableHead.replaceChildren();
        tableBody.replaceChildren();
        return;
    }

    const headingRow = document.createElement("tr");
    for (const [key, heading] of [["name", "Ball"], ["weight", "Weight"], ["core_type", "Core type"]]) {
        headingRow.append(createSortableHeading(key, heading));
    }
    const removeHeading = createCell("th", "");
    removeHeading.setAttribute("aria-label", "Deselect ball");
    headingRow.append(removeHeading);

    const bodyRows = selectedBalls.map((ball) => {
        const row = document.createElement("tr");
        row.append(createCell("th", ball.ball_name, "row-header"));
        row.append(createCell("td", `${ball.weight} lb`));
        row.append(createCell("td", ball.core_type || "—"));
        const removeCell = document.createElement("td");
        removeCell.className = "compare-remove-cell";
        removeCell.append(createRemoveButton(ball));
        row.append(removeCell);
        return row;
    });

    tableHead.replaceChildren(headingRow);
    tableBody.replaceChildren(...bodyRows);
    status.hidden = true;
    results.hidden = false;
}

function createCell(tagName, text, className = "") {
    const cell = document.createElement(tagName);
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
}

function createSortableHeading(key, label) {
    const heading = document.createElement("th");
    heading.scope = "col";
    const active = sortKey === key;
    heading.setAttribute("aria-sort", active
        ? sortDirection === 1 ? "ascending" : "descending"
        : "none");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "compare-sort-button";
    button.dataset.sortKey = key;
    button.setAttribute("aria-label", active
        ? `Sort by ${label}, ${sortDirection === 1 ? "ascending" : "descending"}. Activate to reverse.`
        : `Sort by ${label} ascending.`);

    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    if (active) {
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        indicator.setAttribute("aria-hidden", "true");
        indicator.textContent = sortDirection === 1 ? " ↑" : " ↓";
        button.append(indicator);
    }
    heading.append(button);
    return heading;
}

function compareBalls(first, second) {
    let primaryComparison;
    if (sortKey === "name") {
        primaryComparison = first.ball_name.localeCompare(second.ball_name, undefined, { sensitivity: "base" });
        return primaryComparison * sortDirection;
    }

    if (sortKey === "weight") {
        const firstWeight = Number(first.weight);
        const secondWeight = Number(second.weight);
        if (Number.isNaN(firstWeight) || Number.isNaN(secondWeight)) {
            primaryComparison = Number.isNaN(firstWeight) === Number.isNaN(secondWeight)
                ? 0
                : Number.isNaN(firstWeight) ? 1 : -1;
        } else {
            primaryComparison = firstWeight - secondWeight;
        }
    } else {
        primaryComparison = (first.core_type || "").localeCompare(
            second.core_type || "",
            undefined,
            { sensitivity: "base" },
        );
    }

    if (primaryComparison !== 0) return primaryComparison * sortDirection;
    return first.ball_name.localeCompare(second.ball_name, undefined, { sensitivity: "base" });
}

function createRemoveButton(ball) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compare-remove";
    button.setAttribute("aria-label", `Deselect ${ball.ball_name}`);
    button.addEventListener("click", () => {
        const choice = [...ballList.querySelectorAll("button[data-ball-id]")]
            .find((candidate) => candidate.dataset.ballId === String(ball.ball_id));
        choice?.setAttribute("aria-pressed", "false");
        renderComparison();
    });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "lucide lucide-x preview-icon");

    const firstPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    firstPath.setAttribute("d", "M18 6 6 18");
    const secondPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    secondPath.setAttribute("d", "m6 6 12 12");
    svg.append(firstPath, secondPath);
    button.append(svg);
    return button;
}
