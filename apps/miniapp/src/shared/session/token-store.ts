import Taro from "@tarojs/taro";

const STORAGE_KEY = "opentrip.session.token";

let cached: string | null = null;

/** Session token used as a Bearer credential on every API request. */
export function readToken(): string {
  if (cached !== null) return cached;
  cached = Taro.getStorageSync<string>(STORAGE_KEY) || "";
  return cached;
}

export function writeToken(token: string): void {
  cached = token;
  Taro.setStorageSync(STORAGE_KEY, token);
}

export function clearToken(): void {
  cached = "";
  Taro.removeStorageSync(STORAGE_KEY);
}
