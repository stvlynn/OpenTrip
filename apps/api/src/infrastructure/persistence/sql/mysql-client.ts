import mysql from "mysql2/promise";
import type {
  Connection as MysqlConnection,
  Pool as MysqlPool,
  PoolOptions,
  QueryResult as MysqlQueryResult,
  ResultSetHeader,
  SslOptions,
} from "mysql2/promise";
import type { DatabaseSslMode } from "../../config";
import { toMysqlPlaceholders } from "./placeholders";
import type { QueryResult, SqlClient, SqlConnection } from "./types";

export interface MysqlClientOptions {
  max?: number;
  ssl?: DatabaseSslMode;
}

function mapResult<T>(result: MysqlQueryResult): QueryResult<T> {
  if (Array.isArray(result)) {
    return {
      rows: result as T[],
      rowCount: result.length,
    };
  }
  const header = result as ResultSetHeader;
  return {
    rows: [] as T[],
    rowCount: header.affectedRows ?? 0,
  };
}

function normalizeParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p instanceof Date) return p;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p;
  });
}

/**
 * Build mysql2 `ssl` option.
 * Explicit `DATABASE_SSL=off` always wins (hosts that reject TLS).
 */
export function resolveMysqlSsl(
  _connectionString: string,
  mode: DatabaseSslMode = "off",
): SslOptions | undefined {
  if (mode === "off") return undefined;
  if (mode === "required") {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

/** Parse mysql:// URL into explicit fields (more reliable on Workers than `uri`). */
export function parseMysqlConnectionString(connectionString: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const u = new URL(connectionString);
  if (!u.hostname) {
    throw new Error("DATABASE_URL is missing a host");
  }
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")).trim();
  if (!database) {
    throw new Error(
      "DATABASE_URL must include a database path, e.g. mysql://user:pass@host:3306/opentrip",
    );
  }
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
  };
}

function connectionConfig(
  connectionString: string,
  options?: MysqlClientOptions,
): mysql.ConnectionOptions {
  const parsed = parseMysqlConnectionString(connectionString);
  const mode = options?.ssl ?? "off";
  const ssl = resolveMysqlSsl(connectionString, mode);
  return {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    // Workers: short-lived TCP; avoid keep-alive quirks with frozen isolates.
    enableKeepAlive: false,
    connectTimeout: 15_000,
    dateStrings: false,
    supportBigNumbers: true,
    ...(ssl ? { ssl } : {}),
  };
}

function poolConfig(
  connectionString: string,
  options?: MysqlClientOptions,
): PoolOptions {
  const max = options?.max ?? 1;
  return {
    ...connectionConfig(connectionString, options),
    connectionLimit: max,
    maxIdle: 0,
    idleTimeout: 1_000,
    waitForConnections: true,
    queueLimit: 10,
    enableKeepAlive: false,
  };
}

async function withConnection<T>(
  connectionString: string,
  options: MysqlClientOptions | undefined,
  fn: (conn: MysqlConnection) => Promise<T>,
): Promise<T> {
  const conn = await mysql.createConnection(
    connectionConfig(connectionString, options),
  );
  try {
    return await fn(conn);
  } finally {
    try {
      await conn.end();
    } catch {
      // ignore close errors
    }
  }
}

/**
 * SqlClient for MySQL.
 * Uses a short-lived connection per query by default (Workers-safe). When
 * `max > 1` a classic pool is used (Node long-running servers).
 */
export function createMysqlClient(
  connectionString: string,
  options?: MysqlClientOptions,
): SqlClient {
  const max = options?.max ?? 1;
  // Node/local: allow a small pool. Workers pass max=1 and we still use
  // per-query connections to avoid "connection is in closed state".
  const useEphemeral = max <= 1;

  if (useEphemeral) {
    return {
      provider: "mysql",
      async query<T = Record<string, unknown>>(
        text: string,
        params: unknown[] = [],
      ): Promise<QueryResult<T>> {
        const sql = toMysqlPlaceholders(text);
        return withConnection(connectionString, options, async (conn) => {
          const [result] = await conn.query(sql, normalizeParams(params));
          return mapResult<T>(result);
        });
      },
      async connect(): Promise<SqlConnection> {
        const conn = await mysql.createConnection(
          connectionConfig(connectionString, options),
        );
        return {
          async query<T = Record<string, unknown>>(
            text: string,
            params: unknown[] = [],
          ): Promise<QueryResult<T>> {
            const sql = toMysqlPlaceholders(text);
            const [result] = await conn.query(sql, normalizeParams(params));
            return mapResult<T>(result);
          },
          release() {
            void conn.end().catch(() => {});
          },
        };
      },
      async end() {
        // Ephemeral client has nothing long-lived to close.
      },
    };
  }

  const pool = mysql.createPool(poolConfig(connectionString, options));
  return {
    provider: "mysql",
    async query<T = Record<string, unknown>>(
      text: string,
      params: unknown[] = [],
    ): Promise<QueryResult<T>> {
      const sql = toMysqlPlaceholders(text);
      const [result] = await pool.query(sql, normalizeParams(params));
      return mapResult<T>(result);
    },
    async connect(): Promise<SqlConnection> {
      const conn = await pool.getConnection();
      return {
        async query<T = Record<string, unknown>>(
          text: string,
          params: unknown[] = [],
        ): Promise<QueryResult<T>> {
          const sql = toMysqlPlaceholders(text);
          const [result] = await conn.query(sql, normalizeParams(params));
          return mapResult<T>(result);
        },
        release() {
          conn.release();
        },
      };
    },
    async end() {
      await pool.end();
    },
  };
}

/**
 * Pool-shaped handle for Better Auth / Kysely MysqlDialect.
 * On Workers (max<=1) each acquire opens a fresh TCP connection and release()
 * ends it — avoids "connection is in closed state" after isolate freezes.
 */
export function createRawMysqlPool(
  connectionString: string,
  options?: MysqlClientOptions,
): MysqlPool {
  const max = options?.max ?? 1;
  if (max > 1) {
    return mysql.createPool(poolConfig(connectionString, options));
  }

  const config = connectionConfig(connectionString, options);

  // Minimal Pool surface used by Kysely / better-auth.
  const ephemeral = {
    async getConnection() {
      const conn = await mysql.createConnection(config);
      // PoolConnection API: release() returns the connection to the pool.
      // For ephemeral use, release closes the socket.
      const wrapped = conn as MysqlConnection & {
        release: () => void;
        destroy: () => void;
      };
      wrapped.release = () => {
        void conn.end().catch(() => {});
      };
      wrapped.destroy = () => {
        conn.destroy();
      };
      return wrapped;
    },
    async query(sql: string, params?: unknown[]) {
      const conn = await mysql.createConnection(config);
      try {
        return await conn.query(sql, params as never);
      } finally {
        await conn.end().catch(() => {});
      }
    },
    async execute(sql: string, params?: unknown[]) {
      const conn = await mysql.createConnection(config);
      try {
        return await conn.execute(sql, params as never);
      } finally {
        await conn.end().catch(() => {});
      }
    },
    async end() {
      // nothing long-lived
    },
    on() {
      return ephemeral;
    },
    once() {
      return ephemeral;
    },
    removeListener() {
      return ephemeral;
    },
  };

  return ephemeral as unknown as MysqlPool;
}
