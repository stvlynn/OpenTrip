import { describe, expect, it, vi } from "vitest";
import { handleRealtimeUpgrade } from "../src/worker";

const secret = "test-realtime-secret-at-least-32-bytes-long";

function request(origin = "https://opentrip.im", upgrade = "websocket") {
  return new Request("https://api.opentrip.im/api/trips/trip-1/realtime", {
    headers: { Origin: origin, Upgrade: upgrade },
  });
}

function fixture(options?: { session?: boolean; member?: boolean }) {
  const fetch = vi.fn(async (request: Request) => {
    void request;
    return new Response("forwarded");
  });
  const env = {
    REALTIME_GRANT_SECRET: secret,
    TRIP_REALTIME: {
      getByName: vi.fn(() => ({ fetch })),
    },
  };
  const user = { id: "user-1", name: "Ada", email: "ada@example.com", image: null };
  const container = {
    config: { trustedOrigins: ["https://opentrip.im"] },
    auth: {
      api: {
        getSession: vi.fn(async () =>
          options?.session === false ? null : { user, session: { id: "s1" } },
        ),
      },
    },
    tripService: {
      getTrip: vi.fn(async () => ({
        members:
          options?.member === false
            ? []
            : [
                {
                  userId: "user-1",
                  isCurrentUser: true,
                  role: "editor",
                },
              ],
      })),
    },
  };
  return { env, container, fetch };
}

describe("Cloudflare realtime upgrade route", () => {
  it("rejects non-upgrade and untrusted-origin requests", async () => {
    const { env, container } = fixture();
    await expect(
      handleRealtimeUpgrade(request("https://opentrip.im", "no"), env as never, container as never),
    ).resolves.toMatchObject({ status: 426 });
    await expect(
      handleRealtimeUpgrade(request("https://evil.example"), env as never, container as never),
    ).resolves.toMatchObject({ status: 403 });
  });

  it("requires an authenticated trip member", async () => {
    const signedOut = fixture({ session: false });
    await expect(
      handleRealtimeUpgrade(request(), signedOut.env as never, signedOut.container as never),
    ).resolves.toMatchObject({ status: 401 });

    const nonMember = fixture({ member: false });
    await expect(
      handleRealtimeUpgrade(request(), nonMember.env as never, nonMember.container as never),
    ).resolves.toMatchObject({ status: 404 });
  });

  it("forwards a short-lived signed grant to the trip Durable Object", async () => {
    const { env, container, fetch } = fixture();
    const response = await handleRealtimeUpgrade(
      request(),
      env as never,
      container as never,
    );

    expect(await response?.text()).toBe("forwarded");
    expect(env.TRIP_REALTIME.getByName).toHaveBeenCalledWith("trip-1");
    const forwarded = fetch.mock.calls[0]![0];
    expect(forwarded.headers.get("Upgrade")).toBe("websocket");
    expect(forwarded.headers.get("Authorization")).toMatch(/^Bearer .+\..+$/);
  });
});
