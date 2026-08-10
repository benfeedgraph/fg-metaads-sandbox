import express from "express";
import { config } from "./config.js";
import { graphRouter, metaNotFoundHandler } from "./api/graph.js";
import { devRouter } from "./api/dev.js";
import { closeDb, getDb, getStats, isSeeded } from "./db/store.js";
import { seedDatabase } from "./generator/seed.js";

async function bootstrap(): Promise<void> {
  getDb();
  if (!isSeeded()) {
    console.log("[sandbox] No data found — running seed...");
    await seedDatabase(false);
  }

  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Primary surface: behaves like graph.facebook.com
  app.use(graphRouter);

  // Non-Meta helpers for FeedGraph developers only
  if (config.devRoutes) {
    app.use("/_dev", devRouter);
  }

  app.use(metaNotFoundHandler);

  const server = app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Meta Commerce + Ads Sandbox (graph.facebook.com)             ║
╠══════════════════════════════════════════════════════════════╣
║  Base URL:    http://localhost:${config.port}
║  Graph:       /${config.apiVersion}/… (Marketing + Catalog)
║  Ad account:  ${config.adAccountId} (${config.accountName})
║  Catalog:     ${config.catalogId}
║  Stats:       ${JSON.stringify(getStats())}
║  Console UI:  http://localhost:${config.port}/_dev/ui
║  Dev API:     ${config.devRoutes ? `http://localhost:${config.port}/_dev` : "disabled"}
╚══════════════════════════════════════════════════════════════╝
`);
  });

  const shutdown = () => {
    server.close();
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  console.error("[sandbox] Failed to start:", err);
  closeDb();
  process.exit(1);
});
