import {
  applySpecPatch,
  nestedToFlat,
  SPEC_DATA_PART_TYPE,
  validateSpec,
  type ActionBinding,
  type Spec,
  type SpecDataPart,
} from "@json-render/core";
import { agentUiCatalog } from "./catalog";

export interface MessagePartLike {
  type: string;
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSpecDataPartPayload(value: unknown): value is SpecDataPart {
  if (!isRecord(value)) return false;
  if (value.type === "patch") return isRecord(value.patch);
  if (value.type === "flat" || value.type === "nested") {
    return isRecord(value.spec);
  }
  return false;
}

export function isAgentUiPart(part: MessagePartLike): boolean {
  return part.type === SPEC_DATA_PART_TYPE && isSpecDataPartPayload(part.data);
}

export function specFromAgentUiParts(parts: readonly MessagePartLike[]): Spec | null {
  const spec: Spec = { root: "", elements: {} };
  let found = false;

  for (const part of parts.slice(0, 240)) {
    if (
      part.type !== SPEC_DATA_PART_TYPE ||
      !isSpecDataPartPayload(part.data)
    ) {
      continue;
    }
    const payload = part.data;
    try {
      if (payload.type === "patch") {
        applySpecPatch(spec, payload.patch);
      } else if (payload.type === "flat") {
        Object.assign(spec, payload.spec);
      } else {
        Object.assign(spec, nestedToFlat(payload.spec));
      }
      found = true;
    } catch {
      // Ignore malformed patches; callers can still render accompanying text.
    }
  }

  return found ? spec : null;
}

export function validatedAgentUiSpec(
  parts: readonly MessagePartLike[],
): Spec | null {
  const spec = specFromAgentUiParts(parts);
  return spec ? safeAgentUiSpec(spec) : null;
}

const componentDefinitions = agentUiCatalog.data.components as Record<
  string,
  { props: { safeParse: (value: unknown) => { success: boolean; data?: unknown } } }
>;

/** Return an allowlisted, size-bounded spec. Missing streamed children are
 * omitted until their patches arrive, so safe elements can render progressively. */
export function safeAgentUiSpec(spec: Spec): Spec | null {
  if (Object.keys(spec.elements).length > 80) return null;
  if (JSON.stringify(spec).length > 64_000) return null;
  if (!spec.root || typeof spec.root !== "string") return null;

  const safeElements: Spec["elements"] = {};
  for (const [key, element] of Object.entries(spec.elements)) {
    if (element.watch || element.repeat) continue;
    if (element.visible !== undefined && typeof element.visible !== "boolean") {
      continue;
    }
    if (!safeElementActions(element.type, element.on)) continue;
    const definition = componentDefinitions[element.type];
    const parsed = definition?.props.safeParse(element.props);
    if (!parsed?.success) continue;
    safeElements[key] = {
      type: element.type,
      props: parsed.data as Record<string, unknown>,
      children: element.children ?? [],
      ...(element.visible === undefined ? {} : { visible: element.visible }),
      ...(element.on === undefined ? {} : { on: element.on }),
    };
  }

  if (!safeElements[spec.root]) return null;
  for (const element of Object.values(safeElements)) {
    element.children = (element.children ?? []).filter(
      (child) => safeElements[child] !== undefined,
    );
  }

  const safeSpec: Spec = { root: spec.root, elements: safeElements };
  return validateSpec(safeSpec).valid ? safeSpec : null;
}

const actionDefinitions = agentUiCatalog.data.actions as Record<
  string,
  { params?: { safeParse: (value: unknown) => { success: boolean } } }
>;

function safeElementActions(
  componentType: string,
  events: Record<string, ActionBinding | ActionBinding[]> | undefined,
): boolean {
  if (!events) return true;
  if (componentType !== "ActionButton") return false;
  if (Object.keys(events).some((event) => event !== "press")) return false;

  const bindings = Object.values(events).flatMap((binding) =>
    Array.isArray(binding) ? binding : [binding],
  );
  return bindings.every((binding) => {
    if (binding.confirm || binding.onSuccess || binding.onError) return false;
    const definition = actionDefinitions[binding.action];
    if (!definition) return false;
    return definition.params?.safeParse(binding.params ?? {}).success === true;
  });
}

export function agentUiModelContext(
  parts: readonly MessagePartLike[],
  maxChars = 8_000,
): string | null {
  const spec = validatedAgentUiSpec(parts);
  if (!spec) return null;
  const serialized = JSON.stringify(spec);
  return serialized.length <= maxChars
    ? serialized
    : `${serialized.slice(0, maxChars)}…`;
}
