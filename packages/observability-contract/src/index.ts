export function normalizeMessageText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export async function fingerprintMessageText(value: string): Promise<string> {
  const normalized = normalizeMessageText(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export function textFromMessageParts(
  parts: readonly { type: string; text?: unknown }[],
): string {
  return parts
    .filter(
      (part): part is { type: string; text: string } =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}
