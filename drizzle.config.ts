import { defineConfig } from "drizzle-kit";
import { getMySqlConnectionConfig } from "./server/dbConfig";

const connection = getMySqlConnectionConfig();
if (!connection) {
  throw new Error("Configure DATABASE_URL or all TiDB connection variables before running Drizzle commands");
}

const dbCredentials = typeof connection === "string"
  ? { url: connection }
  : {
      host: connection.host!,
      port: connection.port,
      user: connection.user!,
      password: connection.password!,
      database: connection.database!,
      ...(connection.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    };

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials,
});
