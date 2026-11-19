/** Compact, read-only previews using the same authenticated APIs as the full pages. */
import { request } from "./database.js";
import { listAll } from "./game_persistence.js";
const LABELS = { stats: "Stats", games: "Games", arsenal: "Ball Arsenal" };
export function renderHomeWidget(node, id, expanded) {
    const size = expanded ? "large" : "small";
    if (node.dataset.widgetSize === size) return;
    node.dataset.widgetSize = size;
    node.classList.toggle("home-widget-large", expanded);
    node.replaceChildren();
    if (!expanded) { node.textContent = LABELS[id]; return; }
    const title = document.createElement("h2"); title.textContent = LABELS[id];
    const content = document.createElement("div"); content.className = "home-widget-content";
    const footer = document.createElement("span"); footer.className = "home-widget-footer"; footer.textContent = "Open full page";
    node.append(title, content, footer);
    const token = sessionStorage.getItem("authentication_token");
    if (!token || token === "null") { content.textContent = "Log in to view this widget."; return; }
    content.textContent = "Loading…";
    void (async () => {
        try {
            const data = id === "stats" ? await request("/statistics?recent_limit=3") : await listAll(id === "games" ? "/games" : "/balls");
            if (node.dataset.widgetSize !== size || node.children[1] !== content || sessionStorage.getItem("authentication_token") !== token) return;
            content.replaceChildren();
            if (id === "stats") {
                for (const [label, value] of [["Completed Games", data.completed_games], ["Average Score", data.average_score], ["Highest Score", data.highest_score]]) {
                    const metric = document.createElement("div"); metric.className = "home-widget-metric";
                    const name = document.createElement("span"); name.textContent = label;
                    const number = document.createElement("strong");
                    number.textContent = value == null ? "—" : new Intl.NumberFormat(document.documentElement.lang || "en", { maximumFractionDigits: 2 }).format(value);
                    metric.append(name, number); content.append(metric);
                }
            } else {
                const records = id === "games" ? [...data].sort((a, b) => b.game_id - a.game_id) : data;
                if (!records.length) { content.textContent = id === "games" ? "No saved games yet." : "No balls yet."; return; }
                const list = document.createElement("ul");
                for (const record of records.slice(0, 3)) {
                    const row = document.createElement("li");
                    row.textContent = id === "games" ? record.nickname || `Game #${record.game_id}` : record.ball_name;
                    if (id === "arsenal" || record.nickname) row.setAttribute("translate", "no");
                    list.append(row);
                }
                content.append(list);
            }
        } catch {
            if (node.children[1] === content) content.textContent = "Could not load this widget. Tap to open the page.";
        }
    })();
}
