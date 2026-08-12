import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router, type Request, type Response } from "express";
import { config, publicBaseUrl } from "../config.js";
import { META_GRAPH_API_PATHS, META_GRAPH_DOC_LINKS } from "./graph-paths.js";
import { uiApiRouter } from "./ui-api.js";
import { catalogImageSvgPlaceholder } from "../lib/product-images.js";
import { getOverviewStats, getStats } from "../db/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(__dirname, "../ui");

export const devRouter = Router();

devRouter.use("/ui/api", uiApiRouter);
devRouter.use("/ui", express.static(uiDir));
devRouter.get("/ui", (_req, res) => {
  res.sendFile(path.join(uiDir, "index.html"));
});

devRouter.get("/catalog-image", (req: Request, res: Response) => {
  const id = typeof req.query.id === "string" ? req.query.id : "product";
  const size = Math.max(40, Math.min(800, Number(req.query.size) || 80));
  res.set("Content-Type", "image/svg+xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(catalogImageSvgPlaceholder(id, size));
});

devRouter.get("/", (req, res) => {
  if (req.accepts(["html", "json"]) === "json") {
    const base = publicBaseUrl();
    return res.json({
      name: "FeedGraph Meta Ads Sandbox Simulator",
      mode: "sandbox",
      ui: `${base}/_dev/ui`,
      docs: `${base}/_dev/info`,
      health: `${base}/_dev/health`,
      adAccountId: config.adAccountId,
      catalogId: config.catalogId,
      stats: getStats(),
    });
  }
  res.redirect("/_dev/ui");
});

devRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: "sandbox", version: config.apiVersion });
});

devRouter.get("/info", (_req, res) => {
  const base = publicBaseUrl();
  const v = config.apiVersion;
  const act = config.adAccountId;
  res.json({
    mode: "sandbox",
    apiVersion: v,
    adAccountId: act,
    accountName: config.accountName,
    catalogId: config.catalogId,
    currency: config.currency,
    stats: getOverviewStats(),
    connector: {
      baseUrl: base,
      accessToken: config.accessToken,
      appId: config.appId,
      appSecret: config.appSecret,
      adAccountId: act,
      catalogId: config.catalogId,
    },
    metaGraphApi: {
      host: "graph.facebook.com (live) | localhost (sandbox)",
      documentation: META_GRAPH_DOC_LINKS,
      implementedEndpoints: Object.entries(META_GRAPH_API_PATHS).map(([name, pathTemplate]) => ({
        name,
        path: pathTemplate.replace("{act_XXX}", act).replace("{catalogId}", config.catalogId),
        url: `${base}${pathTemplate.replace("{act_XXX}", act).replace("{catalogId}", config.catalogId).replace("{campaignId}", "{campaignId}")}`,
      })),
    },
  });
});
