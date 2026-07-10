import type {
  PlannerSidebarPreference,
  UserPreferenceSnapshot,
} from "../../domain/preferences/types";
import type { UserPreferenceRepository } from "../../domain/preferences/ports";
import { createDialect, type SqlClient } from "./sql";

const DEFAULT_PREFERENCE: PlannerSidebarPreference = {
  width: 30,
  collapsed: false,
};

const DEFAULT_AGENT_PANEL_COLLAPSED = true;

interface PreferenceRow {
  planner_sidebar_width: number | string;
  planner_sidebar_collapsed: boolean | number;
  agent_panel_collapsed: boolean | number;
  updated_at: Date | string;
}

function toSnapshot(userId: string, row: PreferenceRow): UserPreferenceSnapshot {
  return {
    userId,
    plannerSidebar: {
      width: Number(row.planner_sidebar_width),
      collapsed: Boolean(row.planner_sidebar_collapsed),
    },
    agentPanelCollapsed: Boolean(row.agent_panel_collapsed),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Dialect-agnostic per-user UI preferences repository.
 *
 * Update methods return the written snapshot — they must not re-SELECT after
 * UPSERT. Hyperdrive caches eligible SELECTs and does not invalidate them on
 * write, so a post-write findByUserId can return a stale row for up to
 * max_age (default 60s) and break read-after-write for the mutation response.
 */
export class SqlUserPreferenceRepository implements UserPreferenceRepository {
  private dialect;

  constructor(private db: SqlClient) {
    this.dialect = createDialect(db.provider);
  }

  async findByUserId(userId: string): Promise<UserPreferenceSnapshot> {
    const { rows } = await this.db.query<PreferenceRow>(
      `SELECT planner_sidebar_width, planner_sidebar_collapsed, agent_panel_collapsed, updated_at
       FROM user_preferences
       WHERE user_id = $1`,
      [userId],
    );

    const row = rows[0];
    if (!row) {
      return {
        userId,
        plannerSidebar: { ...DEFAULT_PREFERENCE },
        agentPanelCollapsed: DEFAULT_AGENT_PANEL_COLLAPSED,
        updatedAt: new Date(),
      };
    }

    return toSnapshot(userId, row);
  }

  async updatePlannerSidebar(
    userId: string,
    width: number,
    collapsed: boolean,
  ): Promise<UserPreferenceSnapshot> {
    const current = await this.findByUserId(userId);
    const updatedAt = new Date();
    const now = this.dialect.now;
    const sql = this.dialect.upsert(
      "user_preferences",
      "user_id, planner_sidebar_width, planner_sidebar_collapsed, agent_panel_collapsed, updated_at",
      `$1, $2, $3, $4, ${now}`,
      "user_id",
      `planner_sidebar_width = EXCLUDED.planner_sidebar_width,
         planner_sidebar_collapsed = EXCLUDED.planner_sidebar_collapsed,
         updated_at = EXCLUDED.updated_at`,
    );
    await this.db.query(sql, [
      userId,
      width,
      collapsed,
      current.agentPanelCollapsed,
    ]);
    return {
      userId,
      plannerSidebar: { width, collapsed },
      agentPanelCollapsed: current.agentPanelCollapsed,
      updatedAt,
    };
  }

  async updateAgentPanel(
    userId: string,
    collapsed: boolean,
  ): Promise<UserPreferenceSnapshot> {
    const current = await this.findByUserId(userId);
    const updatedAt = new Date();
    const now = this.dialect.now;
    const sql = this.dialect.upsert(
      "user_preferences",
      "user_id, planner_sidebar_width, planner_sidebar_collapsed, agent_panel_collapsed, updated_at",
      `$1, $2, $3, $4, ${now}`,
      "user_id",
      `agent_panel_collapsed = EXCLUDED.agent_panel_collapsed,
         updated_at = EXCLUDED.updated_at`,
    );
    await this.db.query(sql, [
      userId,
      current.plannerSidebar.width,
      current.plannerSidebar.collapsed,
      collapsed,
    ]);
    return {
      userId,
      plannerSidebar: current.plannerSidebar,
      agentPanelCollapsed: collapsed,
      updatedAt,
    };
  }
}

/** @deprecated Use SqlUserPreferenceRepository */
export { SqlUserPreferenceRepository as PgUserPreferenceRepository };
