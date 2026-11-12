import { request } from "./api_client.js";

export async function listAll(path) {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
        const page = await request(`${path}?limit=100&offset=${offset}`);
        if (!Array.isArray(page)) throw new Error("Unexpected database response.");
        rows.push(...page);
        if (page.length < 100) return rows;
    }
}

const post = (path, body) => request(path, {
    method: "POST", body: JSON.stringify(body),
});

// Persist each returned ID before making the next request. If a response is
// lost, the caller blocks retries until database progress has been reconciled.
export async function createSavedGame(database, remember) {
    await request("/auth/me");
    if (!database.eventId) {
        const event = database.selectedEventId
            ? { event_id: database.selectedEventId }
            : await post("/game-setup/unassigned-event", {});
        database.eventId = event.event_id;
        remember();
    }
    if (!database.sessionId) {
        const session = await post("/sessions", {
            event_id: database.eventId, establishment_id: database.selectedEstablishmentId ?? null,
            date_time: new Date().toISOString(), opponent: null,
            score: null, record: null,
        });
        database.sessionId = session.session_id;
        remember();
    }
    if (!database.game) {
        database.game = await post("/games", {
            session_id: database.sessionId, game_number: 1,
            lane_number: null, game_score: null, game_result: null,
        });
        remember();
    }
    return database.game;
}

export async function saveConfirmedShots(database, frames, remember) {
    for (const frame of frames) {
        if (!frame.shots.length) continue;
        if (!database.frameIds[frame.id]) {
            const saved = await post("/frames", {
                game_id: database.game.game_id,
                frame_number: frame.number, frame_result: null,
            });
            database.frameIds[frame.id] = saved.frame_id;
            remember();
        }
        for (const shot of frame.shots) {
            if (database.shotIds[shot.id]) continue;
            const saved = await post("/shots", {
                frame_id: database.frameIds[frame.id], shot_number: shot.number,
                throw_type: shot.symbol === "X" ? "strike"
                    : shot.symbol === "/" ? "spare" : null,
                pin_leave: shot.leave, foul: shot.result.foul, side: null, position: null,
                comment: shot.comment || null, ball_id: null,
            });
            database.shotIds[shot.id] = saved.shot_id;
            remember();
        }
    }
}

export async function updateShotComment(id, comment) {
    const shot = await request(`/shots/${id}`);
    const { shot_id, ...payload } = shot;
    return request(`/shots/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, comment: comment || null }) });
}

export async function readSavedGame(id) {
    if (!/^[1-9]\d*$/.test(String(id))) throw new Error("Invalid game ID.");
    const game = await request(`/games/${id}`);
    const [allFrames, allShots] = await Promise.all([listAll("/frames"), listAll("/shots")]);
    const frames = allFrames.filter((frame) => frame.game_id === game.game_id);
    return { game, frames: frames.map((frame) => ({
        ...frame,
        shots: allShots.filter((shot) => shot.frame_id === frame.frame_id)
            .sort((a, b) => a.shot_number - b.shot_number),
    })) };
}
