import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../database.js", () => ({ request: vi.fn() }));
import { request } from "../database.js";
import {
    createSavedGame,
    listAll,
    readSavedGame,
    saveConfirmedShots,
    updateSavedShot,
    updateShotComment,
} from "../game_persistence.js";

beforeEach(() => vi.resetAllMocks());

it("loads all paginated records and rejects a malformed page", async () => {
    request.mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => index))
        .mockResolvedValueOnce([100]);
    const rows = await listAll("/games");
    expect(rows).toHaveLength(101);
    expect(request.mock.calls).toEqual([
        ["/games?limit=100&offset=0"],
        ["/games?limit=100&offset=100"],
    ]);

    request.mockResolvedValueOnce({ unexpected: true });
    await expect(listAll("/games")).rejects.toThrow("Unexpected database response.");
});

it("creates an unassigned event, session, and game while remembering every saved ID", async () => {
    request.mockResolvedValueOnce({ user_id: 7 })
        .mockResolvedValueOnce({ event_id: 12 })
        .mockResolvedValueOnce({ session_id: 23 })
        .mockResolvedValueOnce({ game_id: 34 });
    const database = { selectedEstablishmentId: 56, selectedGameNumber: 2, frameIds: {}, shotIds: {} };
    const remember = vi.fn();

    const game = await createSavedGame(database, remember);

    expect(game).toEqual({ game_id: 34 });
    expect(database).toMatchObject({ eventId: 12, sessionId: 23 });
    expect(remember).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[1]).toEqual(["/game-setup/unassigned-event", expect.objectContaining({ method: "POST" })]);
    expect(JSON.parse(request.mock.calls[2][1].body)).toMatchObject({ event_id: 12, establishment_id: 56 });
    expect(JSON.parse(request.mock.calls[3][1].body)).toMatchObject({ session_id: 23, game_number: 2 });
});

it("reuses selected session setup and creates only the missing game", async () => {
    request.mockResolvedValueOnce({ user_id: 7 }).mockResolvedValueOnce({ game_id: 9 });
    const database = { selectedSessionId: 4, selectedSessionEventId: 8, frameIds: {}, shotIds: {} };
    const remember = vi.fn();
    await createSavedGame(database, remember);

    expect(database).toMatchObject({ eventId: 8, sessionId: 4, game: { game_id: 9 } });
    expect(request.mock.calls.map(([path]) => path)).toEqual(["/auth/me", "/games"]);
    expect(remember).toHaveBeenCalledTimes(3);
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({ session_id: 4, game_number: 1 });
});

it("saves confirmed shots once, including strike, spare, foul, and comments", async () => {
    request.mockResolvedValueOnce({ frame_id: 101 })
        .mockResolvedValueOnce({ shot_id: 201 })
        .mockResolvedValueOnce({ shot_id: 202 });
    const database = { game: { game_id: 5 }, frameIds: {}, shotIds: {} };
    const remember = vi.fn();
    const frames = [
        { id: "empty", number: 1, shots: [] },
        { id: "frame-a", number: 1, shots: [
            { id: "strike", number: 1, symbol: "X", leave: [], result: { foul: false }, comment: "clean" },
            { id: "spare", number: 2, symbol: "/", leave: [], result: { foul: true }, comment: "" },
        ] },
    ];

    await saveConfirmedShots(database, frames, remember);
    await saveConfirmedShots(database, frames, remember);

    expect(request).toHaveBeenCalledTimes(3);
    expect(database.frameIds).toEqual({ "frame-a": 101 });
    expect(database.shotIds).toEqual({ strike: 201, spare: 202 });
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
        frame_id: 101, throw_type: "strike", pin_leave: [], foul: false, comment: "clean",
    });
    expect(JSON.parse(request.mock.calls[2][1].body)).toMatchObject({
        frame_id: 101, throw_type: "spare", foul: true, comment: null,
    });
    expect(remember).toHaveBeenCalledTimes(3);
});

it("preserves saved shot fields when changing a comment or shot result", async () => {
    const existing = { shot_id: 3, frame_id: 2, shot_number: 1, throw_type: null, pin_leave: [1], foul: false, comment: "old", ball_id: 5 };
    request.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ok: true });
    await updateShotComment(3, "new comment");
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({ frame_id: 2, ball_id: 5, comment: "new comment" });
    expect(JSON.parse(request.mock.calls[1][1].body)).not.toHaveProperty("shot_id");

    request.mockReset();
    request.mockResolvedValueOnce(existing).mockResolvedValueOnce({ ok: true });
    await updateSavedShot(3, { symbol: "X", leave: [], result: { foul: false }, comment: "strike" });
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
        frame_id: 2, ball_id: 5, throw_type: "strike", pin_leave: [], foul: false, comment: "strike",
    });
});

it("reads a game with its frames and shots in bowling order", async () => {
    request.mockImplementation(async (path) => {
        if (path === "/games/5") return { game_id: 5 };
        if (path === "/frames?limit=100&offset=0") return [
            { frame_id: 2, game_id: 5, frame_number: 2 },
            { frame_id: 1, game_id: 5, frame_number: 1 },
            { frame_id: 3, game_id: 99, frame_number: 1 },
        ];
        if (path === "/shots?limit=100&offset=0") return [
            { shot_id: 2, frame_id: 1, shot_number: 2 },
            { shot_id: 1, frame_id: 1, shot_number: 1 },
            { shot_id: 3, frame_id: 2, shot_number: 1 },
        ];
        throw new Error(`Unexpected request: ${path}`);
    });
    const result = await readSavedGame("5");
    expect(result.frames).toEqual([
        { frame_id: 2, game_id: 5, frame_number: 2, shots: [{ shot_id: 3, frame_id: 2, shot_number: 1 }] },
        { frame_id: 1, game_id: 5, frame_number: 1, shots: [
            { shot_id: 1, frame_id: 1, shot_number: 1 }, { shot_id: 2, frame_id: 1, shot_number: 2 },
        ] },
    ]);
    await expect(readSavedGame("0")).rejects.toThrow("Invalid game ID.");
    await expect(readSavedGame("1x")).rejects.toThrow("Invalid game ID.");
});
