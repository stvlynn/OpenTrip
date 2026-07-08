import type { Pool } from "pg";
import type {
  PlannerSidebarPreference,
  UserPreferenceSnapshot,
} from "../../domain/preferences/types";
import type { UserPreferenceRepository } from "../../domain/preferences/ports";

const DEFAULT_PREFERENCE: PlannerSidebarPreference = {
  width: 30,
  collapsed: false,
};

const DEFAULT_AGENT_PANEL_COLLAPSED = true;

interface PreferenceRow {
  planner_sidebar_width: number;
  planner_sidebar_collapsed: boolean;
  agent_panel_collapsed: boolean;
  updated_at: Date;
}

function toSnapshot(userId: string, row: PreferenceRow): UserPreferenceSnapshot {
  return {
    userId,
    plannerSidebar: {
      width: Number(row.planner_sidebar_width),
      collapsed: row.planner_sidebar_collapsed,
    },
    agentPanelCollapsed: row.agent_panel_collapsed,
    updatedAt: row.updated_at,
  };
}

/** PostgreSQL adapter for per-user UI preferences. */
export class PgUserPreferenceRepository implements UserPreferenceRepository {
  constructor(private pool: Pool) {}

  async findByUserId(userId: string): Promise<UserPreferenceSnapshot> {
    const { rows } = await this.pool.query<PreferenceRow>(
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
    const { rows } = await this.pool.query<PreferenceRow>(
      `INSERT INTO user_preferences (user_id, planner_sidebar_width, planner_sidebar_collapsed, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         planner_sidebar_width = EXCLUDED.planner_sidebar_width,
         planner_sidebar_collapsed = EXCLUDED.planner_sidebar_collapsed,
         updated_at = EXCLUDED.updated_at
       RETURNING planner_sidebar_width, planner_sidebar_collapsed, agent_panel_collapsed, updated_at`,
      [userId, width, collapsed],
    );

    return toSnapshot(userId, rows[0]!);
  }

  async updateAgentPanel(
    userId: string,
    collapsed: boolean,
  ): Promise<UserPreferenceSnapshot> {
    const { rows } = await this.pool.query<PreferenceRow>(
      `INSERT INTO user_preferences (user_id, agent_panel_collapsed, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         agent_panel_collapsed = EXCLUDED.agent_panel_collapsed,
         updated_at = EXCLUDED.updated_at
       RETURNING planner_sidebar_width, planner_sidebar_collapsed, agent_panel_collapsed, updated_at`,
      [userId, collapsed],
    );

    return toSnapshot(userId, rows[0]!);
  }
}
