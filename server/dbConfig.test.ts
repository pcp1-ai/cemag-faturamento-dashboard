import { describe, expect, it } from "vitest";
import { getMySqlConnectionConfig } from "./dbConfig";

describe("getMySqlConnectionConfig", () => {
  it("prefers DATABASE_URL when configured", () => {
    expect(getMySqlConnectionConfig({ DATABASE_URL: "mysql://user:pass@host/db" })).toBe(
      "mysql://user:pass@host/db",
    );
  });

  it("builds a TLS connection from TiDB integration variables", () => {
    expect(getMySqlConnectionConfig({
      TIDB_HOST: "db.example.com",
      TIDB_PORT: "4000",
      TIDB_USER: "app.root",
      TIDB_PASSWORD: "secret",
      TIDB_DATABASE: "cemag",
      TIDB_ENABLE_SSL: "true",
    })).toMatchObject({
      host: "db.example.com",
      port: 4000,
      user: "app.root",
      password: "secret",
      database: "cemag",
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      connectionLimit: 1,
    });
  });

  it("accepts the alternate TiDB database variable name", () => {
    expect(getMySqlConnectionConfig({
      TIDB_HOST: "db.example.com",
      TIDB_USER: "app.root",
      TIDB_PASSWORD: "secret",
      TIDB_DB_NAME: "cemag",
    })).toMatchObject({
      database: "cemag",
      port: 4000,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    });
  });

  it("does not return partial credentials", () => {
    expect(getMySqlConnectionConfig({ TIDB_HOST: "db.example.com" })).toBeNull();
  });
});
