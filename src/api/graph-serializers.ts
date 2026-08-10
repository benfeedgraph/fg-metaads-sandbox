import type {
  Ad,
  AdAccount,
  AdCreative,
  AdSet,
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

export function pickFields(obj: Record<string, unknown>, fieldsParam: unknown): Record<string, unknown> {
  if (typeof fieldsParam !== "string" || !fieldsParam.trim()) return obj;
  const wanted = new Set(fieldsParam.split(",").map((f) => f.trim()).filter(Boolean));
  const out: Record<string, unknown> = {};
  for (const key of wanted) {
    if (key in obj) out[key] = obj[key];
  }
  if ("id" in obj && wanted.has("id") && !("id" in out)) out.id = obj.id;
  return Object.keys(out).length ? out : obj;
}

export function businessToGraph(b: Business, fields?: unknown): Record<string, unknown> {
  return pickFields(
    {
      id: b.id,
      name: b.name,
      verification_status: b.verificationStatus,
      primary_page: b.primaryPageId,
    },
    fields,
  );
}

export function accountToGraph(a: AdAccount, fields?: unknown): Record<string, unknown> {
  return pickFields(
    {
      id: a.id,
      account_id: a.accountId,
      name: a.name,
      account_status: a.accountStatus,
      currency: a.currency,
      business: { id: a.businessId },
      timezone_name: a.timezoneName,
      disable_reason: a.disableReason,
      amount_spent: a.amountSpent,
    },
    fields,
  );
}

export function catalogToGraph(c: Catalog, fields?: unknown): Record<string, unknown> {
  return pickFields(
    {
      id: c.id,
      name: c.name,
      business: { id: c.businessId },
      vertical: c.vertical,
      product_count: c.productCount,
    },
    fields,
  );
}

export function productToGraph(p: CatalogProduct, fields?: unknown): Record<string, unknown> {
  const errors = p.errorsJson ? safeJson(p.errorsJson) : [];
  const warnings = p.warningsJson ? safeJson(p.warningsJson) : [];
  return pickFields(
    {
      id: p.id,
      retailer_id: p.retailerId,
      name: p.name,
      description: p.description,
      price: `${p.price.toFixed(2)} ${p.currency}`,
      sale_price: p.salePrice != null ? `${p.salePrice.toFixed(2)} ${p.currency}` : undefined,
      currency: p.currency,
      availability: p.availability,
      condition: p.condition,
      brand: p.brand,
      image_url: p.imageUrl,
      additional_image_urls: p.additionalImageUrls,
      url: p.link,
      google_product_category: p.googleProductCategory,
      product_type: p.productType,
      custom_label_0: p.customLabel0,
      custom_label_1: p.customLabel1,
      custom_label_2: p.customLabel2,
      custom_label_3: p.customLabel3,
      custom_label_4: p.customLabel4,
      review_status: p.reviewStatus,
      visibility: p.visibility,
      errors,
      warnings,
    },
    fields,
  );
}

export function productSetToGraph(ps: ProductSet, fields?: unknown): Record<string, unknown> {
  let filter: unknown = {};
  try {
    filter = JSON.parse(ps.filterJson);
  } catch {
    filter = {};
  }
  return pickFields(
    {
      id: ps.id,
      name: ps.name,
      filter,
      product_count: ps.productCount,
    },
    fields,
  );
}

export function feedToGraph(f: ProductFeed, fields?: unknown): Record<string, unknown> {
  return pickFields(
    {
      id: f.id,
      name: f.name,
      schedule: {
        interval: f.scheduleInterval,
        url: f.scheduleUrl,
      },
      latest_upload: {
        status: f.latestUploadStatus,
        started_time: f.latestUploadStartedAt,
        end_time: f.latestUploadCompletedAt,
        products_added: f.productsAdded,
        products_updated: f.productsUpdated,
        products_deleted: f.productsDeleted,
        products_with_errors: f.productsWithErrors,
      },
    },
    fields,
  );
}

export function diagnosticToGraph(d: CatalogDiagnostic): Record<string, unknown> {
  return {
    id: String(d.id),
    severity: d.severity,
    error_code: d.errorCode,
    title: d.title,
    description: d.description,
    retailer_id: d.retailerId,
    number_of_products_affected: d.affectedCount,
  };
}

export function campaignToGraph(c: Campaign, fields?: unknown): Record<string, unknown> {
  return pickFields(
    {
      id: c.id,
      name: c.name,
      status: c.status,
      effective_status: c.effectiveStatus,
      objective: c.objective,
      buying_type: c.buyingType,
      smart_promotion_type: c.smartPromotionType,
      daily_budget: c.dailyBudget != null ? String(Math.round(c.dailyBudget * 100)) : undefined,
      lifetime_budget: c.lifetimeBudget != null ? String(Math.round(c.lifetimeBudget * 100)) : undefined,
      created_time: c.createdTime,
      updated_time: c.updatedTime,
    },
    fields,
  );
}

export function adSetToGraph(a: AdSet, fields?: unknown): Record<string, unknown> {
  let targeting: unknown = {};
  try {
    targeting = JSON.parse(a.targetingJson);
  } catch {
    targeting = {};
  }
  const promotedObject =
    a.productSetId || a.catalogId
      ? {
          product_set_id: a.productSetId,
          product_catalog_id: a.catalogId,
          custom_event_type: "PURCHASE",
        }
      : undefined;
  return pickFields(
    {
      id: a.id,
      name: a.name,
      campaign_id: a.campaignId,
      status: a.status,
      effective_status: a.effectiveStatus,
      optimization_goal: a.optimizationGoal,
      billing_event: a.billingEvent,
      bid_strategy: a.bidStrategy,
      daily_budget: a.dailyBudget != null ? String(Math.round(a.dailyBudget * 100)) : undefined,
      promoted_object: promotedObject,
      targeting,
      created_time: a.createdTime,
      updated_time: a.updatedTime,
    },
    fields,
  );
}

export function adToGraph(a: Ad, fields?: unknown): Record<string, unknown> {
  return pickFields(
    {
      id: a.id,
      name: a.name,
      campaign_id: a.campaignId,
      adset_id: a.adSetId,
      status: a.status,
      effective_status: a.effectiveStatus,
      creative: a.creativeId ? { id: a.creativeId } : undefined,
      created_time: a.createdTime,
      updated_time: a.updatedTime,
    },
    fields,
  );
}

export function creativeToGraph(c: AdCreative, fields?: unknown): Record<string, unknown> {
  let objectStorySpec: unknown = {};
  try {
    objectStorySpec = JSON.parse(c.objectStorySpecJson);
  } catch {
    objectStorySpec = {};
  }
  return pickFields(
    {
      id: c.id,
      name: c.name,
      product_set_id: c.productSetId,
      object_story_spec: objectStorySpec,
    },
    fields,
  );
}

export function audienceToGraph(a: CustomAudience, fields?: unknown): Record<string, unknown> {
  return pickFields(
    {
      id: a.id,
      name: a.name,
      subtype: a.subtype,
      approximate_count_lower_bound: a.approximateCount,
      approximate_count_upper_bound: Math.round(a.approximateCount * 1.15),
      delivery_status: { code: 200, description: a.deliveryStatus },
    },
    fields,
  );
}

export function insightToGraphRow(
  row: InsightRow,
  opts: { productBreakdown: boolean; fields?: string },
): Record<string, unknown> {
  const spend = row.spend;
  const revenue = row.purchaseValue;
  const roas = spend > 0 ? revenue / spend : 0;
  const out: Record<string, unknown> = {
    impressions: String(Math.round(row.impressions)),
    clicks: String(Math.round(row.clicks)),
    spend: spend.toFixed(2),
    account_currency: row.accountCurrency,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    adset_id: row.adSetId,
    adset_name: row.adSetName,
    ad_id: row.adId,
    ad_name: row.adName,
    date_start: row.dateStart,
    date_stop: row.dateEnd,
    actions: [
      { action_type: "link_click", value: String(Math.round(row.clicks)) },
      { action_type: "purchase", value: String(row.purchases) },
      { action_type: "omni_purchase", value: String(row.purchases) },
      { action_type: "offsite_conversion.fb_pixel_purchase", value: String(row.purchases) },
    ],
    action_values: [
      { action_type: "purchase", value: revenue.toFixed(2) },
      { action_type: "omni_purchase", value: revenue.toFixed(2) },
      { action_type: "offsite_conversion.fb_pixel_purchase", value: revenue.toFixed(2) },
    ],
    purchase_roas: [{ action_type: "omni_purchase", value: roas.toFixed(6) }],
  };
  if (opts.productBreakdown && row.productId) {
    out.product_id = row.productId;
    out.product_name = row.productName || row.productId;
  }
  if (!opts.fields) return out;
  const picked = pickFields(out, opts.fields);
  if (opts.productBreakdown && row.productId) {
    picked.product_id = row.productId;
    if (row.productName) picked.product_name = row.productName;
  }
  return picked;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
