import type { PoolOptions } from "mysql2";

type DatabaseEnvironment = Partial<Record<
  | "DATABASE_URL"
  | "TIDB_HOST"
  | "TIDB_PORT"
  | "TIDB_USER"
  | "TIDB_PASSWORD"
  | "TIDB_DATABASE"
  | "TIDB_DB_NAME"
  | "TIDB_ENABLE_SSL",
  string
>>;

/** Resolve the database configuration provided either directly or by TiDB's Vercel integration. */
export function getMySqlConnectionConfig(
  env: DatabaseEnvironment = process.env,
): string | PoolOptions | null {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const { TIDB_HOST: host, TIDB_USER: user, TIDB_PASSWORD: password } = env;
  const database = env.TIDB_DATABASE || env.TIDB_DB_NAME;
  if (!host || !user || password === undefined || !database) return null;

  const connection: PoolOptions = {
    host,
    port: Number(env.TIDB_PORT || 4000),
    user,
    password,
    database,
    connectionLimit: 1,
    maxIdle: 1,
    enableKeepAlive: true,
  };

  // TiDB Cloud requires TLS; keep it enabled by default when the integration
  // does not inject TIDB_ENABLE_SSL (it provides only the five connection vars).
  if (env.TIDB_ENABLE_SSL !== "false") {
    connection.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: true };
  }

  return connection;
}
