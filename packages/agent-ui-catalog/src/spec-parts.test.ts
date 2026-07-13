import { describe, expect, it } from "vitest";
import {
  agentUiModelContext,
  isAgentUiPart,
  specFromAgentUiParts,
  safeAgentUiSpec,
  validatedAgentUiSpec,
} from "./spec-parts";

const validParts = [
  {
    type: "data-spec",
    data: {
      type: "flat",
      spec: {
        root: "text-1",
        elements: {
          "text-1": {
            type: "Text",
            props: { content: "Walk to the station", variant: "body" },
            children: [],
          },
        },
      },
    },
  },
] as const;

describe("agent UI spec parts", () => {
  it("recognizes and compiles a valid data-spec part", () => {
    expect(isAgentUiPart(validParts[0])).toBe(true);
    expect(specFromAgentUiParts(validParts)?.root).toBe("text-1");
    expect(validatedAgentUiSpec(validParts)?.elements["text-1"]?.type).toBe(
      "Text",
    );
  });

  it("rejects unknown components at the catalog boundary", () => {
    const parts = structuredClone(validParts) as unknown as Array<{
      type: string;
      data: { type: "flat"; spec: { root: string; elements: Record<string, unknown> } };
    }>;
    parts[0]!.data.spec.elements["text-1"] = {
      type: "Script",
      props: { source: "alert(1)" },
      children: [],
    };
    expect(validatedAgentUiSpec(parts)).toBeNull();
  });

  it("produces bounded model context", () => {
    const context = agentUiModelContext(validParts, 40);
    expect(context).toHaveLength(41);
    expect(context?.endsWith("…")).toBe(true);
  });

  it("allows only validated, user-triggered catalog actions", () => {
    const base = {
      root: "button",
      elements: {
        button: {
          type: "ActionButton",
          props: { label: "Use this plan", variant: "primary" },
          children: [],
          on: {
            press: {
              action: "sendAgentFollowUp",
              params: { message: "Please write this plan to the trip" },
            },
          },
        },
      },
    };
    expect(safeAgentUiSpec(base)?.root).toBe("button");
    expect(
      safeAgentUiSpec({
        ...base,
        elements: {
          button: {
            ...base.elements.button,
            on: { press: { action: "navigate", params: { url: "https://x" } } },
          },
        },
      }),
    ).toBeNull();
  });

  it("rejects automatic watchers and keeps partial children renderable", () => {
    expect(
      safeAgentUiSpec({
        root: "button",
        elements: {
          button: {
            type: "ActionButton",
            props: { label: "Confirm" },
            children: [],
            watch: {
              "/ready": {
                action: "sendAgentFollowUp",
                params: { message: "Confirm" },
              },
            },
          },
        },
      }),
    ).toBeNull();

    const partial = safeAgentUiSpec({
      root: "card",
      elements: {
        card: {
          type: "Card",
          props: { title: "Draft" },
          children: ["not-streamed-yet"],
        },
      },
    });
    expect(partial?.elements.card?.children).toEqual([]);
  });

  it("accepts bounded street-view cards and open actions", () => {
    const spec = {
      root: "stack",
      elements: {
        stack: { type: "Stack", props: {}, children: ["view", "open"] },
        view: {
          type: "StreetViewCard",
          props: { imageId: "123456", placeLabel: "Temple gate" },
          children: [],
        },
        open: {
          type: "ActionButton",
          props: { label: "Open street view" },
          children: [],
          on: { press: { action: "openStreetView", params: { imageId: "123456" } } },
        },
      },
    };
    expect(safeAgentUiSpec(spec)?.elements.view?.type).toBe("StreetViewCard");
    const sanitized = safeAgentUiSpec({
        ...spec,
        elements: {
          ...spec.elements,
          open: {
            ...spec.elements.open,
            on: { press: { action: "openStreetView", params: { imageId: "../token" } } },
          },
        },
      });
    expect(sanitized?.elements.open).toBeUndefined();
    expect(sanitized?.elements.stack?.children).toEqual(["view"]);
  });
});
