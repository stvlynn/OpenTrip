import { describe, expect, it } from "vitest";
import { resolveInitialSession } from "./auth-session-state";

describe("resolveInitialSession", () => {
  it("keeps the auth gate blocked throughout the initial fetch", () => {
    expect(
      resolveInitialSession(false, {
        isAuthenticated: false,
        sessionBusy: true,
      }),
    ).toBe(false);
  });

  it("resolves after an authenticated or signed-out result", () => {
    expect(
      resolveInitialSession(false, {
        isAuthenticated: true,
        sessionBusy: true,
      }),
    ).toBe(true);
    expect(
      resolveInitialSession(false, {
        isAuthenticated: false,
        sessionBusy: false,
      }),
    ).toBe(true);
  });

  it("stays resolved during later signed-out refetches", () => {
    expect(
      resolveInitialSession(true, {
        isAuthenticated: false,
        sessionBusy: true,
      }),
    ).toBe(true);
  });
});
