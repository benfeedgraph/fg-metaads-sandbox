import express from "express";
import { config, publicBaseUrl } from "./config.js";
import { graphRouter, metaNotFoundHandler } from "./api/graph.js";
import { devRouter } from "./api/dev.js";
import { closeDb, getDb, getStats, isSeeded } from "./db/store.js";
import { seedDatabase } from "./generator/seed.js";
import { pilotDataPath, seedPilotCatalog } from "./generator/seed-pilot.js";

async function bootstrap(): Promise<void> {
  getDb();
  if (!isSeeded()) {
    console.log("[sandbox] No data found — running seed...");
    await seedDatabase(false);
    // The synthetic generator produces `shop_<act>_<n>` retailer ids that match nothing in FeedGraph.
    // Deployed containers start empty every boot, so overlay the real pilot catalog here rather than
    // relying on a one-off manual reseed that an ephemeral filesystem would discard.
    if (process.env.SEED_PILOT !== "false" && pilotDataPath()) {
      try {
        const r = seedPilotCatalog();
        console.log(`[sandbox] Pilot catalog seeded: ${r.products} products, ${r.insightRows} insight rows (${r.skus} SKUs).`);
      } catch (err) {
        console.error("[sandbox] Pilot seed failed, keeping synthetic catalog:", (err as Error).message);
      }
    }
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
║  Base URL:    ${publicBaseUrl()}
║  Graph:       /${config.apiVersion}/… (Marketing + Catalog)
║  Ad account:  ${config.adAccountId} (${config.accountName})
║  Catalog:     ${config.catalogId}
║  Stats:       ${JSON.stringify(getStats())}
║  Console UI:  ${publicBaseUrl()}/_dev/ui
║  Dev API:     ${config.devRoutes ? `${publicBaseUrl()}/_dev` : "disabled"}
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
