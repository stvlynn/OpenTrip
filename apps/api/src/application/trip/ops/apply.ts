import type { PendingPatch } from "../../../domain/agent";
import {
  createTripChange,
  type TripChangeScope,
} from "../../../domain/realtime";
import { getTripOp, type TripOpContext } from "./catalog";

export type TripOpApplyResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

/**
 * Apply a PendingPatch through the trip ops catalog (domain + repository).
 * Used by agent tool execute and proactive suggestion approve.
 */
export async function applyTripOp(
  ctx: TripOpContext,
  patch: PendingPatch,
): Promise<TripOpApplyResult> {
  const op = getTripOp(patch.kind);
  if (!op) {
    return { ok: false, error: `Unknown trip operation: ${patch.kind}` };
  }
  try {
    // Catalog apply is typed per-kind; patch is the matching branch at runtime.
    const summary = await (op.apply as (
      c: TripOpContext,
      p: PendingPatch,
    ) => Promise<string>)(ctx, patch);
    if (ctx.tripChangePublisher) {
      const snapshot = ctx.trip.toSnapshot();
      try {
        await ctx.tripChangePublisher.publish(
          createTripChange({
            eventId: crypto.randomUUID(),
            tripId: snapshot.id,
            revision: snapshot.version,
            actorId: ctx.actorUserId,
            occurredAt: new Date().toISOString(),
            scopes: scopesFor(patch.kind),
          }),
        );
      } catch (error) {
        console.error("Failed to publish agent trip change", {
          tripId: snapshot.id,
          revision: snapshot.version,
          error,
        });
      }
    }
    return { ok: true, summary };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to apply trip change";
    return { ok: false, error: message };
  }
}

function scopesFor(kind: PendingPatch["kind"]): TripChangeScope[] {
  switch (kind) {
    case "rename_trip":
      return ["trip"];
    case "add_day":
    case "update_day":
      return ["days"];
    case "delete_day":
    case "reorder_days":
      return ["days", "stops"];
    case "insert_stop":
    case "update_stop":
    case "append_stop_note":
    case "move_stop":
      return ["stops"];
    case "add_expense":
    case "update_expense":
      return ["expenses"];
  }
}
