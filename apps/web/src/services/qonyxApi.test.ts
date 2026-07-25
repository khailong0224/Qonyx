import { afterEach, describe, expect, it, vi } from "vitest";
import { qonyxApi } from "./qonyxApi";

afterEach(() => {
  qonyxApi.clearSessionToken();
  vi.unstubAllGlobals();
});

describe("qonyxApi session token", () => {
  it("adds the configured token to API requests and clears it from memory", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          halted: false,
          liveTradingEnabled: false,
          mainnetTradingEnabled: false,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    qonyxApi.setSessionToken("local-session-token");
    await qonyxApi.getSystemStatus();
    qonyxApi.clearSessionToken();
    await qonyxApi.getSystemStatus();

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("X-Qonyx-Session")).toBe(
      "local-session-token",
    );
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).has("X-Qonyx-Session"),
    ).toBe(false);
  });
});
