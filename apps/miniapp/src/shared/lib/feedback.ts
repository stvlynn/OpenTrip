import Taro from "@tarojs/taro";

import { copy } from "@/shared/copy";

export function toast(title: string): void {
  void Taro.showToast({ title, icon: "none", duration: 1_800 });
}

export function toastSuccess(title: string): void {
  void Taro.showToast({ title, icon: "success", duration: 1_800 });
}

// No action-generic failure key exists in shared/copy yet, so keep one here.
const GENERIC_ERROR_COPY = "操作失败，请稍后重试";

// Raw Error.message is usually ASCII-only English library noise; localized
// (Chinese) copy contains non-ASCII characters.
const ASCII_ONLY = /^[\x20-\x7E]+$/;

export function toastError(error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : "";
  console.error(fallback, error);
  if (message && ASCII_ONLY.test(message)) {
    toast(GENERIC_ERROR_COPY);
    return;
  }
  toast(message && message.length <= 40 ? message : fallback);
}

export async function confirm(content: string): Promise<boolean> {
  const result = await Taro.showModal({
    content,
    confirmText: copy.app.confirm,
    cancelText: copy.app.cancel,
  });
  return Boolean(result.confirm);
}

/** Native action sheet. Resolves to the chosen index, or null when dismissed. */
export async function chooseFromList(
  itemList: readonly string[],
): Promise<number | null> {
  try {
    const result = await Taro.showActionSheet({ itemList: [...itemList] });
    return result.tapIndex;
  } catch {
    return null;
  }
}

export function copyToClipboard(data: string): void {
  void Taro.setClipboardData({ data });
}
