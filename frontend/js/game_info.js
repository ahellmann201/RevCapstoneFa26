/** Shows saved games, calculated scores, and shot-by-shot details. */
import { loadNavbar } from "./navbar.js";
import { request } from "./api_client.js";

loadNavbar();

const status = document.getElementById("page-status");
const detail = document.getElementById("game-detail");
const completedGamesValue = document.getElementById("completed-games");
const averageScoreValue = document.getElementById("average-score");
const highestScoreValue = document.getElementById("highest-score");

async function getAll(path) {
    const records = [];
    for (let offset = 0; ; offset += 100) {
        const page = await request(`${path}?limit=100&offset=${offset}`);
        records.push(...page);
        if (page.length < 100) return records;
    }
}

function invalidResult(game, framesByGame) {
    const frames = Array.from({ length: 10 }, (_, index) => ({ number: index + 1, rolls: [], cumulative: null }));
    const records = framesByGame.get(game.game_id) ?? [];
    for (const frame of records) {
        if (!Number.isInteger(frame.frame_number) || frame.frame_number < 1 || frame.frame_number > 10) continue;
        const standing = new Set(Array.from({ length: 10 }, (_, index) => index + 1));
        const shots = [...(frame.shots ?? [])].sort((a, b) => a.shot_number - b.shot_number);
        for (const shot of shots) {
            const leave = shot.foul ? [...standing] : Array.isArray(shot.pin_leave) ? shot.pin_leave : [...standing];
            const knockedDown = Math.max(0, standing.size - leave.length);
            frames[frame.frame_number - 1].rolls.push({ shot, knockedDown, leave: [...leave] });
            standing.clear();
            const nextStanding = frame.frame_number === 10 && leave.length === 0
                ? Array.from({ length: 10 }, (_, index) => index + 1)
                : leave;
            for (const pin of nextStanding) standing.add(pin);
        }
    }
    return { state: "invalid", frames };
}

function scoreGame(game, framesByGame) {
    const frameRecords = framesByGame.get(game.game_id) ?? [];
    const byNumber = new Map();
    for (const frame of frameRecords) {
        if (!Number.isInteger(frame.frame_number) || frame.frame_number < 1 || frame.frame_number > 10 || byNumber.has(frame.frame_number)) {
            return invalidResult(game, framesByGame);
        }
        byNumber.set(frame.frame_number, frame);
    }

    const rollsByFrame = [];
    const shotsByFrame = [];
    const completeFrames = [];
    for (let number = 1; number <= 10; number++) {
        const frame = byNumber.get(number);
        const shots = frame ? [...(frame.shots ?? [])].sort((a, b) => a.shot_number - b.shot_number) : [];
        const standing = new Set(Array.from({ length: 10 }, (_, index) => index + 1));
        const rolls = [];
        const displayShots = [];
        let complete = false;

        for (let index = 0; index < shots.length; index++) {
            const shot = shots[index];
            if (complete || !Number.isInteger(shot.shot_number) || shot.shot_number !== index + 1) {
                return invalidResult(game, framesByGame);
            }
            const leave = shot.foul ? [...standing] : shot.pin_leave;
            if (!Array.isArray(leave) || leave.some((pin) => !Number.isInteger(pin) || pin < 1 || pin > 10) || new Set(leave).size !== leave.length || leave.some((pin) => !standing.has(pin))) {
                return invalidResult(game, framesByGame);
            }
            const knockedDown = standing.size - leave.length;
            rolls.push(knockedDown);
            displayShots.push({ shot, knockedDown, leave: [...leave] });
            if (number < 10) complete = leave.length === 0 || index === 1;
            else if (index === 1) complete = rolls[0] !== 10 && rolls[0] + rolls[1] < 10;
            else if (index === 2) complete = true;
            standing.clear();
            for (const pin of number === 10 && leave.length === 0 ? Array.from({ length: 10 }, (_, i) => i + 1) : leave) standing.add(pin);
        }
        rollsByFrame.push(rolls);
        shotsByFrame.push(displayShots);
        completeFrames.push(complete);
    }

    if (!completeFrames.every(Boolean)) {
        return { state: "incomplete", frames: shotsByFrame.map((rolls) => ({ rolls, cumulative: null })) };
    }
    const allRolls = rollsByFrame.flat();
    let rollOffset = 0;
    let runningTotal = 0;
    const frames = [];
    for (let index = 0; index < 9; index++) {
        const frameRolls = rollsByFrame[index];
        let frameScore;
        if (frameRolls[0] === 10) frameScore = allRolls.slice(rollOffset, rollOffset + 3).reduce((sum, value) => sum + value, 0);
        else if (frameRolls[0] + frameRolls[1] === 10) frameScore = allRolls.slice(rollOffset, rollOffset + 3).reduce((sum, value) => sum + value, 0);
        else frameScore = frameRolls.reduce((sum, value) => sum + value, 0);
        runningTotal += frameScore;
        frames.push({ rolls: shotsByFrame[index], cumulative: runningTotal });
        rollOffset += frameRolls.length;
    }
    const tenthScore = rollsByFrame[9].reduce((sum, value) => sum + value, 0);
    runningTotal += tenthScore;
    frames.push({ rolls: shotsByFrame[9], cumulative: runningTotal });
    return { state: "complete", score: runningTotal, frames };
}

function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function createText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

function renderDetail(entry, sessionsById) {
    const { game, result } = entry;
    const session = sessionsById.get(game.session_id);
    detail.replaceChildren();

    const header = document.createElement("header");
    header.className = "detail-heading";
    const heading = document.createElement("div");
    const backLink = document.createElement("a");
    backLink.className = "back-to-stats";
    backLink.href = "/stats.html";
    backLink.textContent = "← Back to Stats";
    heading.append(backLink);
    heading.append(createText("h2", "", `Game #${game.game_number}`));
    heading.append(createText("p", "", `Game ID ${game.game_id} · ${formatDate(session?.date_time)}`));
    const score = document.createElement("div");
    score.className = "detail-score";
    score.textContent = result.state === "complete" ? String(result.score) : result.state === "invalid" ? "—" : "…";
    score.append(createText("small", "", result.state === "complete" ? "calculated score" : result.state === "invalid" ? "invalid record" : "in progress"));
    header.append(heading, score);
    detail.append(header);

    const metrics = document.createElement("div");
    metrics.className = "game-metrics";
    const facts = [
        ["Date", formatDate(session?.date_time)],
        ["Lane", game.lane_number ?? "—"],
        ["Opponent", session?.opponent || "—"],
        ["Shots", result.frames.reduce((count, frame) => count + frame.rolls.length, 0)],
    ];
    for (const [label, value] of facts) {
        const fact = document.createElement("div");
        fact.append(createText("span", "", `${label}: `), document.createTextNode(String(value)));
        metrics.append(fact);
    }
    detail.append(metrics);

    detail.append(createText("h3", "frames-title", "Scorecard"));
    const grid = document.createElement("div");
    grid.className = "frame-grid";
    result.frames.forEach((frame, index) => {
        const card = document.createElement("article");
        card.className = "frame-card";
        card.append(createText("h3", "", `Frame ${index + 1}`));
        const rolls = document.createElement("div");
        rolls.className = "frame-rolls";
        frame.rolls.forEach((roll) => {
            const mark = roll.shot.foul ? "F" : roll.knockedDown === 0 ? "–" : String(roll.knockedDown);
            rolls.append(createText("span", "roll-cell", mark));
        });
        card.append(rolls, createText("span", "frame-total", frame.cumulative == null ? "Open" : `Total ${frame.cumulative}`));
        grid.append(card);
    });
    detail.append(grid);

    const shotSection = document.createElement("section");
    shotSection.className = "shot-list";
    shotSection.append(createText("h3", "", "Individual shots"));
    result.frames.forEach((frame, frameIndex) => {
        frame.rolls.forEach((roll) => {
            const row = document.createElement("div");
            row.className = "shot-row";
            row.append(createText("span", "shot-frame", `Frame ${frameIndex + 1}`));
            row.append(createText("span", roll.shot.foul ? "shot-foul" : "shot-pins", `Shot ${roll.shot.shot_number}: ${roll.shot.foul ? "Foul" : `${roll.knockedDown} down`}`));
            const leaveText = roll.leave.length ? `Pins left: ${roll.leave.join(", ")}` : "Pins left: none";
            row.append(createText("span", "shot-leave", roll.shot.comment ? `${leaveText} · ${roll.shot.comment}` : leaveText));
            shotSection.append(row);
        });
    });
    detail.append(shotSection);
}

async function loadSelectedGame() {
    const gameId = new URLSearchParams(window.location.search).get("game_id");
    if (!gameId || !/^\d+$/.test(gameId)) {
        status.textContent = "Select a completed game from the Stats page to view its details.";
        return;
    }

    try {
        const [game, frames, shots, statistics] = await Promise.all([
            request(`/games/${encodeURIComponent(gameId)}`), getAll("/frames"), getAll("/shots"),
            request("/statistics?recent_limit=1").catch(() => null),
        ]);
        if (statistics) {
            completedGamesValue.textContent = String(statistics.completed_games ?? 0);
            averageScoreValue.textContent = statistics.average_score == null ? "—" : Number(statistics.average_score).toFixed(2);
            highestScoreValue.textContent = statistics.highest_score == null ? "—" : String(statistics.highest_score);
        }

        const framesByGame = new Map();
        const frameById = new Map();
        for (const frame of frames) {
            const gameFrames = framesByGame.get(frame.game_id) ?? [];
            gameFrames.push({ ...frame, shots: [] });
            framesByGame.set(frame.game_id, gameFrames);
            frameById.set(frame.frame_id, gameFrames[gameFrames.length - 1]);
        }
        for (const shot of shots) frameById.get(shot.frame_id)?.shots.push(shot);

        const session = await request(`/sessions/${encodeURIComponent(game.session_id)}`);
        const result = scoreGame(game, framesByGame);
        if (result.state !== "complete") {
            status.textContent = result.state === "invalid"
                ? "This game has invalid shot records and cannot be shown as a completed game."
                : "This game is still in progress and is not available on the Game Info page.";
            return;
        }
        renderDetail({ game, result }, new Map([[session.session_id, session]]));
        detail.hidden = false;
        status.hidden = true;
    } catch (error) {
        status.textContent = error.message || "Your games could not be loaded. Please try again later.";
    }
}

loadSelectedGame();
