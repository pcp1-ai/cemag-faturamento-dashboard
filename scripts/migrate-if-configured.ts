import { spawnSync } from "node:child_process";
import { getDatabaseMigrationState } from "../server/dbConfig";

const state = getDatabaseMigrationState();

if (state === "skip") {
  console.log("[Database] No database connected; skipping schema migrations.");
} else if (state === "invalid") {
  throw new Error("Incomplete TiDB credentials. Check the Vercel database integration settings.");
} else {
  const isWindows = process.platform === "win32";
  const result = spawnSync(
    isWindows ? "drizzle-kit.cmd" : "drizzle-kit",
    ["migrate"],
    { stdio: "inherit", shell: isWindows },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
