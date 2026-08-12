/**
 * Seed the Meta sandbox with the 100-product Style Union PILOT and their REAL product-level insights.
 *
 * retailer_id = skuKey (real style code, e.g. LEJ00004) — the join key FeedGraph resolves against.
 * Metrics come from the client's real Meta product-level export (via styleunion_100.json). One insight
 * row per SKU (distinct product_id → no product-breakdown double counting), attributed to a dedicated
 * catalog-sales campaign whose objective ("PRODUCT_CATALOG_SALES") makes FeedGraph classify the rows
 * as product_level and pass the SKU-insights gate.
 *
 * Lives under src/ (not script/) so it is compiled into dist and can run at boot — deployed containers
 * have an empty, ephemeral DB, so without this every boot would fall back to the synthetic generator
 * and serve `shop_<act>_<n>` ids that match nothing in FeedGraph.
 *
 * Idempotent: re-running replaces products/insights and the dedicated campaign.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDb } from "../db/store.js";
import { config } from "../config.js";

/** src/generator/ in dev and dist/generator/ once compiled — repo root is two levels up either way. */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const CAMP_ID = "4900000001", ADSET_ID = "4950000001", AD_ID = "5900000001";

type Canon = {
  pid: string; handle: string; skuKey: string; title: string; brand: string; category: string;
  productType: string; color: string; size: string; price: string; image: string; description: string;
  availability: string; bucket: string;
  meta: null | { clicks: number; spend: number; purchases: number; purchValue: number; roas: number; views: number };
};

const parsePrice = (raw: string) => { const n = Number((raw || "").replace(/inr/i, "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : 0; };
const normAvail = (raw: string) => { const v = (raw || "").toLowerCase().replace(/_/g, " ").trim(); return v || "in stock"; };
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Locate the pilot dataset. The vendored copy ships with the repo (and therefore the deployed image);
 * the ecosystem path is the local-dev fallback so a checkout next to feedgraph/ still works.
 */
export function pilotDataPath(): string | null {
  const candidates = [
    process.env.PILOT_DATA_PATH,
    join(REPO_ROOT, "script", "data", "styleunion_100.json"),
    join(REPO_ROOT, "..", "feedgraph", "script", "data", "styleunion_100.json"),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) ?? null;
}

export type PilotSeedResult = { products: number; insightRows: number; skus: number };

export function seedPilotCatalog(): PilotSeedResult {
  const dataPath = pilotDataPath();
  if (!dataPath) throw new Error("Pilot dataset not found (looked for script/data/styleunion_100.json)");

  const db = getDb();
  const catalogId = config.catalogId, actId = config.adAccountId, currency = config.currency;
  const canon: Canon[] = JSON.parse(readFileSync(dataPath, "utf8"));
  const withMeta = canon.filter((c) => c.meta);

  const now = new Date();
  const nowIso = now.toISOString();
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  const insertProduct = db.prepare(
    `INSERT INTO catalog_products (id, catalog_id, retailer_id, name, description, price, sale_price, currency,
       availability, condition, brand, image_url, additional_image_urls, link, google_product_category, product_type,
       custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, review_status, visibility, errors_json, warnings_json)
     VALUES (@id,@catalog_id,@retailer_id,@name,@description,@price,@sale_price,@currency,
       @availability,@condition,@brand,@image_url,@additional_image_urls,@link,@gpc,@product_type,
       @cl0,@cl1,@cl2,@cl3,@cl4,'approved','published',NULL,NULL)`);
  const insertInsight = db.prepare(
    `INSERT INTO insights (ad_account_id, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
       product_id, product_name, date_start, date_end, impressions, clicks, spend, purchases, purchase_value, account_currency)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const productSets = db.prepare("SELECT id, filter_json FROM product_sets WHERE catalog_id = ?").all(catalogId) as { id: string; filter_json: string }[];

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM insights").run();
    db.prepare("DELETE FROM product_set_members").run();
    db.prepare("DELETE FROM catalog_products").run();
    db.prepare("DELETE FROM ads WHERE id = ?").run(AD_ID);
    db.prepare("DELETE FROM ad_sets WHERE id = ?").run(ADSET_ID);
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(CAMP_ID);

    db.prepare(`INSERT INTO campaigns (id, ad_account_id, name, status, effective_status, objective, buying_type, daily_budget, created_time, updated_time)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(CAMP_ID, actId, "Style Union — Advantage+ Catalog", "ACTIVE", "ACTIVE", "PRODUCT_CATALOG_SALES", "AUCTION", 250000, nowIso, nowIso);
    db.prepare(`INSERT INTO ad_sets (id, ad_account_id, campaign_id, name, status, effective_status, optimization_goal, billing_event, bid_strategy, daily_budget, catalog_id, targeting_json, created_time, updated_time)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(ADSET_ID, actId, CAMP_ID, "SU Catalog — Advantage+ Shopping", "ACTIVE", "ACTIVE", "OFFSITE_CONVERSIONS", "IMPRESSIONS", "LOWEST_COST_WITHOUT_CAP", 250000, catalogId, "{}", nowIso, nowIso);
    db.prepare(`INSERT INTO ads (id, ad_account_id, campaign_id, adset_id, name, status, effective_status, created_time, updated_time)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(AD_ID, actId, CAMP_ID, ADSET_ID, "SU Catalog — DPA Ad", "ACTIVE", "ACTIVE", nowIso, nowIso);

    const prods: { id: string; retailerId: string; name: string; availability: string; productType: string; brand: string; cl0: string }[] = [];
    canon.forEach((c, idx) => {
      const id = String(3000000000 + idx + 1);
      insertProduct.run({
        id, catalog_id: catalogId, retailer_id: c.skuKey, name: (c.title || c.skuKey).trim(),
        description: (c.description || "").trim(), price: parsePrice(c.price), sale_price: null, currency,
        availability: normAvail(c.availability), condition: "new", brand: (c.brand || "").trim(),
        image_url: (c.image || "").trim(), additional_image_urls: JSON.stringify(c.image ? [c.image] : []),
        link: `https://styleunion.in/products/${c.handle}`, gpc: (c.category || "").trim(), product_type: (c.productType || "").trim(),
        cl0: c.bucket || null, cl1: null, cl2: null, cl3: null, cl4: null,
      });
      prods.push({ id, retailerId: c.skuKey, name: c.title, availability: normAvail(c.availability), productType: c.productType || "", brand: c.brand || "", cl0: c.bucket || "" });
    });
    db.prepare("UPDATE catalogs SET product_count = ? WHERE id = ?").run(prods.length, catalogId);

    for (const set of productSets) {
      let filter: Record<string, any> = {};
      try { filter = JSON.parse(set.filter_json || "{}"); } catch {}
      const fieldOf = (p: typeof prods[0], k: string) => k === "product_type" ? p.productType : k === "custom_label_0" ? p.cl0 : k === "brand" ? p.brand : k === "availability" ? p.availability : k === "name" ? p.name : "";
      const members = prods.filter((p) => Object.entries(filter).every(([k, cond]: any) => {
        if (!cond || typeof cond !== "object") return true; const a = fieldOf(p, k);
        if ("eq" in cond && a !== String(cond.eq)) return false;
        if ("i_contains" in cond && !a.toLowerCase().includes(String(cond.i_contains).toLowerCase())) return false;
        if ("contains" in cond && !a.includes(String(cond.contains))) return false;
        return true;
      }));
      const ins = db.prepare("INSERT OR IGNORE INTO product_set_members (product_set_id, product_id) VALUES (?, ?)");
      for (const m of members) ins.run(set.id, m.id);
      db.prepare("UPDATE product_sets SET product_count = ? WHERE id = ?").run(members.length, set.id);
    }

    let rows = 0;
    for (const c of withMeta) {
      const m = c.meta!;
      const clicks = Math.round(m.clicks);
      const impressions = Math.max(clicks, Math.round(clicks / 0.04)); // synth (Meta product export has no impressions)
      insertInsight.run(actId, CAMP_ID, "Style Union — Advantage+ Catalog", ADSET_ID, "SU Catalog — Advantage+ Shopping",
        AD_ID, "SU Catalog — DPA Ad", c.skuKey, c.title || c.skuKey, yesterday, yesterday,
        impressions, clicks, round2(m.spend), Math.round(m.purchases), round2(m.purchValue), currency);
      rows++;
    }
    const totalSpend = (db.prepare("SELECT COALESCE(SUM(spend),0) s FROM insights").get() as { s: number }).s;
    db.prepare("UPDATE ad_accounts SET amount_spent = ? WHERE id = ?").run(String(Math.round(totalSpend * 100)), actId);
    return rows;
  });
  const insightRows = tx();

  const products = (db.prepare("SELECT COUNT(*) c FROM catalog_products").get() as { c: number }).c;
  const skus = (db.prepare("SELECT COUNT(DISTINCT product_id) c FROM insights").get() as { c: number }).c;
  return { products, insightRows, skus };
}
