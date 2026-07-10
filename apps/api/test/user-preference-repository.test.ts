import { describe, expect, it, vi } from "vitest";
import { SqlUserPreferenceRepository } from "../src/infrastructure/persistence/user-preference-repository.db";
import type { SqlClient } from "../src/infrastructure/persistence/sql";

/**
 * Preference updates must return the written snapshot without a post-write
 * SELECT — Hyperdrive can serve a stale cached row for the same query shape.
 */
describe("SqlUserPreferenceRepository write responses", () => {
  function createRepo(initialRow: {
    planner_sidebar_width: number;
    planner_sidebar_collapsed: boolean;
    agent_panel_collapsed: boolean;
  }) {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = {
      provider: "postgres" as const,
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (/^\s*SELECT/i.test(sql)) {
          return {
            rows: [
              {
                ...initialRow,
                updated_at: new Date("2026-01-01T00:00:00.000Z"),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => {
        throw new Error("connect not used in this test");
      }),
      end: vi.fn(async () => undefined),
    } as unknown as SqlClient;
    return { repo: new SqlUserPreferenceRepository(db), queries, db };
  }

  it("updateAgentPanel returns the written collapsed flag without re-SELECT", async () => {
    const { repo, queries } = createRepo({
      planner_sidebar_width: 30,
      planner_sidebar_collapsed: false,
      // Cached / prior read still says collapsed — the bug we must not echo.
      agent_panel_collapsed: true,
    });

    const result = await repo.updateAgentPanel("user-1", false);

    expect(result.agentPanelCollapsed).toBe(false);
    expect(result.plannerSidebar).toEqual({ width: 30, collapsed: false });

    const selects = queries.filter((q) => /^\s*SELECT/i.test(q.sql));
    const upserts = queries.filter((q) => /^\s*INSERT/i.test(q.sql));
    expect(selects).toHaveLength(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.params).toEqual(["user-1", 30, false, false]);
  });

  it("updatePlannerSidebar returns the written sidebar without re-SELECT", async () => {
    const { repo, queries } = createRepo({
      planner_sidebar_width: 30,
      planner_sidebar_collapsed: false,
      agent_panel_collapsed: false,
    });

    const result = await repo.updatePlannerSidebar("user-1", 42, true);

    expect(result.plannerSidebar).toEqual({ width: 42, collapsed: true });
    expect(result.agentPanelCollapsed).toBe(false);

    const selects = queries.filter((q) => /^\s*SELECT/i.test(q.sql));
    const upserts = queries.filter((q) => /^\s*INSERT/i.test(q.sql));
    expect(selects).toHaveLength(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.params).toEqual(["user-1", 42, true, false]);
  });
});
