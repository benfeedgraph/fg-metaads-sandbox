/**
 * Reseed the Meta sandbox catalog to the 100 Style Union test SKUs (retailer_id = SU-TEST-###) so
 * the Meta Ads sandbox represents EXACTLY the products in FeedGraph's catalog and the Google Ads
 * sandbox. This is the Meta analog of sandbox-googleads/script/reseed-from-test-csv.ts.
 *
 * Reads feedgraph/StyleUnion_test_100.csv (the same file loaded into FeedGraph and Google Ads).
 * Replaces the ~2k generic products, then rebuilds product-set membership and product-level insights
 * against the new SKUs so Commerce Manager sets and Ads insights stay internally consistent. Keeps
 * the catalog, product sets, campaigns, ad sets, ads, and creatives.
 *
 * Idempotent: safe to re-run (deterministic RNG → stable metrics).
 * Run from sandbox-meta: npx tsx script/reseed-from-test-csv.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDb } from "../src/db/store.js";
import { config } from "../src/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(here, "..", "..", "feedgraph", "StyleUnion_test_100.csv");
const PRODUCTS_PER_AD = 12;

/** Minimal RFC4180 CSV parser (handles quoted fields with commas/quotes/newlines). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift()!;
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// Deterministic LCG so re-runs produce stable insight metrics.
const rnd = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
const randInt = (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1));
const rand = (min: number, max: number) => min + rnd() * (max - min);
const round2 = (n: number) => Math.round(n * 100) / 100;

const parsePrice = (raw: string) => {
  const n = Number((raw || "").replace(/inr/i, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

/** Normalize FeedGraph/GMC availability tokens to Meta catalog spelling. */
function normalizeAvailability(raw: string): string {
  const v = (raw || "").trim().toLowerCase().replace(/_/g, " ");
  if (v === "in stock" || v === "instock" || v === "") return "in stock";
  if (v === "out of stock" || v === "outofstock") return "out of stock";
  if (v === "preorder" || v === "pre order") return "preorder";
  if (v === "available for order") return "available for order";
  return v;
}

type Prod = {
  id: string;
  retailerId: string;
  name: string;
  availability: string;
  productType: string;
  customLabel0: string | null;
  customLabel1: string | null;
  brand: string;
  price: number;
};

/** Evaluate a Commerce-Manager product-set filter against a product (subset of Meta's operators). */
function matchesFilter(filter: Record<string, unknown>, p: Prod): boolean {
  const fieldValue = (key: string): string => {
    switch (key) {
      case "availability": return p.availability;
      case "product_type": return p.productType;
      case "custom_label_0": return p.customLabel0 ?? "";
      case "custom_label_1": return p.customLabel1 ?? "";
      case "brand": return p.brand;
      case "name": return p.name;
      default: return "";
    }
  };
  for (const [key, cond] of Object.entries(filter)) {
    if (!cond || typeof cond !== "object") continue;
    const c = cond as Record<string, unknown>;
    const actual = fieldValue(key);
    if ("eq" in c && actual !== String(c.eq)) return false;
    if ("neq" in c && actual === String(c.neq)) return false;
    if ("contains" in c && !actual.includes(String(c.contains))) return false;
    if ("i_contains" in c && !actual.toLowerCase().includes(String(c.i_contains).toLowerCase())) return false;
  }
  return true;
}

function main() {
  const db = getDb();
  const catalogId = config.catalogId;
  const actId = config.adAccountId;
  const currency = config.currency;
  const insightDays = config.insightDays;

  const rows = parseCsv(readFileSync(CSV_PATH, "utf8")).filter((r) => r.id);
  console.log(`Parsed ${rows.length} products from ${CSV_PATH}`);

  // Snapshot the structures we rebuild against BEFORE mutating.
  const productSets = db
    .prepare("SELECT id, filter_json FROM product_sets WHERE catalog_id = ?")
    .all(catalogId) as { id: string; filter_json: string }[];
  const ads = db
    .prepare(
      `SELECT a.id AS ad_id, a.name AS ad_name, a.campaign_id AS campaign_id,
              c.name AS campaign_name, c.objective AS objective,
              a.adset_id AS adset_id, s.name AS adset_name
       FROM ads a
       JOIN campaigns c ON c.id = a.campaign_id
       LEFT JOIN ad_sets s ON s.id = a.adset_id
       WHERE a.ad_account_id = ?`,
    )
    .all(actId) as {
      ad_id: string; ad_name: string; campaign_id: string; campaign_name: string;
      objective: string; adset_id: string | null; adset_name: string | null;
    }[];
  console.log(`Rebuilding against ${productSets.length} product set(s) and ${ads.length} ad(s).`);

  const insertProduct = db.prepare(
    `INSERT INTO catalog_products (
       id, catalog_id, retailer_id, name, description, price, sale_price, currency,
       availability, condition, brand, image_url, additional_image_urls, link,
       google_product_category, product_type,
       custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
       review_status, visibility, errors_json, warnings_json
     ) VALUES (@id, @catalog_id, @retailer_id, @name, @description, @price, @sale_price, @currency,
       @availability, @condition, @brand, @image_url, @additional_image_urls, @link,
       @google_product_category, @product_type,
       @cl0, @cl1, @cl2, @cl3, @cl4,
       'approved', 'published', NULL, NULL)`,
  );
  const insertMember = db.prepare(
    "INSERT OR IGNORE INTO product_set_members (product_set_id, product_id) VALUES (?, ?)",
  );
  const insertInsight = db.prepare(
    `INSERT INTO insights (
       ad_account_id, campaign_id, campaign_name, adset_id, adset_name,
       ad_id, ad_name, product_id, product_name,
       date_start, date_end, impressions, clicks, spend, purchases, purchase_value, account_currency
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    // Clear product-scoped data (keep catalog, product sets, campaigns, ad sets, ads, creatives).
    db.prepare("DELETE FROM insights").run();
    db.prepare("DELETE FROM product_set_members").run();
    db.prepare("DELETE FROM catalog_products").run();
    db.prepare("DELETE FROM catalog_diagnostics WHERE retailer_id IS NOT NULL").run();

    // ── Products ──
    const products: Prod[] = [];
    rows.forEach((r, idx) => {
      const i = idx + 1;
      const id = String(3000000000 + i);
      const retailerId = r.id.trim();
      const name = (r.title || retailerId).trim();
      const price = parsePrice(r.price);
      const image = (r.image_link || "").trim();
      const availability = normalizeAvailability(r.availability);
      const productType = (r.product_type || "").trim();
      const cl0 = r.custom_label_0?.trim() || null;
      const cl1 = r.custom_label_1?.trim() || null;
      const brand = r.brand?.trim() || "Style Union";
      insertProduct.run({
        id,
        catalog_id: catalogId,
        retailer_id: retailerId,
        name,
        description: (r.description || "").trim(),
        price,
        sale_price: parsePrice(r.sale_price) || null,
        currency,
        availability,
        condition: r.condition?.trim() || "new",
        brand,
        image_url: image,
        additional_image_urls: JSON.stringify(image ? [image] : []),
        link: (r.link || "").trim(),
        google_product_category: (r.google_product_category || "").trim(),
        product_type: productType,
        cl0, cl1, cl2: null, cl3: null, cl4: null,
      });
      products.push({ id, retailerId, name, availability, productType, customLabel0: cl0, customLabel1: cl1, brand, price });
    });

    db.prepare("UPDATE catalogs SET product_count = ? WHERE id = ?").run(products.length, catalogId);

    // ── Product-set membership (re-apply each set's filter to the new products) ──
    for (const set of productSets) {
      let filter: Record<string, unknown> = {};
      try { filter = JSON.parse(set.filter_json || "{}"); } catch { filter = {}; }
      const members = products.filter((p) => matchesFilter(filter, p));
      for (const m of members) insertMember.run(set.id, m.id);
      db.prepare("UPDATE product_sets SET product_count = ? WHERE id = ?").run(members.length, set.id);
    }

    // ── Product-level insights (mirror generator: each ad covers a slice, per day) ──
    const today = new Date();
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);
    const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);
    let insightRows = 0;
    for (const ad of ads) {
      const startIdx = Number(ad.ad_id) % Math.max(1, products.length - PRODUCTS_PER_AD);
      const slice = products.slice(startIdx, startIdx + PRODUCTS_PER_AD);
      const isSales = ad.objective.includes("SALES");
      for (let day = 0; day < insightDays; day++) {
        const date = isoDate(daysAgo(day));
        for (const p of slice) {
          if (rnd() < 0.35) continue; // realistic sparsity
          const impressions = randInt(20, isSales ? 4000 : 800);
          const clicks = Math.min(impressions, randInt(1, Math.max(2, Math.floor(impressions * 0.08))));
          const spend = round2(rand(5, isSales ? 400 : 80));
          const purchases = isSales && rnd() > 0.4 ? randInt(0, 8) : rnd() > 0.7 ? randInt(0, 2) : 0;
          const purchaseValue = round2(purchases * (p.price || rand(400, 2500)));
          insertInsight.run(
            actId, ad.campaign_id, ad.campaign_name, ad.adset_id, ad.adset_name,
            ad.ad_id, ad.ad_name, p.retailerId, p.name,
            date, date, impressions, clicks, spend, purchases, purchaseValue, currency,
          );
          insightRows++;
        }
      }
    }

    // Roll amount_spent on the ad account (stored in minor units, like the generator).
    const totalSpend = (db.prepare("SELECT COALESCE(SUM(spend),0) AS s FROM insights").get() as { s: number }).s;
    db.prepare("UPDATE ad_accounts SET amount_spent = ? WHERE id = ?").run(String(Math.round(totalSpend * 100)), actId);

    return insightRows;
  });

  const insightRows = tx();

  // ── Summary ──
  const count = (db.prepare("SELECT COUNT(*) AS c FROM catalog_products").get() as { c: number }).c;
  const members = (db.prepare("SELECT COUNT(*) AS c FROM product_set_members").get() as { c: number }).c;
  const withInsights = (db.prepare("SELECT COUNT(DISTINCT product_id) AS c FROM insights").get() as { c: number }).c;
  const sample = db
    .prepare("SELECT retailer_id, name, price, availability FROM catalog_products ORDER BY retailer_id LIMIT 4")
    .all();
  console.log(`\nReseeded Meta catalog ${catalogId}:`);
  console.log(`  catalog_products: ${count}`);
  console.log(`  product_set_members: ${members}`);
  console.log(`  insights rows: ${insightRows} (${withInsights} distinct products)`);
  console.log("  sample:", JSON.stringify(sample, null, 2));
  process.exit(0);
}

main();
