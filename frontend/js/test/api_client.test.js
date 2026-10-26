import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("API address follows the website host", () => {
    for (const hostname of ["localhost", "10.127.37.132", "192.168.1.20"]) {
        it(`uses ${hostname} for API requests`, async () => {
            vi.stubGlobal("window", { location: { hostname } });
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ status: "ok" }),
            });
            vi.stubGlobal("fetch", fetchMock);
            const { testPython } = await import("../api_client.js");
            await testPython();
            expect(fetchMock.mock.calls[0][0]).toBe(`http://${hostname}:8000/health`);
        });
    }
});
