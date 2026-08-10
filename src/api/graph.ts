import { Router, type Request, type Response, type NextFunction } from "express";
import { config, publicBaseUrl } from "../config.js";
import {
  countAdSets,
  countCampaigns,
  countCatalogProducts,
  countProductSetProducts,
  createAd,
  createAdSet,
  createBatchHandle,
  createCampaign,
  createProductSet,
  deleteCatalogProduct,
  deleteProductSet,
  getAd,
  getAdAccount,
  getAdSet,
  getAudience,
  getBusiness,
  getCampaign,
  getCampaignsByIds,
  getCatalog,
  getCreative,
  getProduct,
  getProductByRetailerId,
  getProductFeed,
  getProductSet,
  listAdAccounts,
  listAds,
  listAdSets,
  listAudiences,
  listBusinesses,
  listCampaigns,
  listCatalogProducts,
  listCatalogs,
  listDiagnostics,
  listProductFeeds,
  listProductSetProducts,
  listProductSets,
  nextNumericId,
  queryInsights,
  updateAd,
  updateAdSet,
  updateCampaign,
  updateProductSet,
  upsertCatalogProduct,
  writeAuditLog,
} from "../db/store.js";
import type { Ad, AdSet, Campaign, CatalogProduct, ProductSet } from "../models/types.js";
import { MetaGraphError, handleMetaError, notFoundHandler } from "./meta-errors.js";
import { extractAccessToken, sandboxAuth, validateAppCredentials } from "./middleware.js";
import {
  accountToGraph,
  adSetToGraph,
  adToGraph,
  audienceToGraph,
  businessToGraph,
  campaignToGraph,
  catalogToGraph,
  creativeToGraph,
  diagnosticToGraph,
  feedToGraph,
  insightToGraphRow,
  pickFields,
  productSetToGraph,
  productToGraph,
} from "./graph-serializers.js";

export const graphRouter = Router();

const V = () => config.apiVersion;
function versionPrefix(): string {
  return `/${V()}`;
}

function parseLimit(req: Request, fallback = 25, max = 500): number {
  const n = Number(req.query.limit ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

function parseAfterOffset(after: unknown): number {
  if (typeof after !== "string" || !after.trim()) return 0;
  try {
    const decoded = Buffer.from(after, "base64url").toString("utf8");
    const n = Number(decoded.replace(/^offset:/, ""));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function encodeAfter(offset: number): string {
  return Buffer.from(`offset:${offset}`, "utf8").toString("base64url");
}

function pagingEnvelope(
  req: Request,
  path: string,
  data: unknown[],
  total: number,
  limit: number,
  offset: number,
) {
  const base = `${publicBaseUrl()}${path}`;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "after" || k === "access_token") continue;
    if (typeof v === "string") q.set(k, v);
  }
  const token = extractAccessToken(req);
  if (token) q.set("access_token", token);

  const paging: { cursors: { before?: string; after?: string }; next?: string; previous?: string } = {
    cursors: {},
  };
  if (offset + limit < total) {
    const nextOffset = offset + limit;
    paging.cursors.after = encodeAfter(nextOffset);
    const nq = new URLSearchParams(q);
    nq.set("after", paging.cursors.after);
    nq.set("limit", String(limit));
    paging.next = `${base}?${nq.toString()}`;
  }
  if (offset > 0) {
    const prevOffset = Math.max(0, offset - limit);
    paging.cursors.before = encodeAfter(prevOffset);
    const pq = new URLSearchParams(q);
    pq.set("after", paging.cursors.before);
    pq.set("limit", String(limit));
    paging.previous = `${base}?${pq.toString()}`;
  }
  return { data, paging };
}

function resolveDatePreset(preset: string | undefined): { start?: string; end?: string } {
  const end = new Date();
  end.setUTCHours(12, 0, 0, 0);
  const endStr = end.toISOString().slice(0, 10);
  const p = String(preset || "").toLowerCase();
  if (!p || p === "maximum") return {};
  let days = 7;
  if (p === "last_7d" || p === "last_7_days") days = 7;
  else if (p === "last_14d") days = 14;
  else if (p === "last_28d") days = 28;
  else if (p === "last_30d" || p === "last_30_days") days = 30;
  else if (p === "last_90d" || p === "last_90_days") days = 90;
  else if (p === "yesterday") days = 1;
  else if (p === "today") return { start: endStr, end: endStr };
  else return {};
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: endStr };
}

function asyncRoute(fn: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

function requireAct(objectId: string) {
  if (!objectId.startsWith("act_") || !getAdAccount(objectId)) {
    throw new MetaGraphError(`Unsupported get request. Object with ID '${objectId}' does not exist`, {
      status: 400,
      code: 100,
    });
  }
}

function requireCatalog(catalogId: string) {
  if (!getCatalog(catalogId)) {
    throw new MetaGraphError(`Unsupported get request. Object with ID '${catalogId}' does not exist`, {
      status: 400,
      code: 100,
    });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseStatus(raw: unknown, fallback: "ACTIVE" | "PAUSED" = "PAUSED"): "ACTIVE" | "PAUSED" {
  const s = String(raw || fallback).toUpperCase();
  return s === "ACTIVE" ? "ACTIVE" : "PAUSED";
}

// ── OAuth (unauthenticated) ────────────────────────────────────────────────
graphRouter.get(
  `${versionPrefix()}/oauth/access_token`,
  asyncRoute(async (req, res) => {
    try {
      const grantType = String(req.query.grant_type || "");
      const clientId = String(req.query.client_id || "");
      const clientSecret = String(req.query.client_secret || "");

      if (grantType === "fb_exchange_token") {
        validateAppCredentials(clientId, clientSecret);
        const fbToken = String(req.query.fb_exchange_token || "");
        if (fbToken !== config.accessToken && fbToken !== "sandbox-short-lived-token") {
          throw new MetaGraphError("Invalid OAuth access token.", { status: 400, code: 190 });
        }
        res.json({ access_token: config.accessToken, token_type: "bearer", expires_in: 5184000 });
        return;
      }

      validateAppCredentials(clientId, clientSecret);
      if (!String(req.query.code || "")) {
        throw new MetaGraphError("Missing authorization code", { status: 400, code: 100 });
      }
      res.json({ access_token: config.accessToken, token_type: "bearer", expires_in: 3600 });
    } catch (err) {
      handleMetaError(res, err);
    }
  }),
);

graphRouter.use(versionPrefix(), sandboxAuth);

// ── /me edges ──────────────────────────────────────────────────────────────
graphRouter.get(
  `${versionPrefix()}/me`,
  asyncRoute(async (req, res) => {
    res.json(
      pickFields(
        { id: config.userId, name: config.userName, email: config.userEmail },
        req.query.fields,
      ),
    );
  }),
);

graphRouter.get(
  `${versionPrefix()}/me/businesses`,
  asyncRoute(async (req, res) => {
    const limit = parseLimit(req);
    const offset = parseAfterOffset(req.query.after);
    const all = listBusinesses();
    const slice = all.slice(offset, offset + limit);
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/me/businesses`,
        slice.map((b) => businessToGraph(b, req.query.fields)),
        all.length,
        limit,
        offset,
      ),
    );
  }),
);

graphRouter.get(
  `${versionPrefix()}/me/adaccounts`,
  asyncRoute(async (req, res) => {
    const limit = parseLimit(req, 25, 100);
    const offset = parseAfterOffset(req.query.after);
    const all = listAdAccounts();
    const slice = all.slice(offset, offset + limit);
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/me/adaccounts`,
        slice.map((a) =>
          accountToGraph(a, req.query.fields || "name,account_id,account_status,id"),
        ),
        all.length,
        limit,
        offset,
      ),
    );
  }),
);

graphRouter.get(
  `${versionPrefix()}/me/owned_product_catalogs`,
  asyncRoute(async (req, res) => {
    const limit = parseLimit(req, 25, 100);
    const offset = parseAfterOffset(req.query.after);
    const all = listCatalogs();
    const slice = all.slice(offset, offset + limit);
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/me/owned_product_catalogs`,
        slice.map((c) => catalogToGraph(c, req.query.fields || "id,name")),
        all.length,
        limit,
        offset,
      ),
    );
  }),
);

// Batch node lookup
graphRouter.get(
  versionPrefix(),
  asyncRoute(async (req, res) => {
    const idsRaw = req.query.ids;
    if (typeof idsRaw !== "string" || !idsRaw.trim()) {
      throw new MetaGraphError("(#100) The parameter ids is required", { status: 400, code: 100 });
    }
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const campaigns = getCampaignsByIds(ids);
    const byId = new Map(campaigns.map((c) => [c.id, c]));
    const out: Record<string, unknown> = {};
    for (const id of ids) {
      const c = byId.get(id);
      if (c) {
        out[id] = campaignToGraph(c, req.query.fields || "objective");
        continue;
      }
      const adset = getAdSet(id);
      if (adset) {
        out[id] = adSetToGraph(adset, req.query.fields);
        continue;
      }
      const ad = getAd(id);
      if (ad) {
        out[id] = adToGraph(ad, req.query.fields);
        continue;
      }
      out[id] = {
        error: {
          message: `Unsupported get request. Object with ID '${id}' does not exist`,
          type: "GraphMethodException",
          code: 100,
        },
      };
    }
    res.json(out);
  }),
);

// ── Insights ───────────────────────────────────────────────────────────────
function handleInsights(req: Request, res: Response, objectId: string): void {
  const datePreset = typeof req.query.date_preset === "string" ? req.query.date_preset : undefined;
  const timeRange = resolveDatePreset(datePreset);

  if (typeof req.query.time_range === "string") {
    try {
      const tr = JSON.parse(req.query.time_range) as { since?: string; until?: string };
      if (tr.since) timeRange.start = tr.since;
      if (tr.until) timeRange.end = tr.until;
    } catch {
      /* ignore */
    }
  }

  if (datePreset && (req.query.date_start || req.query.date_end)) {
    throw new MetaGraphError("(#100) date_preset and date_start/date_end cannot be used together", {
      status: 400,
      code: 100,
    });
  }

  const levelRaw = String(req.query.level || "ad").toLowerCase();
  const level =
    levelRaw === "campaign" || levelRaw === "account" || levelRaw === "adset" ? levelRaw : "ad";
  const timeIncrement = String(req.query.time_increment || "all_days") === "1" ? "1" : "all_days";
  const breakdowns = String(req.query.breakdowns || "");
  const productBreakdown = breakdowns.split(",").map((s) => s.trim()).includes("product_id");
  const fields = typeof req.query.fields === "string" ? req.query.fields : undefined;
  const limit = parseLimit(req, 25, 500);
  const offset = parseAfterOffset(req.query.after);

  const { rows, total } = queryInsights({
    objectId,
    dateStart: timeRange.start,
    dateEnd: timeRange.end,
    level,
    timeIncrement,
    productBreakdown,
    limit,
    offset,
  });

  res.json(
    pagingEnvelope(
      req,
      `${versionPrefix()}/${objectId}/insights`,
      rows.map((r) => insightToGraphRow(r, { productBreakdown, fields })),
      total,
      limit,
      offset,
    ),
  );
}

graphRouter.get(
  `${versionPrefix()}/:objectId/insights`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    if (objectId.startsWith("act_")) requireAct(objectId);
    else if (!getCampaign(objectId) && !getAdSet(objectId) && !getAd(objectId)) {
      throw new MetaGraphError(`Unsupported get request. Object with ID '${objectId}' does not exist`, {
        status: 400,
        code: 100,
      });
    }
    handleInsights(req, res, objectId);
  }),
);

// ── Ad account edges: campaigns / adsets / ads / customaudiences ───────────
graphRouter.get(
  `${versionPrefix()}/:objectId/campaigns`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    requireAct(objectId);
    const limit = parseLimit(req, 25, 100);
    const offset = parseAfterOffset(req.query.after);
    const total = countCampaigns(objectId);
    const rows = listCampaigns(objectId, limit, offset);
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/${objectId}/campaigns`,
        rows.map((c) => campaignToGraph(c, req.query.fields || "id,name,status,objective")),
        total,
        limit,
        offset,
      ),
    );
  }),
);

graphRouter.post(
  `${versionPrefix()}/:objectId/campaigns`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    requireAct(objectId);
    const body = req.body as Record<string, unknown>;
    const status = parseStatus(body.status, "PAUSED");
    const created: Campaign = {
      id: nextNumericId(4100000000),
      adAccountId: objectId,
      name: String(body.name || "Untitled Campaign"),
      status,
      effectiveStatus: status,
      objective: String(body.objective || "OUTCOME_SALES"),
      buyingType: "AUCTION",
      smartPromotionType:
        body.smart_promotion_type != null
          ? String(body.smart_promotion_type)
          : String(body.objective || "").includes("SALES")
            ? "AUTOMATED_SHOPPING_ADS"
            : null,
      dailyBudget: body.daily_budget != null ? Number(body.daily_budget) / 100 : null,
      lifetimeBudget: body.lifetime_budget != null ? Number(body.lifetime_budget) / 100 : null,
      createdTime: nowIso(),
      updatedTime: nowIso(),
    };
    createCampaign(created);
    writeAuditLog({
      action: "create_campaign",
      entityType: "campaign",
      entityId: created.id,
      beforeJson: null,
      afterJson: JSON.stringify(created),
    });
    res.json({ id: created.id, success: true });
  }),
);

graphRouter.get(
  `${versionPrefix()}/:objectId/adsets`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    const limit = parseLimit(req, 25, 100);
    const offset = parseAfterOffset(req.query.after);
    let rows;
    let total: number;
    let path: string;
    if (objectId.startsWith("act_")) {
      requireAct(objectId);
      rows = listAdSets({ adAccountId: objectId, limit, offset });
      total = countAdSets(objectId);
      path = `${versionPrefix()}/${objectId}/adsets`;
    } else if (getCampaign(objectId)) {
      rows = listAdSets({ campaignId: objectId, limit, offset });
      total = rows.length + offset; // approximate for campaign edge
      path = `${versionPrefix()}/${objectId}/adsets`;
    } else {
      throw new MetaGraphError(`Unsupported get request. Object with ID '${objectId}' does not exist`, {
        status: 400,
        code: 100,
      });
    }
    res.json(
      pagingEnvelope(
        req,
        path,
        rows.map((a) => adSetToGraph(a, req.query.fields)),
        total,
        limit,
        offset,
      ),
    );
  }),
);

graphRouter.post(
  `${versionPrefix()}/:objectId/adsets`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    requireAct(objectId);
    const body = req.body as Record<string, unknown>;
    const campaignId = String(body.campaign_id || "");
    if (!getCampaign(campaignId)) {
      throw new MetaGraphError("(#100) Invalid campaign_id", { status: 400, code: 100 });
    }
    const status = parseStatus(body.status, "PAUSED");
    const promoted = (body.promoted_object || {}) as { product_set_id?: string; product_catalog_id?: string };
    const created: AdSet = {
      id: nextNumericId(4600000000),
      adAccountId: objectId,
      campaignId,
      name: String(body.name || "Untitled Ad Set"),
      status,
      effectiveStatus: status,
      optimizationGoal: String(body.optimization_goal || "OFFSITE_CONVERSIONS"),
      billingEvent: String(body.billing_event || "IMPRESSIONS"),
      bidStrategy: String(body.bid_strategy || "LOWEST_COST_WITHOUT_CAP"),
      dailyBudget: body.daily_budget != null ? Number(body.daily_budget) / 100 : null,
      productSetId: promoted.product_set_id || null,
      catalogId: promoted.product_catalog_id || config.catalogId,
      targetingJson: JSON.stringify(body.targeting || {}),
      createdTime: nowIso(),
      updatedTime: nowIso(),
    };
    createAdSet(created);
    writeAuditLog({
      action: "create_adset",
      entityType: "adset",
      entityId: created.id,
      beforeJson: null,
      afterJson: JSON.stringify(created),
    });
    res.json({ id: created.id, success: true });
  }),
);

graphRouter.get(
  `${versionPrefix()}/:objectId/ads`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    const limit = parseLimit(req, 25, 100);
    const offset = parseAfterOffset(req.query.after);
    let rows;
    if (objectId.startsWith("act_")) {
      requireAct(objectId);
      rows = listAds({ adAccountId: objectId, limit, offset });
    } else if (getCampaign(objectId)) {
      rows = listAds({ campaignId: objectId, limit, offset });
    } else if (getAdSet(objectId)) {
      rows = listAds({ adSetId: objectId, limit, offset });
    } else {
      throw new MetaGraphError(`Unsupported get request. Object with ID '${objectId}' does not exist`, {
        status: 400,
        code: 100,
      });
    }
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/${objectId}/ads`,
        rows.map((a) => adToGraph(a, req.query.fields)),
        rows.length + offset,
        limit,
        offset,
      ),
    );
  }),
);

graphRouter.post(
  `${versionPrefix()}/:objectId/ads`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    requireAct(objectId);
    const body = req.body as Record<string, unknown>;
    const adsetId = String(body.adset_id || "");
    const adset = getAdSet(adsetId);
    if (!adset) throw new MetaGraphError("(#100) Invalid adset_id", { status: 400, code: 100 });
    const status = parseStatus(body.status, "PAUSED");
    const creative = (body.creative || {}) as { product_set_id?: string; creative_id?: string };
    const created: Ad = {
      id: nextNumericId(5100000000),
      adAccountId: objectId,
      campaignId: adset.campaignId,
      adSetId: adsetId,
      name: String(body.name || "Untitled Ad"),
      status,
      effectiveStatus: status,
      creativeId: creative.creative_id || null,
      productSetId: creative.product_set_id || adset.productSetId,
      createdTime: nowIso(),
      updatedTime: nowIso(),
    };
    createAd(created);
    writeAuditLog({
      action: "create_ad",
      entityType: "ad",
      entityId: created.id,
      beforeJson: null,
      afterJson: JSON.stringify(created),
    });
    res.json({ id: created.id, success: true });
  }),
);

graphRouter.get(
  `${versionPrefix()}/:objectId/customaudiences`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    requireAct(objectId);
    const all = listAudiences(objectId);
    const limit = parseLimit(req);
    const offset = parseAfterOffset(req.query.after);
    const slice = all.slice(offset, offset + limit);
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/${objectId}/customaudiences`,
        slice.map((a) => audienceToGraph(a, req.query.fields)),
        all.length,
        limit,
        offset,
      ),
    );
  }),
);

// ── Catalog / product-set products edge (same path shape as Meta) ───────────
graphRouter.get(
  `${versionPrefix()}/:objectId/products`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    const limit = parseLimit(req, 25, 100);
    const offset = parseAfterOffset(req.query.after);

    if (getCatalog(objectId)) {
      const total = countCatalogProducts(objectId);
      const rows = listCatalogProducts(objectId, limit, offset);
      res.json(
        pagingEnvelope(
          req,
          `${versionPrefix()}/${objectId}/products`,
          rows.map((p) => productToGraph(p, req.query.fields)),
          total,
          limit,
          offset,
        ),
      );
      return;
    }

    if (getProductSet(objectId)) {
      const total = countProductSetProducts(objectId);
      const rows = listProductSetProducts(objectId, limit, offset);
      res.json(
        pagingEnvelope(
          req,
          `${versionPrefix()}/${objectId}/products`,
          rows.map((p) => productToGraph(p, req.query.fields)),
          total,
          limit,
          offset,
        ),
      );
      return;
    }

    throw new MetaGraphError(`Unsupported get request. Object with ID '${objectId}' does not exist`, {
      status: 400,
      code: 100,
    });
  }),
);

graphRouter.get(
  `${versionPrefix()}/:catalogId/product_sets`,
  asyncRoute(async (req, res) => {
    const catalogId = String(req.params.catalogId);
    requireCatalog(catalogId);
    const all = listProductSets(catalogId);
    const limit = parseLimit(req);
    const offset = parseAfterOffset(req.query.after);
    const slice = all.slice(offset, offset + limit);
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/${catalogId}/product_sets`,
        slice.map((ps) => productSetToGraph(ps, req.query.fields)),
        all.length,
        limit,
        offset,
      ),
    );
  }),
);

graphRouter.post(
  `${versionPrefix()}/:catalogId/product_sets`,
  asyncRoute(async (req, res) => {
    const catalogId = String(req.params.catalogId);
    requireCatalog(catalogId);
    const body = req.body as { name?: string; filter?: unknown };
    const created: ProductSet = {
      id: nextNumericId(6100000000),
      catalogId,
      name: String(body.name || "Untitled Product Set"),
      filterJson: JSON.stringify(body.filter || {}),
      productCount: 0,
    };
    createProductSet(created);
    writeAuditLog({
      action: "create_product_set",
      entityType: "product_set",
      entityId: created.id,
      beforeJson: null,
      afterJson: JSON.stringify(created),
    });
    res.json({ id: created.id, success: true });
  }),
);

graphRouter.get(
  `${versionPrefix()}/:catalogId/product_feeds`,
  asyncRoute(async (req, res) => {
    const catalogId = String(req.params.catalogId);
    requireCatalog(catalogId);
    const all = listProductFeeds(catalogId);
    const limit = parseLimit(req);
    const offset = parseAfterOffset(req.query.after);
    const slice = all.slice(offset, offset + limit);
    res.json(
      pagingEnvelope(
        req,
        `${versionPrefix()}/${catalogId}/product_feeds`,
        slice.map((f) => feedToGraph(f, req.query.fields)),
        all.length,
        limit,
        offset,
      ),
    );
  }),
);

graphRouter.get(
  `${versionPrefix()}/:catalogId/check_batch_request_status`,
  asyncRoute(async (req, res) => {
    // Meta-style diagnostics summary for catalog health
    const catalogId = String(req.params.catalogId);
    requireCatalog(catalogId);
    const diags = listDiagnostics(catalogId);
    res.json({
      data: diags.map(diagnosticToGraph),
      summary: {
        error_count: diags.filter((d) => d.severity === "error").length,
        warning_count: diags.filter((d) => d.severity === "warning").length,
        info_count: diags.filter((d) => d.severity === "info").length,
      },
    });
  }),
);

graphRouter.get(
  `${versionPrefix()}/:catalogId/diagnostic_insights`,
  asyncRoute(async (req, res) => {
    const catalogId = String(req.params.catalogId);
    requireCatalog(catalogId);
    const diags = listDiagnostics(catalogId);
    res.json({ data: diags.map(diagnosticToGraph) });
  }),
);

graphRouter.post(
  `${versionPrefix()}/:catalogId/items_batch`,
  asyncRoute(async (req, res) => {
    const catalogId = String(req.params.catalogId);
    requireCatalog(catalogId);
    const body = req.body as {
      item_type?: string;
      requests?: Array<{ method?: string; retailer_id?: string; data?: Record<string, unknown> }>;
    };
    if ((body.item_type || "PRODUCT_ITEM") !== "PRODUCT_ITEM") {
      throw new MetaGraphError(`(#100) item_type ${body.item_type} is not supported in sandbox`, {
        status: 400,
        code: 100,
      });
    }
    const requests = Array.isArray(body.requests) ? body.requests : [];
    if (!requests.length) {
      throw new MetaGraphError("(#100) requests must be a non-empty array", { status: 400, code: 100 });
    }

    const validationStatus: Array<{ retailer_id: string; errors?: unknown[]; warnings?: unknown[] }> = [];
    for (const reqItem of requests) {
      const retailerId = String(reqItem.retailer_id || "");
      const method = String(reqItem.method || "UPDATE").toUpperCase();
      if (!retailerId) {
        validationStatus.push({ retailer_id: "", errors: [{ message: "retailer_id is required" }] });
        continue;
      }
      if (method === "DELETE") {
        deleteCatalogProduct(retailerId);
        writeAuditLog({
          action: "items_batch_delete",
          entityType: "catalog_product",
          entityId: retailerId,
          beforeJson: null,
          afterJson: JSON.stringify({ method }),
        });
        validationStatus.push({ retailer_id: retailerId, errors: [], warnings: [] });
        continue;
      }

      const data = reqItem.data || {};
      const existing = getProductByRetailerId(retailerId);
      const priceRaw = data.price;
      let price = existing?.price ?? 0;
      let currency = existing?.currency ?? config.currency;
      if (typeof priceRaw === "string" && priceRaw.includes(" ")) {
        const [amount, cur] = priceRaw.split(" ");
        price = Number(amount) || 0;
        currency = (cur || currency).toUpperCase();
      } else if (priceRaw != null) {
        price = Number(priceRaw) || 0;
      }

      const product: CatalogProduct = {
        id: existing?.id || `batch_${retailerId}`,
        catalogId,
        retailerId,
        name: String(data.name || data.title || existing?.name || retailerId),
        description: String(data.description || existing?.description || ""),
        price,
        salePrice: data.sale_price != null ? Number(String(data.sale_price).split(" ")[0]) : existing?.salePrice ?? null,
        currency,
        availability: String(data.availability || existing?.availability || "in stock") as CatalogProduct["availability"],
        condition: (String(data.condition || existing?.condition || "new") as CatalogProduct["condition"]),
        brand: String(data.brand || existing?.brand || ""),
        imageUrl: String(data.image_url || data.image_link || existing?.imageUrl || ""),
        additionalImageUrls: existing?.additionalImageUrls || [],
        link: String(data.url || data.link || existing?.link || ""),
        googleProductCategory: String(data.google_product_category || existing?.googleProductCategory || ""),
        productType: String(data.product_type || existing?.productType || ""),
        customLabel0: data.custom_label_0 != null ? String(data.custom_label_0) : existing?.customLabel0 ?? null,
        customLabel1: data.custom_label_1 != null ? String(data.custom_label_1) : existing?.customLabel1 ?? null,
        customLabel2: data.custom_label_2 != null ? String(data.custom_label_2) : existing?.customLabel2 ?? null,
        customLabel3: data.custom_label_3 != null ? String(data.custom_label_3) : existing?.customLabel3 ?? null,
        customLabel4: data.custom_label_4 != null ? String(data.custom_label_4) : existing?.customLabel4 ?? null,
        reviewStatus: existing?.reviewStatus || "pending",
        visibility: existing?.visibility || "published",
        errorsJson: null,
        warningsJson: !data.image_url && !existing?.imageUrl
          ? JSON.stringify([{ error_type: "MISSING_IMAGE", description: "Image recommended for catalog ads" }])
          : null,
      };
      upsertCatalogProduct(product);
      writeAuditLog({
        action: "items_batch_upsert",
        entityType: "catalog_product",
        entityId: retailerId,
        beforeJson: existing ? JSON.stringify(existing) : null,
        afterJson: JSON.stringify(product),
      });
      validationStatus.push({
        retailer_id: retailerId,
        errors: [],
        warnings: product.warningsJson ? (JSON.parse(product.warningsJson) as unknown[]) : [],
      });
    }

    res.json({ handles: [createBatchHandle(catalogId)], validation_status: validationStatus });
  }),
);

// ── Node update / delete (POST with status=DELETED is Meta's soft-delete pattern) ──
graphRouter.post(
  `${versionPrefix()}/:objectId`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    const body = req.body as Record<string, unknown>;

    const campaign = getCampaign(objectId);
    if (campaign) {
      const before = { ...campaign };
      const status =
        body.status != null
          ? (String(body.status).toUpperCase() as Campaign["status"])
          : undefined;
      const updated = updateCampaign(objectId, {
        name: body.name != null ? String(body.name) : undefined,
        status: status === "DELETED" || status === "ARCHIVED" || status === "ACTIVE" || status === "PAUSED" ? status : undefined,
        dailyBudget: body.daily_budget != null ? Number(body.daily_budget) / 100 : undefined,
      });
      writeAuditLog({
        action: "update_campaign",
        entityType: "campaign",
        entityId: objectId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(updated),
      });
      res.json({ success: true });
      return;
    }

    const adset = getAdSet(objectId);
    if (adset) {
      const before = { ...adset };
      const status =
        body.status != null ? (String(body.status).toUpperCase() as AdSet["status"]) : undefined;
      const updated = updateAdSet(objectId, {
        name: body.name != null ? String(body.name) : undefined,
        status: status === "DELETED" || status === "ARCHIVED" || status === "ACTIVE" || status === "PAUSED" ? status : undefined,
        dailyBudget: body.daily_budget != null ? Number(body.daily_budget) / 100 : undefined,
        targetingJson: body.targeting != null ? JSON.stringify(body.targeting) : undefined,
      });
      writeAuditLog({
        action: "update_adset",
        entityType: "adset",
        entityId: objectId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(updated),
      });
      res.json({ success: true });
      return;
    }

    const ad = getAd(objectId);
    if (ad) {
      const before = { ...ad };
      const status =
        body.status != null ? (String(body.status).toUpperCase() as Ad["status"]) : undefined;
      const updated = updateAd(objectId, {
        name: body.name != null ? String(body.name) : undefined,
        status: status === "DELETED" || status === "ARCHIVED" || status === "ACTIVE" || status === "PAUSED" ? status : undefined,
      });
      writeAuditLog({
        action: "update_ad",
        entityType: "ad",
        entityId: objectId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(updated),
      });
      res.json({ success: true });
      return;
    }

    const ps = getProductSet(objectId);
    if (ps) {
      const before = { ...ps };
      const updated = updateProductSet(objectId, {
        name: body.name != null ? String(body.name) : undefined,
        filterJson: body.filter != null ? JSON.stringify(body.filter) : undefined,
      });
      writeAuditLog({
        action: "update_product_set",
        entityType: "product_set",
        entityId: objectId,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(updated),
      });
      res.json({ success: true });
      return;
    }

    throw new MetaGraphError(`Unsupported post request. Object with ID '${objectId}' does not exist`, {
      status: 400,
      code: 100,
    });
  }),
);

graphRouter.delete(
  `${versionPrefix()}/:objectId`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    if (getCampaign(objectId)) {
      updateCampaign(objectId, { status: "DELETED", effectiveStatus: "DELETED" });
      writeAuditLog({
        action: "delete_campaign",
        entityType: "campaign",
        entityId: objectId,
        beforeJson: null,
        afterJson: JSON.stringify({ status: "DELETED" }),
      });
      res.json({ success: true });
      return;
    }
    if (getAdSet(objectId)) {
      updateAdSet(objectId, { status: "DELETED", effectiveStatus: "DELETED" });
      writeAuditLog({
        action: "delete_adset",
        entityType: "adset",
        entityId: objectId,
        beforeJson: null,
        afterJson: JSON.stringify({ status: "DELETED" }),
      });
      res.json({ success: true });
      return;
    }
    if (getAd(objectId)) {
      updateAd(objectId, { status: "DELETED", effectiveStatus: "DELETED" });
      writeAuditLog({
        action: "delete_ad",
        entityType: "ad",
        entityId: objectId,
        beforeJson: null,
        afterJson: JSON.stringify({ status: "DELETED" }),
      });
      res.json({ success: true });
      return;
    }
    if (getProductSet(objectId)) {
      deleteProductSet(objectId);
      writeAuditLog({
        action: "delete_product_set",
        entityType: "product_set",
        entityId: objectId,
        beforeJson: null,
        afterJson: null,
      });
      res.json({ success: true });
      return;
    }
    throw new MetaGraphError(`Unsupported delete request. Object with ID '${objectId}' does not exist`, {
      status: 400,
      code: 100,
    });
  }),
);

// ── Single-node GET ────────────────────────────────────────────────────────
graphRouter.get(
  `${versionPrefix()}/:objectId`,
  asyncRoute(async (req, res) => {
    const objectId = String(req.params.objectId);
    const fields = req.query.fields;

    const business = getBusiness(objectId);
    if (business) {
      res.json(businessToGraph(business, fields));
      return;
    }
    const account = getAdAccount(objectId);
    if (account) {
      res.json(accountToGraph(account, fields));
      return;
    }
    const catalog = getCatalog(objectId);
    if (catalog) {
      res.json(catalogToGraph(catalog, fields));
      return;
    }
    const campaign = getCampaign(objectId);
    if (campaign) {
      res.json(campaignToGraph(campaign, fields));
      return;
    }
    const adset = getAdSet(objectId);
    if (adset) {
      res.json(adSetToGraph(adset, fields));
      return;
    }
    const ad = getAd(objectId);
    if (ad) {
      res.json(adToGraph(ad, fields));
      return;
    }
    const creative = getCreative(objectId);
    if (creative) {
      res.json(creativeToGraph(creative, fields));
      return;
    }
    const ps = getProductSet(objectId);
    if (ps) {
      res.json(productSetToGraph(ps, fields));
      return;
    }
    const feed = getProductFeed(objectId);
    if (feed) {
      res.json(feedToGraph(feed, fields));
      return;
    }
    const audience = getAudience(objectId);
    if (audience) {
      res.json(audienceToGraph(audience, fields));
      return;
    }
    const product = getProduct(objectId) || getProductByRetailerId(objectId);
    if (product) {
      res.json(productToGraph(product, fields));
      return;
    }

    throw new MetaGraphError(`Unsupported get request. Object with ID '${objectId}' does not exist`, {
      status: 400,
      code: 100,
    });
  }),
);

graphRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  handleMetaError(res, err);
});

export { notFoundHandler as metaNotFoundHandler };
