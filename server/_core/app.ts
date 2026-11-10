import "dotenv/config";
import express from "express";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { refreshExternalFactorsScheduled } from "../scheduledExternalFactors";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";

export function createApiApp(app = express()) {
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  app.post("/api/scheduled/refresh-external-factors", refreshExternalFactorsScheduled);

  const staticDirectory = path.resolve(process.cwd(), "public");
  app.use(express.static(staticDirectory));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(path.join(staticDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });

  return app;
}
