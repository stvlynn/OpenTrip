import { describe, expect, it } from "vitest";
import { pipeJsonRender } from "@json-render/core";

interface Chunk {
  type: string;
  id?: string;
  delta?: string;
  toolCallId?: string;
  toolName?: string;
  [key: string]: unknown;
}

async function collect(stream: ReadableStream<Chunk>): Promise<Chunk[]> {
  const reader = stream.getReader();
  const chunks: Chunk[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) return chunks;
    chunks.push(result.value);
  }
}

describe("json-render AI SDK stream transform", () => {
  it("emits data-spec patches and preserves non-text chunks", async () => {
    const input: Chunk[] = [
      { type: "text-start", id: "text-1" },
      {
        type: "text-delta",
        id: "text-1",
        delta:
          "Draft options:\n```spec\n" +
          '{"op":"add","path":"/root","value":"main"}\n' +
          "```",
      },
      { type: "text-end", id: "text-1" },
      {
        type: "tool-input-start",
        toolCallId: "tool-1",
        toolName: "insertStop",
      },
    ];
    const source = new ReadableStream<Chunk>({
      start(controller) {
        for (const chunk of input) controller.enqueue(chunk);
        controller.close();
      },
    });

    const output = await collect(pipeJsonRender(source));
    expect(output).toContainEqual({
      type: "data-spec",
      data: {
        type: "patch",
        patch: { op: "add", path: "/root", value: "main" },
      },
    });
    expect(output).toContainEqual(input[3]);
    expect(
      output
        .filter((chunk) => chunk.type === "text-delta")
        .map((chunk) => chunk.delta)
        .join(""),
    ).toContain("Draft options");
  });
});
