import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config, resolveDbPath } from "../config.js";
import { SCHEMA_SQL } from "./schema.js";
import type {
  Ad,
  AdAccount,
  AdCreative,
  AdSet,
  AuditLogEntry,
  Business,
  Campaign,
  Catalog,
  CatalogDiagnostic,
  CatalogProduct,
  CustomAudience,
  InsightRow,
  ProductFeed,
  ProductSet,
} from "../models/types.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function isSeeded(): boolean {
  const row = getDb().prepare("SELECT COUNT(*) AS c FROM catalog_products").get() as { c: number };
  return row.c > 0;
}

export function resetDatabase(): void {
  closeDb();
  const dbPath = resolveDbPath();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${dbPath}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  getDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── mappers ────────────────────────────────────────────────────────────────

function rowToBusiness(row: Record<string, unknown>): Business {
  return {
    id: String(row.id),
    name: String(row.name),
    verificationStatus: row.verification_status as Business["verificationStatus"],
    primaryPageId: row.primary_page_id != null ? String(row.primary_page_id) : null,
  };
}

function rowToAccount(row: Record<string, unknown>): AdAccount {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    accountStatus: Number(row.account_status),
    currency: String(row.currency),
    businessId: String(row.business_id),
    timezoneName: String(row.timezone_name),
    disableReason: Number(row.disable_reason),
    amountSpent: String(row.amount_spent),
  };
}

function rowToCatalog(row: Record<string, unknown>): Catalog {
  return {
    id: String(row.id),
    name: String(row.name),
    businessId: String(row.business_id),
    vertical: row.vertical as Catalog["vertical"],
    productCount: Number(row.product_count),
  };
}

function parseJsonArray(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(String(raw));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function rowToProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: String(row.id),
    catalogId: String(row.catalog_id),
    retailerId: String(row.retailer_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    price: Number(row.price),
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    currency: String(row.currency),
    availability: row.availability as CatalogProduct["availability"],
    condition: (row.condition as CatalogProduct["condition"]) || "new",
    brand: String(row.brand ?? ""),
    imageUrl: String(row.image_url ?? ""),
    additionalImageUrls: parseJsonArray(row.additional_image_urls),
    link: String(row.link ?? ""),
    googleProductCategory: String(row.google_product_category ?? ""),
    productType: String(row.product_type ?? ""),
    customLabel0: row.custom_label_0 != null ? String(row.custom_label_0) : null,
    customLabel1: row.custom_label_1 != null ? String(row.custom_label_1) : null,
    customLabel2: row.custom_label_2 != null ? String(row.custom_label_2) : null,
    customLabel3: row.custom_label_3 != null ? String(row.custom_label_3) : null,
    customLabel4: row.custom_label_4 != null ? String(row.custom_label_4) : null,
    reviewStatus: row.review_status as CatalogProduct["reviewStatus"],
    visibility: row.visibility as CatalogProduct["visibility"],
    errorsJson: row.errors_json != null ? String(row.errors_json) : null,
    warningsJson: row.warnings_json != null ? String(row.warnings_json) : null,
  };
}

function rowToProductSet(row: Record<string, unknown>): ProductSet {
  return {
    id: String(row.id),
    catalogId: String(row.catalog_id),
    name: String(row.name),
    filterJson: String(row.filter_json),
    productCount: Number(row.product_count),
  };
}

function rowToFeed(row: Record<string, unknown>): ProductFeed {
  return {
    id: String(row.id),
    catalogId: String(row.catalog_id),
    name: String(row.name),
    scheduleInterval: row.schedule_interval as ProductFeed["scheduleInterval"],
    scheduleUrl: String(row.schedule_url),
    latestUploadStatus: row.latest_upload_status as ProductFeed["latestUploadStatus"],
    latestUploadStartedAt: row.latest_upload_started_at != null ? String(row.latest_upload_started_at) : null,
    latestUploadCompletedAt:
      row.latest_upload_completed_at != null ? String(row.latest_upload_completed_at) : null,
    productsAdded: Number(row.products_added),
    productsUpdated: Number(row.products_updated),
    productsDeleted: Number(row.products_deleted),
    productsWithErrors: Number(row.products_with_errors),
  };
}

function rowToDiagnostic(row: Record<string, unknown>): CatalogDiagnostic {
  return {
    id: Number(row.id),
    catalogId: String(row.catalog_id),
    retailerId: row.retailer_id != null ? String(row.retailer_id) : null,
    severity: row.severity as CatalogDiagnostic["severity"],
    errorCode: String(row.error_code),
    title: String(row.title),
    description: String(row.description),
    affectedCount: Number(row.affected_count),
  };
}

function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
    adAccountId: String(row.ad_account_id),
    name: String(row.name),
    status: row.status as Campaign["status"],
    effectiveStatus: String(row.effective_status),
    objective: String(row.objective),
    buyingType: row.buying_type as Campaign["buyingType"],
    smartPromotionType: row.smart_promotion_type != null ? String(row.smart_promotion_type) : null,
    dailyBudget: row.daily_budget != null ? Number(row.daily_budget) : null,
    lifetimeBudget: row.lifetime_budget != null ? Number(row.lifetime_budget) : null,
    createdTime: String(row.created_time),
    updatedTime: String(row.updated_time),
  };
}

function rowToAdSet(row: Record<string, unknown>): AdSet {
  return {
    id: String(row.id),
    adAccountId: String(row.ad_account_id),
    campaignId: String(row.campaign_id),
    name: String(row.name),
    status: row.status as AdSet["status"],
    effectiveStatus: String(row.effective_status),
    optimizationGoal: String(row.optimization_goal),
    billingEvent: String(row.billing_event),
    bidStrategy: String(row.bid_strategy),
    dailyBudget: row.daily_budget != null ? Number(row.daily_budget) : null,
    productSetId: row.product_set_id != null ? String(row.product_set_id) : null,
    catalogId: row.catalog_id != null ? String(row.catalog_id) : null,
    targetingJson: String(row.targeting_json ?? "{}"),
    createdTime: String(row.created_time),
    updatedTime: String(row.updated_time),
  };
}

function rowToAd(row: Record<string, unknown>): Ad {
  return {
    id: String(row.id),
    adAccountId: String(row.ad_account_id),
    campaignId: String(row.campaign_id),
    adSetId: String(row.adset_id),
    name: String(row.name),
    status: row.status as Ad["status"],
    effectiveStatus: String(row.effective_status),
    creativeId: row.creative_id != null ? String(row.creative_id) : null,
    productSetId: row.product_set_id != null ? String(row.product_set_id) : null,
    createdTime: String(row.created_time),
    updatedTime: String(row.updated_time),
  };
}

function rowToCreative(row: Record<string, unknown>): AdCreative {
  return {
    id: String(row.id),
    adAccountId: String(row.ad_account_id),
    name: String(row.name),
    productSetId: row.product_set_id != null ? String(row.product_set_id) : null,
    catalogId: row.catalog_id != null ? String(row.catalog_id) : null,
    objectStorySpecJson: String(row.object_story_spec_json ?? "{}"),
  };
}

function rowToAudience(row: Record<string, unknown>): CustomAudience {
  return {
    id: String(row.id),
    adAccountId: String(row.ad_account_id),
    name: String(row.name),
    subtype: String(row.subtype),
    approximateCount: Number(row.approximate_count),
    deliveryStatus: String(row.delivery_status),
  };
}

function rowToInsight(row: Record<string, unknown>): InsightRow {
  return {
    id: Number(row.id),
    adAccountId: String(row.ad_account_id),
    campaignId: String(row.campaign_id),
    campaignName: String(row.campaign_name),
    adSetId: row.adset_id != null ? String(row.adset_id) : null,
    adSetName: row.adset_name != null ? String(row.adset_name) : null,
    adId: String(row.ad_id),
    adName: String(row.ad_name),
    productId: row.product_id != null ? String(row.product_id) : null,
    productName: row.product_name != null ? String(row.product_name) : null,
    dateStart: String(row.date_start),
    dateEnd: String(row.date_end),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    spend: Number(row.spend),
    purchases: Number(row.purchases),
    purchaseValue: Number(row.purchase_value),
    accountCurrency: String(row.account_currency),
  };
}

// ── stats ──────────────────────────────────────────────────────────────────

export function getStats() {
  const d = getDb();
  const one = (sql: string) => (d.prepare(sql).get() as { c: number }).c;
  return {
    businesses: one("SELECT COUNT(*) AS c FROM businesses"),
    adAccounts: one("SELECT COUNT(*) AS c FROM ad_accounts"),
    catalogs: one("SELECT COUNT(*) AS c FROM catalogs"),
    products: one("SELECT COUNT(*) AS c FROM catalog_products"),
    productSets: one("SELECT COUNT(*) AS c FROM product_sets"),
    feeds: one("SELECT COUNT(*) AS c FROM product_feeds"),
    diagnostics: one("SELECT COUNT(*) AS c FROM catalog_diagnostics"),
    campaigns: one("SELECT COUNT(*) AS c FROM campaigns"),
    adSets: one("SELECT COUNT(*) AS c FROM ad_sets"),
    ads: one("SELECT COUNT(*) AS c FROM ads"),
    audiences: one("SELECT COUNT(*) AS c FROM custom_audiences"),
    insights: one("SELECT COUNT(*) AS c FROM insights"),
  };
}

export function getOverviewStats() {
  const d = getDb();
  const spend = (d.prepare("SELECT COALESCE(SUM(spend),0) AS s FROM insights").get() as { s: number }).s;
  const clicks = (d.prepare("SELECT COALESCE(SUM(clicks),0) AS c FROM insights").get() as { c: number }).c;
  const impressions = (d.prepare("SELECT COALESCE(SUM(impressions),0) AS i FROM insights").get() as {
    i: number;
  }).i;
  const purchases = (d.prepare("SELECT COALESCE(SUM(purchases),0) AS p FROM insights").get() as { p: number }).p;
  const revenue = (d.prepare("SELECT COALESCE(SUM(purchase_value),0) AS r FROM insights").get() as {
    r: number;
  }).r;
  const approved = (
    d.prepare("SELECT COUNT(*) AS c FROM catalog_products WHERE review_status = 'approved'").get() as {
      c: number;
    }
  ).c;
  const rejected = (
    d.prepare("SELECT COUNT(*) AS c FROM catalog_products WHERE review_status = 'rejected'").get() as {
      c: number;
    }
  ).c;
  const pending = (
    d.prepare("SELECT COUNT(*) AS c FROM catalog_products WHERE review_status = 'pending'").get() as {
      c: number;
    }
  ).c;
  return {
    spend: Math.round(spend * 100) / 100,
    clicks,
    impressions,
    purchases: Math.round(purchases * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
    productsApproved: approved,
    productsRejected: rejected,
    productsPending: pending,
    ...getStats(),
  };
}

// ── businesses / accounts / catalogs ───────────────────────────────────────

export function listBusinesses(): Business[] {
  return (getDb().prepare("SELECT * FROM businesses ORDER BY id").all() as Record<string, unknown>[]).map(
    rowToBusiness,
  );
}

export function getBusiness(id: string): Business | null {
  const row = getDb().prepare("SELECT * FROM businesses WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToBusiness(row) : null;
}

export function listAdAccounts(): AdAccount[] {
  return (getDb().prepare("SELECT * FROM ad_accounts ORDER BY id").all() as Record<string, unknown>[]).map(
    rowToAccount,
  );
}

export function getAdAccount(id: string): AdAccount | null {
  const row = getDb().prepare("SELECT * FROM ad_accounts WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToAccount(row) : null;
}

export function listCatalogs(): Catalog[] {
  return (getDb().prepare("SELECT * FROM catalogs ORDER BY id").all() as Record<string, unknown>[]).map(
    rowToCatalog,
  );
}

export function getCatalog(id: string): Catalog | null {
  const row = getDb().prepare("SELECT * FROM catalogs WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCatalog(row) : null;
}

export function refreshCatalogProductCount(catalogId: string): void {
  getDb()
    .prepare(
      `UPDATE catalogs SET product_count = (SELECT COUNT(*) FROM catalog_products WHERE catalog_id = ?) WHERE id = ?`,
    )
    .run(catalogId, catalogId);
}

// ── products ───────────────────────────────────────────────────────────────

export function listCatalogProducts(catalogId: string, limit: number, offset: number): CatalogProduct[] {
  return (
    getDb()
      .prepare("SELECT * FROM catalog_products WHERE catalog_id = ? ORDER BY id LIMIT ? OFFSET ?")
      .all(catalogId, limit, offset) as Record<string, unknown>[]
  ).map(rowToProduct);
}

export function countCatalogProducts(catalogId: string): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS c FROM catalog_products WHERE catalog_id = ?").get(catalogId) as {
      c: number;
    }
  ).c;
}

export function getProductByRetailerId(retailerId: string): CatalogProduct | null {
  const row = getDb().prepare("SELECT * FROM catalog_products WHERE retailer_id = ?").get(retailerId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToProduct(row) : null;
}

export function getProduct(id: string): CatalogProduct | null {
  const row = getDb().prepare("SELECT * FROM catalog_products WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToProduct(row) : null;
}

export function upsertCatalogProduct(product: CatalogProduct): void {
  getDb()
    .prepare(
      `INSERT INTO catalog_products (
         id, catalog_id, retailer_id, name, description, price, sale_price, currency,
         availability, condition, brand, image_url, additional_image_urls, link,
         google_product_category, product_type,
         custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
         review_status, visibility, errors_json, warnings_json
       ) VALUES (
         @id, @catalogId, @retailerId, @name, @description, @price, @salePrice, @currency,
         @availability, @condition, @brand, @imageUrl, @additionalImageUrls, @link,
         @googleProductCategory, @productType,
         @customLabel0, @customLabel1, @customLabel2, @customLabel3, @customLabel4,
         @reviewStatus, @visibility, @errorsJson, @warningsJson
       )
       ON CONFLICT(retailer_id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         price = excluded.price,
         sale_price = excluded.sale_price,
         currency = excluded.currency,
         availability = excluded.availability,
         condition = excluded.condition,
         brand = excluded.brand,
         image_url = excluded.image_url,
         additional_image_urls = excluded.additional_image_urls,
         link = excluded.link,
         google_product_category = excluded.google_product_category,
         product_type = excluded.product_type,
         custom_label_0 = excluded.custom_label_0,
         custom_label_1 = excluded.custom_label_1,
         custom_label_2 = excluded.custom_label_2,
         custom_label_3 = excluded.custom_label_3,
         custom_label_4 = excluded.custom_label_4,
         review_status = excluded.review_status,
         visibility = excluded.visibility,
         errors_json = excluded.errors_json,
         warnings_json = excluded.warnings_json`,
    )
    .run({
      ...product,
      salePrice: product.salePrice,
      additionalImageUrls: JSON.stringify(product.additionalImageUrls),
    });
  refreshCatalogProductCount(product.catalogId);
}

export function deleteCatalogProduct(retailerId: string): boolean {
  const existing = getProductByRetailerId(retailerId);
  if (!existing) return false;
  getDb().prepare("DELETE FROM catalog_products WHERE retailer_id = ?").run(retailerId);
  refreshCatalogProductCount(existing.catalogId);
  return true;
}

// ── product sets / feeds / diagnostics ─────────────────────────────────────

export function listProductSets(catalogId: string): ProductSet[] {
  return (
    getDb().prepare("SELECT * FROM product_sets WHERE catalog_id = ? ORDER BY id").all(catalogId) as Record<
      string,
      unknown
    >[]
  ).map(rowToProductSet);
}

export function getProductSet(id: string): ProductSet | null {
  const row = getDb().prepare("SELECT * FROM product_sets WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToProductSet(row) : null;
}

export function createProductSet(ps: ProductSet): ProductSet {
  getDb()
    .prepare(
      `INSERT INTO product_sets (id, catalog_id, name, filter_json, product_count)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(ps.id, ps.catalogId, ps.name, ps.filterJson, ps.productCount);
  return ps;
}

export function updateProductSet(id: string, patch: Partial<Pick<ProductSet, "name" | "filterJson" | "productCount">>): ProductSet | null {
  const existing = getProductSet(id);
  if (!existing) return null;
  const next = {
    name: patch.name ?? existing.name,
    filterJson: patch.filterJson ?? existing.filterJson,
    productCount: patch.productCount ?? existing.productCount,
  };
  getDb()
    .prepare(`UPDATE product_sets SET name = ?, filter_json = ?, product_count = ? WHERE id = ?`)
    .run(next.name, next.filterJson, next.productCount, id);
  return getProductSet(id);
}

export function deleteProductSet(id: string): boolean {
  const r = getDb().prepare("DELETE FROM product_sets WHERE id = ?").run(id);
  getDb().prepare("DELETE FROM product_set_members WHERE product_set_id = ?").run(id);
  return r.changes > 0;
}

export function listProductSetProducts(productSetId: string, limit: number, offset: number): CatalogProduct[] {
  return (
    getDb()
      .prepare(
        `SELECT p.* FROM catalog_products p
         INNER JOIN product_set_members m ON m.product_id = p.id
         WHERE m.product_set_id = ?
         ORDER BY p.id LIMIT ? OFFSET ?`,
      )
      .all(productSetId, limit, offset) as Record<string, unknown>[]
  ).map(rowToProduct);
}

export function countProductSetProducts(productSetId: string): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS c FROM product_set_members WHERE product_set_id = ?")
      .get(productSetId) as { c: number }
  ).c;
}

export function listProductFeeds(catalogId: string): ProductFeed[] {
  return (
    getDb().prepare("SELECT * FROM product_feeds WHERE catalog_id = ? ORDER BY id").all(catalogId) as Record<
      string,
      unknown
    >[]
  ).map(rowToFeed);
}

export function getProductFeed(id: string): ProductFeed | null {
  const row = getDb().prepare("SELECT * FROM product_feeds WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToFeed(row) : null;
}

export function listDiagnostics(catalogId: string): CatalogDiagnostic[] {
  return (
    getDb()
      .prepare("SELECT * FROM catalog_diagnostics WHERE catalog_id = ? ORDER BY severity, id")
      .all(catalogId) as Record<string, unknown>[]
  ).map(rowToDiagnostic);
}

// ── campaigns / ad sets / ads ──────────────────────────────────────────────

export function listCampaigns(adAccountId: string, limit = 100, offset = 0): Campaign[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM campaigns WHERE ad_account_id = ? AND status != 'DELETED'
         ORDER BY id LIMIT ? OFFSET ?`,
      )
      .all(adAccountId, limit, offset) as Record<string, unknown>[]
  ).map(rowToCampaign);
}

export function countCampaigns(adAccountId: string): number {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS c FROM campaigns WHERE ad_account_id = ? AND status != 'DELETED'`)
      .get(adAccountId) as { c: number }
  ).c;
}

export function getCampaign(id: string): Campaign | null {
  const row = getDb().prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCampaign(row) : null;
}

export function getCampaignsByIds(ids: string[]): Campaign[] {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return (
    getDb().prepare(`SELECT * FROM campaigns WHERE id IN (${placeholders})`).all(...ids) as Record<
      string,
      unknown
    >[]
  ).map(rowToCampaign);
}

export function createCampaign(c: Campaign): Campaign {
  getDb()
    .prepare(
      `INSERT INTO campaigns (
         id, ad_account_id, name, status, effective_status, objective, buying_type,
         smart_promotion_type, daily_budget, lifetime_budget, created_time, updated_time
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      c.id,
      c.adAccountId,
      c.name,
      c.status,
      c.effectiveStatus,
      c.objective,
      c.buyingType,
      c.smartPromotionType,
      c.dailyBudget,
      c.lifetimeBudget,
      c.createdTime,
      c.updatedTime,
    );
  return c;
}

export function updateCampaign(
  id: string,
  patch: Partial<Pick<Campaign, "name" | "status" | "effectiveStatus" | "dailyBudget" | "lifetimeBudget">>,
): Campaign | null {
  const existing = getCampaign(id);
  if (!existing) return null;
  const next = {
    name: patch.name ?? existing.name,
    status: patch.status ?? existing.status,
    effectiveStatus: patch.effectiveStatus ?? patch.status ?? existing.effectiveStatus,
    dailyBudget: patch.dailyBudget !== undefined ? patch.dailyBudget : existing.dailyBudget,
    lifetimeBudget: patch.lifetimeBudget !== undefined ? patch.lifetimeBudget : existing.lifetimeBudget,
    updatedTime: nowIso(),
  };
  getDb()
    .prepare(
      `UPDATE campaigns SET name = ?, status = ?, effective_status = ?, daily_budget = ?, lifetime_budget = ?, updated_time = ? WHERE id = ?`,
    )
    .run(next.name, next.status, next.effectiveStatus, next.dailyBudget, next.lifetimeBudget, next.updatedTime, id);
  return getCampaign(id);
}

export function listAdSets(opts: { adAccountId?: string; campaignId?: string; limit?: number; offset?: number }): AdSet[] {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  if (opts.campaignId) {
    return (
      getDb()
        .prepare(
          `SELECT * FROM ad_sets WHERE campaign_id = ? AND status != 'DELETED' ORDER BY id LIMIT ? OFFSET ?`,
        )
        .all(opts.campaignId, limit, offset) as Record<string, unknown>[]
    ).map(rowToAdSet);
  }
  if (opts.adAccountId) {
    return (
      getDb()
        .prepare(
          `SELECT * FROM ad_sets WHERE ad_account_id = ? AND status != 'DELETED' ORDER BY id LIMIT ? OFFSET ?`,
        )
        .all(opts.adAccountId, limit, offset) as Record<string, unknown>[]
    ).map(rowToAdSet);
  }
  return [];
}

export function countAdSets(adAccountId: string): number {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS c FROM ad_sets WHERE ad_account_id = ? AND status != 'DELETED'`)
      .get(adAccountId) as { c: number }
  ).c;
}

export function getAdSet(id: string): AdSet | null {
  const row = getDb().prepare("SELECT * FROM ad_sets WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToAdSet(row) : null;
}

export function createAdSet(a: AdSet): AdSet {
  getDb()
    .prepare(
      `INSERT INTO ad_sets (
         id, ad_account_id, campaign_id, name, status, effective_status,
         optimization_goal, billing_event, bid_strategy, daily_budget,
         product_set_id, catalog_id, targeting_json, created_time, updated_time
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      a.id,
      a.adAccountId,
      a.campaignId,
      a.name,
      a.status,
      a.effectiveStatus,
      a.optimizationGoal,
      a.billingEvent,
      a.bidStrategy,
      a.dailyBudget,
      a.productSetId,
      a.catalogId,
      a.targetingJson,
      a.createdTime,
      a.updatedTime,
    );
  return a;
}

export function updateAdSet(
  id: string,
  patch: Partial<Pick<AdSet, "name" | "status" | "effectiveStatus" | "dailyBudget" | "productSetId" | "targetingJson">>,
): AdSet | null {
  const existing = getAdSet(id);
  if (!existing) return null;
  const next = {
    name: patch.name ?? existing.name,
    status: patch.status ?? existing.status,
    effectiveStatus: patch.effectiveStatus ?? patch.status ?? existing.effectiveStatus,
    dailyBudget: patch.dailyBudget !== undefined ? patch.dailyBudget : existing.dailyBudget,
    productSetId: patch.productSetId !== undefined ? patch.productSetId : existing.productSetId,
    targetingJson: patch.targetingJson ?? existing.targetingJson,
    updatedTime: nowIso(),
  };
  getDb()
    .prepare(
      `UPDATE ad_sets SET name = ?, status = ?, effective_status = ?, daily_budget = ?, product_set_id = ?, targeting_json = ?, updated_time = ? WHERE id = ?`,
    )
    .run(
      next.name,
      next.status,
      next.effectiveStatus,
      next.dailyBudget,
      next.productSetId,
      next.targetingJson,
      next.updatedTime,
      id,
    );
  return getAdSet(id);
}

export function listAds(opts: { adAccountId?: string; campaignId?: string; adSetId?: string; limit?: number; offset?: number }): Ad[] {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  if (opts.adSetId) {
    return (
      getDb()
        .prepare(`SELECT * FROM ads WHERE adset_id = ? AND status != 'DELETED' ORDER BY id LIMIT ? OFFSET ?`)
        .all(opts.adSetId, limit, offset) as Record<string, unknown>[]
    ).map(rowToAd);
  }
  if (opts.campaignId) {
    return (
      getDb()
        .prepare(`SELECT * FROM ads WHERE campaign_id = ? AND status != 'DELETED' ORDER BY id LIMIT ? OFFSET ?`)
        .all(opts.campaignId, limit, offset) as Record<string, unknown>[]
    ).map(rowToAd);
  }
  if (opts.adAccountId) {
    return (
      getDb()
        .prepare(`SELECT * FROM ads WHERE ad_account_id = ? AND status != 'DELETED' ORDER BY id LIMIT ? OFFSET ?`)
        .all(opts.adAccountId, limit, offset) as Record<string, unknown>[]
    ).map(rowToAd);
  }
  return (getDb().prepare("SELECT * FROM ads WHERE status != 'DELETED' ORDER BY id").all() as Record<
    string,
    unknown
  >[]).map(rowToAd);
}

export function getAd(id: string): Ad | null {
  const row = getDb().prepare("SELECT * FROM ads WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToAd(row) : null;
}

export function createAd(a: Ad): Ad {
  getDb()
    .prepare(
      `INSERT INTO ads (
         id, ad_account_id, campaign_id, adset_id, name, status, effective_status,
         creative_id, product_set_id, created_time, updated_time
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      a.id,
      a.adAccountId,
      a.campaignId,
      a.adSetId,
      a.name,
      a.status,
      a.effectiveStatus,
      a.creativeId,
      a.productSetId,
      a.createdTime,
      a.updatedTime,
    );
  return a;
}

export function updateAd(
  id: string,
  patch: Partial<Pick<Ad, "name" | "status" | "effectiveStatus">>,
): Ad | null {
  const existing = getAd(id);
  if (!existing) return null;
  const next = {
    name: patch.name ?? existing.name,
    status: patch.status ?? existing.status,
    effectiveStatus: patch.effectiveStatus ?? patch.status ?? existing.effectiveStatus,
    updatedTime: nowIso(),
  };
  getDb()
    .prepare(`UPDATE ads SET name = ?, status = ?, effective_status = ?, updated_time = ? WHERE id = ?`)
    .run(next.name, next.status, next.effectiveStatus, next.updatedTime, id);
  return getAd(id);
}

export function getCreative(id: string): AdCreative | null {
  const row = getDb().prepare("SELECT * FROM ad_creatives WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCreative(row) : null;
}

export function listAudiences(adAccountId: string): CustomAudience[] {
  return (
    getDb()
      .prepare("SELECT * FROM custom_audiences WHERE ad_account_id = ? ORDER BY id")
      .all(adAccountId) as Record<string, unknown>[]
  ).map(rowToAudience);
}

export function getAudience(id: string): CustomAudience | null {
  const row = getDb().prepare("SELECT * FROM custom_audiences WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToAudience(row) : null;
}

// ── insights ───────────────────────────────────────────────────────────────

export type InsightQuery = {
  objectId: string;
  dateStart?: string;
  dateEnd?: string;
  level: "ad" | "adset" | "campaign" | "account";
  timeIncrement: "1" | "all_days";
  productBreakdown: boolean;
  limit: number;
  offset: number;
};

function dateFilterSql(dateStart?: string, dateEnd?: string): { sql: string; params: string[] } {
  const params: string[] = [];
  let sql = "";
  if (dateStart) {
    sql += " AND date_start >= ?";
    params.push(dateStart);
  }
  if (dateEnd) {
    sql += " AND date_end <= ?";
    params.push(dateEnd);
  }
  return { sql, params };
}

export function queryInsights(q: InsightQuery): { rows: InsightRow[]; total: number } {
  const d = getDb();
  let objectFilter = "ad_account_id = ?";
  if (q.objectId.startsWith("act_")) objectFilter = "ad_account_id = ?";
  else if (getCampaign(q.objectId)) objectFilter = "campaign_id = ?";
  else if (getAdSet(q.objectId)) objectFilter = "adset_id = ?";
  else if (getAd(q.objectId)) objectFilter = "ad_id = ?";

  const { sql: dateSql, params: dateParams } = dateFilterSql(q.dateStart, q.dateEnd);

  if (q.productBreakdown) {
    const where = `${objectFilter}${dateSql} AND product_id IS NOT NULL`;
    const count = (
      d.prepare(`SELECT COUNT(*) AS c FROM insights WHERE ${where}`).get(q.objectId, ...dateParams) as {
        c: number;
      }
    ).c;

    if (q.timeIncrement === "all_days") {
      const rows = d
        .prepare(
          `SELECT
             MIN(id) AS id, ad_account_id, campaign_id, campaign_name, adset_id, adset_name,
             ad_id, ad_name, product_id, product_name,
             MIN(date_start) AS date_start, MAX(date_end) AS date_end,
             SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(spend) AS spend,
             SUM(purchases) AS purchases, SUM(purchase_value) AS purchase_value, account_currency
           FROM insights WHERE ${where}
           GROUP BY ad_id, product_id
           ORDER BY spend DESC LIMIT ? OFFSET ?`,
        )
        .all(q.objectId, ...dateParams, q.limit, q.offset) as Record<string, unknown>[];
      return { rows: rows.map(rowToInsight), total: count };
    }

    const rows = d
      .prepare(
        `SELECT * FROM insights WHERE ${where}
         ORDER BY date_start DESC, ad_id, product_id LIMIT ? OFFSET ?`,
      )
      .all(q.objectId, ...dateParams, q.limit, q.offset) as Record<string, unknown>[];
    return { rows: rows.map(rowToInsight), total: count };
  }

  const groupBy =
    q.level === "campaign"
      ? "campaign_id, date_start, date_end"
      : q.level === "adset"
        ? "adset_id, date_start, date_end"
        : q.level === "account"
          ? "date_start, date_end"
          : "ad_id, date_start, date_end";

  const where = `${objectFilter}${dateSql}`;
  const baseFrom = `FROM insights WHERE ${where}`;

  if (q.timeIncrement === "all_days") {
    const groupCols =
      q.level === "campaign"
        ? "campaign_id"
        : q.level === "adset"
          ? "adset_id"
          : q.level === "account"
            ? "ad_account_id"
            : "ad_id";
    const rows = d
      .prepare(
        `SELECT
           MIN(id) AS id, ad_account_id, campaign_id, campaign_name, adset_id, adset_name,
           ad_id, ad_name, NULL AS product_id, NULL AS product_name,
           MIN(date_start) AS date_start, MAX(date_end) AS date_end,
           SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(spend) AS spend,
           SUM(purchases) AS purchases, SUM(purchase_value) AS purchase_value, account_currency
         ${baseFrom}
         GROUP BY ${groupCols}
         ORDER BY spend DESC LIMIT ? OFFSET ?`,
      )
      .all(q.objectId, ...dateParams, q.limit, q.offset) as Record<string, unknown>[];
    const total = (
      d.prepare(`SELECT COUNT(*) AS c FROM (SELECT 1 ${baseFrom} GROUP BY ${groupCols})`).get(
        q.objectId,
        ...dateParams,
      ) as { c: number }
    ).c;
    return { rows: rows.map(rowToInsight), total };
  }

  const rows = d
    .prepare(
      `SELECT
         MIN(id) AS id, ad_account_id, campaign_id, campaign_name, adset_id, adset_name,
         ad_id, ad_name, NULL AS product_id, NULL AS product_name,
         date_start, date_end,
         SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(spend) AS spend,
         SUM(purchases) AS purchases, SUM(purchase_value) AS purchase_value, account_currency
       ${baseFrom}
       GROUP BY ${groupBy}
       ORDER BY date_start DESC, ad_id
       LIMIT ? OFFSET ?`,
    )
    .all(q.objectId, ...dateParams, q.limit, q.offset) as Record<string, unknown>[];

  const total = (
    d.prepare(`SELECT COUNT(*) AS c FROM (SELECT 1 ${baseFrom} GROUP BY ${groupBy})`).get(
      q.objectId,
      ...dateParams,
    ) as { c: number }
  ).c;

  return { rows: rows.map(rowToInsight), total };
}

// ── audit / batch ──────────────────────────────────────────────────────────

export function writeAuditLog(entry: Omit<AuditLogEntry, "id" | "createdAt">): void {
  getDb()
    .prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, before_json, after_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(entry.action, entry.entityType, entry.entityId, entry.beforeJson, entry.afterJson);
}

export function listAuditLogs(limit = 100): AuditLogEntry[] {
  return (
    getDb().prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?").all(limit) as Record<string, unknown>[]
  ).map((row) => ({
    id: Number(row.id),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    beforeJson: row.before_json != null ? String(row.before_json) : null,
    afterJson: row.after_json != null ? String(row.after_json) : null,
    createdAt: String(row.created_at),
  }));
}

export function createBatchHandle(catalogId: string): string {
  const handle = `sandbox_batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare("INSERT INTO batch_handles (handle, catalog_id, status) VALUES (?, ?, ?)")
    .run(handle, catalogId, "started");
  return handle;
}

export function nextNumericId(prefixBase: number): string {
  return String(prefixBase + Math.floor(Math.random() * 1_000_000) + Date.now() % 1000);
}

void config;
