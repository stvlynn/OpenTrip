import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logger,
  registerAiTelemetry,
  sanitizeSpan,
  sanitizeTelemetryValue,
} from "../src/infrastructure/observability";
import { buildAgentTelemetryOptions } from "../src/infrastructure/ai/agent-model.ai-sdk";
import { initiatingAgentTurnId } from "../src/application/agent/agent-service";

afterEach(() => vi.restoreAllMocks());

describe("observability sanitization", () => {
  it("redacts credentials, signed queries, database URLs, and binary content", () => {
    const value = sanitizeTelemetryValue({
      authorization: "Bearer secret",
      nested: {
        password: "secret",
        url: "https://files.example.test/a.png?signature=secret#fragment",
        database: "postgres://user:password@example.test/db",
        binary: `data:image/png;base64,${"a".repeat(600)}`,
      },
      text: "Trip to Kyoto remains visible",
      serialized: JSON.stringify({ apiKey: "secret", note: "visible" }),
    });

    expect(value).toEqual({
      authorization: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        url: "https://files.example.test/a.png",
        database: "[DATABASE URL REDACTED]",
        binary: "[BINARY REDACTED]",
      },
      text: "Trip to Kyoto remains visible",
      serialized: JSON.stringify({ apiKey: "[REDACTED]", note: "visible" }),
    });
  });

  it("sanitizes Sentry span data without changing its identity", () => {
    const span = {
      trace_id: "trace",
      span_id: "span",
      data: { cookie: "session=secret", safe: "kept" },
    };
    expect(sanitizeSpan(span)).toEqual({
      trace_id: "trace",
      span_id: "span",
      data: { cookie: "[REDACTED]", safe: "kept" },
    });
  });

  it("writes one-line structured JSON logs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logger.info("agent.test", {
      runtime: "node",
      requestId: "request-123",
      password: "secret",
    });
    const payload = JSON.parse(String(info.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      level: "info",
      event: "agent.test",
      runtime: "node",
      requestId: "request-123",
      password: "[REDACTED]",
    });
  });
});

describe("agent telemetry correlation", () => {
  it("registers AI telemetry idempotently", () => {
    expect(() => {
      registerAiTelemetry();
      registerAiTelemetry();
    }).not.toThrow();
  });

  it("configures stable AI function ids and the content switch", () => {
    expect(buildAgentTelemetryOptions("agent.chat", true)).toEqual({
      functionId: "agent.chat",
      recordInputs: true,
      recordOutputs: true,
    });
    expect(buildAgentTelemetryOptions("agent.operation_evaluation", false)).toEqual({
      functionId: "agent.operation_evaluation",
      recordInputs: false,
      recordOutputs: false,
    });
  });

  it("keeps the initiating user message id across approval continuation", () => {
    expect(
      initiatingAgentTurnId([
        { id: "older-user", role: "user", parts: [] },
        { id: "older-assistant", role: "assistant", parts: [] },
        { id: "user-turn-1", role: "user", parts: [] },
        { id: "assistant-1", role: "assistant", parts: [] },
      ]),
    ).toBe("user-turn-1");
  });
});
