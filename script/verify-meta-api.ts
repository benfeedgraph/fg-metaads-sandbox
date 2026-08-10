/**
 * Verifies sandbox behaves like graph.facebook.com for FeedGraph + Commerce/Ads paths.
 */
const BASE = process.env.META_SANDBOX_URL || "http://localhost:4790";
const TOKEN = process.env.SANDBOX_ACCESS_TOKEN || "sandbox-access-token";
const ACT = process.env.SANDBOX_AD_ACCOUNT_ID || "act_1000000001";
const CATALOG = process.env.SANDBOX_CATALOG_ID || "2000000001";
const V = process.env.META_GRAPH_VERSION || process.env.API_VERSION || "v19.0";
const APP_ID = process.env.SANDBOX_META_APP_ID || "sandbox-app-id";
const APP_SECRET = process.env.SANDBOX_META_APP_SECRET || "sandbox-app-secret";

type Check = { name: string; pass: boolean; detail?: string };

const checks: Check[] = [];
const auth = { Authorization: `Bearer ${TOKEN}` };

async function req(method: string, path: string, opts?: { headers?: Record<string, string>; body?: unknown }) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: opts?.headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function hasMetaError(json: unknown): boolean {
  return !!(json as { error?: { message?: string; code?: number } })?.error?.message;
}

async function main() {
  console.log(`Verifying Meta Graph / Commerce / Ads sandbox at ${BASE} (${V})...\n`);

  const root = await req("GET", "/", {});
  checks.push({ name: "GET / Meta-style 404", pass: root.status === 404 && hasMetaError(root.json) });

  const noAuth = await req("GET", `/${V}/me/adaccounts`);
  checks.push({
    name: "missing auth → OAuthException 190",
    pass: noAuth.status === 401 && (noAuth.json as { error?: { code?: number } })?.error?.code === 190,
  });

  const businesses = await req("GET", `/${V}/me/businesses?fields=id,name,verification_status`, { headers: auth });
  checks.push({
    name: "GET /me/businesses (Business Manager)",
    pass: businesses.status === 200 && Array.isArray((businesses.json as { data?: unknown[] })?.data),
  });

  const accounts = await req("GET", `/${V}/me/adaccounts?fields=name,account_id,account_status,id&limit=10`, {
    headers: auth,
  });
  const acctData = (accounts.json as { data?: Array<{ id?: string }> })?.data;
  checks.push({
    name: "GET /me/adaccounts",
    pass: accounts.status === 200 && !!acctData?.some((a) => a.id === ACT),
  });

  const catalogs = await req("GET", `/${V}/me/owned_product_catalogs?fields=id,name,vertical,product_count`, {
    headers: auth,
  });
  checks.push({
    name: "GET /me/owned_product_catalogs",
    pass: catalogs.status === 200 && (catalogs.json as { data?: Array<{ id?: string }> })?.data?.[0]?.id === CATALOG,
  });

  const products = await req(
    "GET",
    `/${V}/${CATALOG}/products?fields=id,retailer_id,name,price,review_status,visibility,custom_label_0&limit=5`,
    { headers: auth },
  );
  const prod = (products.json as { data?: Array<{ retailer_id?: string; price?: string; review_status?: string }> })
    ?.data?.[0];
  checks.push({
    name: "GET /{catalog}/products Commerce fields",
    pass:
      products.status === 200 &&
      !!prod?.retailer_id &&
      typeof prod.price === "string" &&
      !!prod.review_status,
    detail: `review=${prod?.review_status}`,
  });

  const sets = await req("GET", `/${V}/${CATALOG}/product_sets?fields=id,name,filter,product_count`, {
    headers: auth,
  });
  const setId = (sets.json as { data?: Array<{ id?: string }> })?.data?.[0]?.id;
  checks.push({
    name: "GET /{catalog}/product_sets",
    pass: sets.status === 200 && !!setId,
  });

  if (setId) {
    const setProducts = await req("GET", `/${V}/${setId}/products?fields=retailer_id,name&limit=3`, {
      headers: auth,
    });
    checks.push({
      name: "GET /{productSet}/products",
      pass: setProducts.status === 200 && Array.isArray((setProducts.json as { data?: unknown[] })?.data),
    });
  }

  const feeds = await req("GET", `/${V}/${CATALOG}/product_feeds?fields=id,name,schedule,latest_upload`, {
    headers: auth,
  });
  checks.push({
    name: "GET /{catalog}/product_feeds",
    pass: feeds.status === 200 && Array.isArray((feeds.json as { data?: unknown[] })?.data),
  });

  const diags = await req("GET", `/${V}/${CATALOG}/diagnostic_insights`, { headers: auth });
  checks.push({
    name: "GET /{catalog}/diagnostic_insights",
    pass: diags.status === 200 && Array.isArray((diags.json as { data?: unknown[] })?.data),
  });

  const campaigns = await req(
    "GET",
    `/${V}/${ACT}/campaigns?fields=id,name,status,objective,smart_promotion_type&limit=10`,
    { headers: auth },
  );
  const campRows = (campaigns.json as { data?: Array<{ id?: string; smart_promotion_type?: string; objective?: string }> })
    ?.data;
  const asc = campRows?.find((c) => c.smart_promotion_type === "AUTOMATED_SHOPPING_ADS");
  checks.push({
    name: "Advantage+ campaigns (smart_promotion_type)",
    pass: campaigns.status === 200 && !!asc,
    detail: asc?.id,
  });

  const adsets = await req(
    "GET",
    `/${V}/${ACT}/adsets?fields=id,name,status,promoted_object,optimization_goal&limit=5`,
    { headers: auth },
  );
  const asRow = (adsets.json as { data?: Array<{ promoted_object?: { product_set_id?: string } }> })?.data?.[0];
  checks.push({
    name: "GET /{act}/adsets promoted_object.product_set_id",
    pass: adsets.status === 200 && !!asRow?.promoted_object?.product_set_id,
  });

  const ads = await req("GET", `/${V}/${ACT}/ads?fields=id,name,status,adset_id&limit=5`, { headers: auth });
  checks.push({
    name: "GET /{act}/ads",
    pass: ads.status === 200 && Array.isArray((ads.json as { data?: unknown[] })?.data),
  });

  const audiences = await req("GET", `/${V}/${ACT}/customaudiences?fields=id,name,subtype&limit=5`, {
    headers: auth,
  });
  checks.push({
    name: "GET /{act}/customaudiences",
    pass: audiences.status === 200 && Array.isArray((audiences.json as { data?: unknown[] })?.data),
  });

  const insights = await req(
    "GET",
    `/${V}/${ACT}/insights?fields=impressions,clicks,spend,actions,action_values,purchase_roas,campaign_id,ad_id,adset_id,account_currency&date_preset=last_7d&level=ad&time_increment=1&breakdowns=product_id&limit=5`,
    { headers: auth },
  );
  const irow = (insights.json as { data?: Array<Record<string, unknown>> })?.data?.[0];
  checks.push({
    name: "GET insights product breakdown",
    pass:
      insights.status === 200 &&
      !!irow &&
      typeof irow.spend === "string" &&
      Array.isArray(irow.actions) &&
      typeof irow.product_id === "string",
    detail: `product_id=${irow?.product_id}`,
  });

  const campId = campRows?.[0]?.id;
  if (campId) {
    const batch = await req("GET", `/${V}/?ids=${campId}&fields=objective,smart_promotion_type`, { headers: auth });
    checks.push({
      name: "GET /?ids= batch objectives",
      pass: batch.status === 200 && !!(batch.json as Record<string, { objective?: string }>)?.[campId]?.objective,
    });
  }

  // Mutate: create → update → delete campaign
  const created = await req("POST", `/${V}/${ACT}/campaigns`, {
    headers: { ...auth, "Content-Type": "application/json" },
    body: {
      name: "Sandbox Verify Campaign",
      objective: "OUTCOME_SALES",
      status: "PAUSED",
      smart_promotion_type: "AUTOMATED_SHOPPING_ADS",
      daily_budget: 50000,
    },
  });
  const newId = (created.json as { id?: string })?.id;
  checks.push({ name: "POST /{act}/campaigns create", pass: created.status === 200 && !!newId, detail: newId });

  if (newId) {
    const updated = await req("POST", `/${V}/${newId}`, {
      headers: { ...auth, "Content-Type": "application/json" },
      body: { status: "ACTIVE", name: "Sandbox Verify Campaign (updated)" },
    });
    checks.push({
      name: "POST /{id} update campaign",
      pass: updated.status === 200 && (updated.json as { success?: boolean })?.success === true,
    });

    const deleted = await req("DELETE", `/${V}/${newId}`, { headers: auth });
    checks.push({
      name: "DELETE /{id} soft-delete campaign",
      pass: deleted.status === 200 && (deleted.json as { success?: boolean })?.success === true,
    });
  }

  const batchPush = await req("POST", `/${V}/${CATALOG}/items_batch`, {
    headers: { ...auth, "Content-Type": "application/json" },
    body: {
      item_type: "PRODUCT_ITEM",
      requests: [
        {
          method: "UPDATE",
          retailer_id: `shop_${ACT.replace("act_", "")}_verify_1`,
          data: {
            name: "Verify Product",
            price: "999.00 INR",
            availability: "in stock",
            brand: "Sandbox",
            custom_label_0: "best-seller",
          },
        },
      ],
    },
  });
  checks.push({
    name: "POST /{catalog}/items_batch",
    pass: batchPush.status === 200 && Array.isArray((batchPush.json as { handles?: string[] })?.handles),
  });

  const tokenEx = await req(
    "GET",
    `/${V}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: APP_ID,
        client_secret: APP_SECRET,
        fb_exchange_token: TOKEN,
      }).toString(),
  );
  checks.push({
    name: "oauth fb_exchange_token",
    pass: tokenEx.status === 200 && (tokenEx.json as { access_token?: string })?.access_token === TOKEN,
  });

  const health = await req("GET", "/_dev/health");
  checks.push({ name: "GET /_dev/health", pass: health.status === 200 });

  let failed = 0;
  for (const c of checks) {
    const mark = c.pass ? "PASS" : "FAIL";
    if (!c.pass) failed++;
    console.log(`${mark}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
