import Taro from "@tarojs/taro";

import { rawRequest } from "@/shared/api/transport";

import { clearToken, readToken, writeToken } from "./token-store";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  defaultCurrency?: string | null;
}

interface SignInResponse {
  token?: string;
  user?: SessionUser;
}

interface GetSessionResponse {
  user?: SessionUser;
}

/**
 * WeChat sign-in for the native client.
 *
 * `wx.login()` is exchanged once for a Better Auth session token, which is then
 * sent as a Bearer credential on every request. Unlike the former WebView shell
 * there is no cookie handoff: the Mini Program is the product surface.
 */

let inflight: Promise<SessionUser> | null = null;

export function currentToken(): string {
  return readToken();
}

/** Resolve a usable session, reusing the stored token when it is still valid. */
export function ensureSession(): Promise<SessionUser> {
  inflight ??= resolveSession().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Discard the session and sign in again (used after a 401).
 *
 * Renewal clears the token and re-runs `wx.login` directly — a silent WeChat
 * re-auth with no credentials prompt. That is why the client has no sign-out
 * UI: signing out would be undone by the next automatic login.
 */
export async function renewSession(): Promise<SessionUser> {
  clearToken();
  return ensureSession();
}

export async function signOut(): Promise<void> {
  const token = readToken();
  if (token) {
    await rawRequest({
      path: "/api/auth/sign-out",
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  clearToken();
}

async function resolveSession(): Promise<SessionUser> {
  const stored = readToken();
  if (stored) {
    const existing = await fetchSessionUser(stored);
    if (existing) return existing;
    clearToken();
  }
  return signInWithWechat();
}

async function fetchSessionUser(token: string): Promise<SessionUser | null> {
  const response = await rawRequest({
    path: "/api/auth/get-session",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.statusCode !== 200) return null;
  const user = (response.body as GetSessionResponse | null)?.user;
  return user ?? null;
}

async function signInWithWechat(): Promise<SessionUser> {
  const { code } = await Taro.login({ timeout: 10_000 });
  if (!code) throw new Error("WeChat login returned no code");

  const response = await rawRequest({
    path: "/api/auth/wechat-mini-program/sign-in",
    method: "POST",
    body: { code },
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`WeChat sign-in failed with ${response.statusCode}`);
  }

  const { token, user } = (response.body ?? {}) as SignInResponse;
  if (!token || !user) throw new Error("WeChat sign-in returned no session");
  writeToken(token);
  return user;
}
