import { describe, expect, it } from "vitest";
import type { AgentHistory, AgentMessage } from "@/shared/api";
import { appendAgentMessageToHistory } from "./useAgentChat";

function msg(id: string, text: string): AgentMessage {
  return {
    id,
    seq: 1,
    role: "user",
    parts: [{ type: "text", text }],
    actorUserId: "u1",
    actorName: "Ada",
    source: "chat",
    mentionedUserIds: [],
    createdAt: "2026-07-11T00:00:00.000Z",
  };
}

describe("appendAgentMessageToHistory", () => {
  it("creates history when cache is empty", () => {
    const message = msg("am1", "hello");
    expect(appendAgentMessageToHistory(undefined, message)).toEqual({
      messages: [message],
      suggestions: [],
    });
  });

  it("appends a new message", () => {
    const existing = msg("am0", "prior");
    const next = msg("am1", "hello");
    const old: AgentHistory = { messages: [existing], suggestions: [] };
    expect(appendAgentMessageToHistory(old, next).messages.map((m) => m.id)).toEqual([
      "am0",
      "am1",
    ]);
  });

  it("is idempotent for the same message id", () => {
    const message = msg("am1", "hello");
    const old: AgentHistory = { messages: [message], suggestions: [] };
    expect(appendAgentMessageToHistory(old, message)).toBe(old);
  });
});
