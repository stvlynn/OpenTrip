import { describe, expect, it } from "vitest";
import {
  fingerprintMessageText,
  normalizeMessageText,
  textFromMessageParts,
} from "./index";

describe("message fingerprint contract", () => {
  it("normalizes Unicode compatibility and whitespace deterministically", async () => {
    expect(normalizeMessageText("  Ａ\n\t北京  ")).toBe("A 北京");
    await expect(fingerprintMessageText("Ａ\n北京")).resolves.toBe(
      await fingerprintMessageText("A 北京"),
    );
  });

  it("fingerprints only text message parts", () => {
    expect(
      textFromMessageParts([
        { type: "text", text: "Hello" },
        { type: "file", text: "ignored" },
        { type: "text", text: "world" },
      ]),
    ).toBe("Hello\nworld");
  });
});
