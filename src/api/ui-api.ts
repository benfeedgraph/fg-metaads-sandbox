import { Router } from "express";
import { config } from "../config.js";
import {
  getOverviewStats,
  listAds,
  listAdSets,
  listAudiences,
  listAuditLogs,
  listBusinesses,
  listCampaigns,
  listCatalogProducts,
  listCatalogs,
  listDiagnostics,
  listProductFeeds,
  listProductSets,
} from "../db/store.js";

export const uiApiRouter = Router();

uiApiRouter.get("/overview", (_req, res) => {
  const business = listBusinesses()[0] || null;
  res.json({
    accountId: config.adAccountId,
    accountName: config.accountName,
    catalogId: config.catalogId,
    currency: config.currency,
    business,
    ...getOverviewStats(),
  });
});

uiApiRouter.get("/campaigns", (_req, res) => {
  res.json({ data: listCampaigns(config.adAccountId, 200, 0) });
});

uiApiRouter.get("/adsets", (_req, res) => {
  res.json({ data: listAdSets({ adAccountId: config.adAccountId, limit: 200 }) });
});

uiApiRouter.get("/ads", (_req, res) => {
  res.json({ data: listAds({ adAccountId: config.adAccountId, limit: 200 }) });
});

uiApiRouter.get("/product-sets", (_req, res) => {
  res.json({ data: listProductSets(config.catalogId) });
});

uiApiRouter.get("/feeds", (_req, res) => {
  res.json({ data: listProductFeeds(config.catalogId) });
});

uiApiRouter.get("/diagnostics", (_req, res) => {
  res.json({ data: listDiagnostics(config.catalogId) });
});

uiApiRouter.get("/audiences", (_req, res) => {
  res.json({ data: listAudiences(config.adAccountId) });
});

uiApiRouter.get("/products", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const limit = Math.min(200, Number(req.query.limit) || 50);
  let products = listCatalogProducts(config.catalogId, 800, 0);
  if (q) {
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.retailerId.toLowerCase().includes(q),
    );
  }
  if (status) {
    products = products.filter((p) => p.reviewStatus === status);
  }
  res.json({ data: products.slice(0, limit), catalog: listCatalogs()[0] || null });
});

uiApiRouter.get("/changes", (_req, res) => {
  res.json({ data: listAuditLogs(100) });
});

uiApiRouter.get("/config", (_req, res) => {
  res.json({
    apiVersion: config.apiVersion,
    adAccountId: config.adAccountId,
    catalogId: config.catalogId,
    accessToken: config.accessToken,
    port: config.port,
  });
});
