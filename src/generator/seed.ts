import { config } from "../config.js";
import { closeDb, getDb, isSeeded, resetDatabase } from "../db/store.js";
import { sandboxProductImageUrl } from "../lib/product-images.js";

const SUBCATEGORIES = [
  "Hoodies",
  "T-Shirts",
  "Jeans",
  "Jackets",
  "Dresses",
  "Shirts",
  "Shorts",
  "Skirts",
  "Sweaters",
  "Activewear",
] as const;

const BRANDS = ["UrbanWear", "ClassicFit", "TrendLine", "ComfortCo", "LoomLane", "ThreadCraft"] as const;
const ADJECTIVES = ["Blue", "Black", "White", "Red", "Navy", "Grey", "Olive", "Cream", "Floral", "Striped"] as const;
const LABELS = ["best-seller", "clearance", "new-arrival", "high-roas", "seasonal", "premium"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export async function seedDatabase(forceReset: boolean): Promise<void> {
  if (forceReset) {
    console.log("[seed] Resetting database...");
    resetDatabase();
  } else if (isSeeded()) {
    console.log("[seed] Already seeded — pass --reset to wipe.");
    return;
  } else {
    getDb();
  }

  const db = getDb();
  const actId = config.adAccountId;
  const accountNumeric = config.accountNumeric;
  const catalogId = config.catalogId;
  const currency = config.currency;
  const businessId = process.env.SANDBOX_BUSINESS_ID || "8000000001";
  const pageId = process.env.SANDBOX_PAGE_ID || "8000000002";
  const created = nowIso();

  console.log(
    `[seed] Seeding Meta Commerce + Ads sandbox: ${config.productCount} products, ${config.campaignCount} campaigns, ${config.insightDays} insight days...`,
  );

  const tx = db.transaction(() => {
    // Business Manager
    db.prepare(
      `INSERT INTO businesses (id, name, verification_status, primary_page_id) VALUES (?, ?, ?, ?)`,
    ).run(businessId, "FeedGraph Sandbox Business", "verified", pageId);

    db.prepare(
      `INSERT INTO ad_accounts
        (id, account_id, name, account_status, currency, business_id, timezone_name, disable_reason, amount_spent)
       VALUES (?, ?, ?, 1, ?, ?, 'Asia/Kolkata', 0, '0')`,
    ).run(actId, accountNumeric, config.accountName, currency, businessId);

    db.prepare(
      `INSERT INTO catalogs (id, name, business_id, vertical, product_count) VALUES (?, ?, ?, 'commerce', 0)`,
    ).run(catalogId, config.catalogName, businessId);

    const insertProduct = db.prepare(
      `INSERT INTO catalog_products (
         id, catalog_id, retailer_id, name, description, price, sale_price, currency,
         availability, condition, brand, image_url, additional_image_urls, link,
         google_product_category, product_type,
         custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
         review_status, visibility, errors_json, warnings_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    type Prod = { id: string; retailerId: string; name: string; brand: string; sub: string; label: string | null };
    const products: Prod[] = [];

    for (let i = 1; i <= config.productCount; i++) {
      const sub = pick(SUBCATEGORIES);
      const brand = pick(BRANDS);
      const adj = pick(ADJECTIVES);
      const retailerId = `shop_${accountNumeric}_${i}`;
      const productId = String(3000000000 + i);
      const name = `${adj} ${sub} ${i}`;
      const price = round2(rand(299, 4999));
      const onSale = i % 11 === 0;
      const salePrice = onSale ? round2(price * 0.8) : null;
      const availability = i < 40 ? "out of stock" : i < 55 ? "available for order" : "in stock";
      const imageUrl = sandboxProductImageUrl(i);
      const link = `https://sandbox.feedgraph.local/p/${retailerId}`;
      const description = `${brand} ${name} — apparel catalog item for FeedGraph Meta Commerce sandbox.`;
      const productType = `Apparel & Accessories > Clothing > ${sub}`;
      const label = i % 4 === 0 ? pick(LABELS) : null;

      // Realistic Meta review mix
      let reviewStatus: "approved" | "pending" | "rejected" | "outdated" = "approved";
      let errorsJson: string | null = null;
      let warningsJson: string | null = null;
      let visibility: "published" | "staging" | "hidden" = "published";

      if (i % 97 === 0) {
        reviewStatus = "rejected";
        visibility = "hidden";
        errorsJson = JSON.stringify([
          { error_type: "IMAGE_POLICY_VIOLATION", error_priority: "HIGH", description: "Main image failed policy review" },
        ]);
      } else if (i % 53 === 0) {
        reviewStatus = "pending";
        visibility = "staging";
      } else if (i % 41 === 0) {
        reviewStatus = "outdated";
        warningsJson = JSON.stringify([
          { error_type: "PRICE_MISMATCH", error_priority: "MEDIUM", description: "Price may be outdated vs landing page" },
        ]);
      } else if (!imageUrl || i % 67 === 0) {
        warningsJson = JSON.stringify([
          { error_type: "MISSING_ADDITIONAL_IMAGE", error_priority: "LOW", description: "Add more images for better Advantage+ matching" },
        ]);
      }

      insertProduct.run(
        productId,
        catalogId,
        retailerId,
        name,
        description,
        price,
        salePrice,
        currency,
        availability,
        brand,
        imageUrl,
        JSON.stringify([imageUrl]),
        link,
        "Apparel & Accessories > Clothing",
        productType,
        label,
        brand,
        sub,
        onSale ? "sale" : null,
        availability === "out of stock" ? "oos" : null,
        reviewStatus,
        visibility,
        errorsJson,
        warningsJson,
      );
      products.push({ id: productId, retailerId, name, brand, sub, label });
    }

    db.prepare(`UPDATE catalogs SET product_count = ? WHERE id = ?`).run(products.length, catalogId);

    // Product sets (Commerce Manager filter-based sets)
    const insertSet = db.prepare(
      `INSERT INTO product_sets (id, catalog_id, name, filter_json, product_count) VALUES (?, ?, ?, ?, ?)`,
    );
    const insertMember = db.prepare(
      `INSERT INTO product_set_members (product_set_id, product_id) VALUES (?, ?)`,
    );

    const allSetId = "6000000001";
    const bestSellerSetId = "6000000002";
    const inStockSetId = "6000000003";
    const clearanceSetId = "6000000004";
    const topsSetId = "6000000005";

    const sets: Array<{ id: string; name: string; filter: object; members: Prod[] }> = [
      {
        id: allSetId,
        name: "All Products",
        filter: {},
        members: products,
      },
      {
        id: bestSellerSetId,
        name: "Best Sellers",
        filter: { custom_label_0: { eq: "best-seller" } },
        members: products.filter((p) => p.label === "best-seller"),
      },
      {
        id: inStockSetId,
        name: "In Stock",
        filter: { availability: { eq: "in stock" } },
        members: products.filter((_, idx) => idx >= 55),
      },
      {
        id: clearanceSetId,
        name: "Clearance",
        filter: { custom_label_0: { eq: "clearance" } },
        members: products.filter((p) => p.label === "clearance"),
      },
      {
        id: topsSetId,
        name: "Tops",
        filter: { product_type: { i_contains: "T-Shirts" } },
        members: products.filter((p) => p.sub === "T-Shirts" || p.sub === "Hoodies" || p.sub === "Shirts"),
      },
    ];

    for (const s of sets) {
      insertSet.run(s.id, catalogId, s.name, JSON.stringify(s.filter), s.members.length);
      for (const m of s.members.slice(0, Math.min(s.members.length, 800))) {
        insertMember.run(s.id, m.id);
      }
    }

    // Catalog feed (Commerce Manager scheduled feed)
    db.prepare(
      `INSERT INTO product_feeds (
         id, catalog_id, name, schedule_interval, schedule_url,
         latest_upload_status, latest_upload_started_at, latest_upload_completed_at,
         products_added, products_updated, products_deleted, products_with_errors
       ) VALUES (?, ?, ?, 'DAILY', ?, 'success', ?, ?, ?, ?, 0, ?)`,
    ).run(
      "7000000001",
      catalogId,
      "Primary FeedGraph Feed",
      "https://sandbox.feedgraph.local/feeds/meta-primary.csv",
      daysAgo(1).toISOString(),
      daysAgo(1).toISOString(),
      Math.floor(products.length * 0.05),
      Math.floor(products.length * 0.9),
      Math.floor(products.length * 0.02),
    );

    // Catalog diagnostics (Commerce Manager issues)
    const insertDiag = db.prepare(
      `INSERT INTO catalog_diagnostics
        (catalog_id, retailer_id, severity, error_code, title, description, affected_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insertDiag.run(
      catalogId,
      null,
      "error",
      "IMAGE_POLICY_VIOLATION",
      "Products rejected for image policy",
      "Some products failed Meta image policy review and cannot serve in catalog ads.",
      products.filter((_, i) => (i + 1) % 97 === 0).length || 1,
    );
    insertDiag.run(
      catalogId,
      null,
      "warning",
      "MISSING_DESCRIPTION",
      "Short or weak descriptions",
      "Products with thin descriptions reduce Advantage+ matching quality.",
      Math.floor(products.length * 0.08),
    );
    insertDiag.run(
      catalogId,
      null,
      "warning",
      "OUT_OF_STOCK",
      "Out of stock items still published",
      "OOS products remain published — consider excluding from active product sets.",
      40,
    );
    insertDiag.run(
      catalogId,
      null,
      "info",
      "CUSTOM_LABEL_COVERAGE",
      "Custom label coverage",
      "About 25% of products have custom_label_0 for product-set filtering.",
      Math.floor(products.length * 0.25),
    );

    // Custom audiences
    const insertAud = db.prepare(
      `INSERT INTO custom_audiences (id, ad_account_id, name, subtype, approximate_count, delivery_status)
       VALUES (?, ?, ?, ?, ?, 'ready')`,
    );
    insertAud.run("9001000001", actId, "Website visitors 180d", "WEBSITE", 125000);
    insertAud.run("9001000002", actId, "Purchasers 90d", "WEBSITE", 18400);
    insertAud.run("9001000003", actId, "Lookalike — Purchasers 1%", "LOOKALIKE", 890000);
    insertAud.run("9001000004", actId, "Add-to-cart no purchase 14d", "WEBSITE", 42000);

    const insertCampaign = db.prepare(
      `INSERT INTO campaigns (
         id, ad_account_id, name, status, effective_status, objective, buying_type,
         smart_promotion_type, daily_budget, lifetime_budget, created_time, updated_time
       ) VALUES (?, ?, ?, ?, ?, ?, 'AUCTION', ?, ?, NULL, ?, ?)`,
    );
    const insertAdSet = db.prepare(
      `INSERT INTO ad_sets (
         id, ad_account_id, campaign_id, name, status, effective_status,
         optimization_goal, billing_event, bid_strategy, daily_budget,
         product_set_id, catalog_id, targeting_json, created_time, updated_time
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'IMPRESSIONS', 'LOWEST_COST_WITHOUT_CAP', ?, ?, ?, ?, ?, ?)`,
    );
    const insertCreative = db.prepare(
      `INSERT INTO ad_creatives (id, ad_account_id, name, product_set_id, catalog_id, object_story_spec_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertAd = db.prepare(
      `INSERT INTO ads (
         id, ad_account_id, campaign_id, adset_id, name, status, effective_status,
         creative_id, product_set_id, created_time, updated_time
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    type CampAd = {
      campaignId: string;
      campaignName: string;
      adSetId: string;
      adSetName: string;
      adId: string;
      adName: string;
      objective: string;
      productSetId: string;
      isAdvantagePlus: boolean;
    };
    const campAds: CampAd[] = [];

    const productSetPool = [allSetId, bestSellerSetId, inStockSetId, clearanceSetId, topsSetId];

    for (let c = 1; c <= config.campaignCount; c++) {
      const campaignId = String(4000000000 + c);
      const isAdvantagePlus = c % 3 !== 0; // ~2/3 Advantage+ Shopping
      const isPaused = c % 7 === 0;
      const status = isPaused ? "PAUSED" : "ACTIVE";

      // Meta modern objectives + legacy PRODUCT_CATALOG_SALES for FeedGraph classifiers
      let objective: string;
      let smartPromotionType: string | null = null;
      let name: string;

      if (isAdvantagePlus) {
        objective = c % 2 === 0 ? "OUTCOME_SALES" : "PRODUCT_CATALOG_SALES";
        smartPromotionType = "AUTOMATED_SHOPPING_ADS";
        name = `Advantage+ Shopping ${c}`;
      } else if (c % 5 === 0) {
        objective = "OUTCOME_TRAFFIC";
        name = `Traffic Campaign ${c}`;
      } else if (c % 4 === 0) {
        objective = "OUTCOME_AWARENESS";
        name = `Awareness Campaign ${c}`;
      } else {
        objective = "PRODUCT_CATALOG_SALES";
        name = `Catalog Sales (Manual) ${c}`;
      }

      const dailyBudget = round2(rand(500, 15000));
      insertCampaign.run(
        campaignId,
        actId,
        name,
        status,
        status,
        objective,
        smartPromotionType,
        dailyBudget,
        created,
        created,
      );

      const adSetCount = isAdvantagePlus ? 1 : c % 3 === 0 ? 2 : 1;
      for (let a = 1; a <= adSetCount; a++) {
        const adSetId = String(4500000000 + c * 10 + a);
        const productSetId = pick(productSetPool);
        const adSetName = isAdvantagePlus
          ? `${name} — ASC Ad Set`
          : `${name} — Ad Set ${a}`;
        const targeting = isAdvantagePlus
          ? {
              age_min: 18,
              age_max: 65,
              geo_locations: { countries: ["IN"] },
              targeting_automation: { advantage_audience: 1 },
            }
          : {
              age_min: 18,
              age_max: 45,
              geo_locations: { countries: ["IN"] },
              custom_audiences: [{ id: "9001000003" }],
              product_audience_specs: [
                { product_set_id: productSetId, inclusions: [{ retention_seconds: 86400 }] },
              ],
            };

        insertAdSet.run(
          adSetId,
          actId,
          campaignId,
          adSetName,
          status,
          status,
          isAdvantagePlus || objective.includes("SALES") ? "OFFSITE_CONVERSIONS" : "LINK_CLICKS",
          round2(dailyBudget / adSetCount),
          productSetId,
          catalogId,
          JSON.stringify(targeting),
          created,
          created,
        );

        const adCount = isAdvantagePlus ? 2 : 1;
        for (let d = 1; d <= adCount; d++) {
          const adId = String(5000000000 + c * 100 + a * 10 + d);
          const creativeId = String(5500000000 + c * 100 + a * 10 + d);
          const adName = `${name} — DPA Ad ${d}`;
          const objectStorySpec = {
            page_id: pageId,
            template_data: {
              call_to_action_type: "SHOP_NOW",
              link: "https://sandbox.feedgraph.local/",
              name: "{{product.name}}",
              description: "{{product.price}}",
              message: "Shop bestsellers from our catalog",
            },
          };
          insertCreative.run(
            creativeId,
            actId,
            `${adName} Creative`,
            productSetId,
            catalogId,
            JSON.stringify(objectStorySpec),
          );
          insertAd.run(
            adId,
            actId,
            campaignId,
            adSetId,
            adName,
            status,
            status,
            creativeId,
            productSetId,
            created,
            created,
          );
          campAds.push({
            campaignId,
            campaignName: name,
            adSetId,
            adSetName,
            adId,
            adName,
            objective,
            productSetId,
            isAdvantagePlus,
          });
        }
      }
    }

    const insertInsight = db.prepare(
      `INSERT INTO insights (
         ad_account_id, campaign_id, campaign_name, adset_id, adset_name,
         ad_id, ad_name, product_id, product_name,
         date_start, date_end, impressions, clicks, spend, purchases, purchase_value, account_currency
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const productsPerAd = 12;
    let insightRows = 0;
    for (const ca of campAds) {
      const startIdx = Number(ca.adId) % Math.max(1, products.length - productsPerAd);
      const slice = products.slice(startIdx, startIdx + productsPerAd);
      const isSales = ca.objective.includes("SALES") || ca.isAdvantagePlus;

      for (let day = 0; day < config.insightDays; day++) {
        const date = isoDate(daysAgo(day));
        for (const p of slice) {
          if (Math.random() < 0.35) continue;
          const impressions = randInt(20, isSales ? 4000 : 800);
          const clicks = Math.min(impressions, randInt(1, Math.max(2, Math.floor(impressions * 0.08))));
          const spend = round2(rand(5, isSales ? 400 : 80));
          const purchases = isSales && Math.random() > 0.4 ? randInt(0, 8) : Math.random() > 0.7 ? randInt(0, 2) : 0;
          const purchaseValue = round2(purchases * rand(400, 2500));
          insertInsight.run(
            actId,
            ca.campaignId,
            ca.campaignName,
            ca.adSetId,
            ca.adSetName,
            ca.adId,
            ca.adName,
            p.retailerId,
            p.name,
            date,
            date,
            impressions,
            clicks,
            spend,
            purchases,
            purchaseValue,
            currency,
          );
          insightRows++;
        }
      }
    }

    // Roll amount_spent on ad account
    const totalSpend = (
      db.prepare("SELECT COALESCE(SUM(spend),0) AS s FROM insights").get() as { s: number }
    ).s;
    db.prepare("UPDATE ad_accounts SET amount_spent = ? WHERE id = ?").run(
      String(Math.round(totalSpend * 100)),
      actId,
    );

    db.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, before_json, after_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      "seed",
      "sandbox",
      "meta",
      null,
      JSON.stringify({
        businessId,
        products: products.length,
        productSets: sets.length,
        campaigns: config.campaignCount,
        ads: campAds.length,
        insights: insightRows,
      }),
    );

    console.log(
      `[seed] Done — business=${businessId} products=${products.length} sets=${sets.length} campaigns=${config.campaignCount} adSets/ads=${campAds.length} insights=${insightRows}`,
    );
  });

  tx();
}

const isMain = process.argv[1]?.includes("seed");
if (isMain) {
  const reset = process.argv.includes("--reset");
  seedDatabase(reset)
    .then(() => {
      closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error("[seed] Failed:", err);
      closeDb();
      process.exit(1);
    });
}
