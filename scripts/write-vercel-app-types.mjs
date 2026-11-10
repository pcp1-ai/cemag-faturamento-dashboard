import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await writeFile(
  "dist/vercel-app.d.ts",
  'import type { Express } from "express";\nexport declare function createApiApp(app?: Express): Express;\n',
  "utf8",
);
