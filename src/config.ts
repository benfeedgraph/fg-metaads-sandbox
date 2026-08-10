import path from "node:path";

/** Numeric ad account id (without act_ prefix). */
const defaultAccountNumeric = "1000000001";

export const config = {
  port: Number(process.env.PORT || 4790),
  /** Meta Graph API version path segment — must match FeedGraph META_GRAPH_VERSION. */
  apiVersion: process.env.META_GRAPH_VERSION || process.env.API_VERSION || "v19.0",
  /** Full Graph node id: act_<numeric> */
  adAccountId: normalizeActId(process.env.SANDBOX_AD_ACCOUNT_ID || `act_${defaultAccountNumeric}`),
  accountNumeric: (process.env.SANDBOX_AD_ACCOUNT_ID || defaultAccountNumeric).replace(/^act_/, "").replace(/\D/g, "") || defaultAccountNumeric,
  accountName: process.env.SANDBOX_AD_ACCOUNT_NAME || "FeedGraph Sandbox Meta Store",
  catalogId: process.env.SANDBOX_CATALOG_ID || "2000000001",
  catalogName: process.env.SANDBOX_CATALOG_NAME || "FeedGraph Sandbox Catalog",
  currency: (process.env.SANDBOX_CURRENCY || "INR").toUpperCase(),
  accessToken: process.env.SANDBOX_ACCESS_TOKEN || "sandbox-access-token",
  appId: process.env.SANDBOX_META_APP_ID || "sandbox-app-id",
  appSecret: process.env.SANDBOX_META_APP_SECRET || "sandbox-app-secret",
  userId: process.env.SANDBOX_USER_ID || "9000000001",
  userName: process.env.SANDBOX_USER_NAME || "FeedGraph Sandbox User",
  userEmail: process.env.SANDBOX_USER_EMAIL || "sandbox@feedgraph.local",
  dataDir: process.env.DATA_DIR || "./data",
  dbPath: process.env.DB_PATH || "./data/sandbox.db",
  productCount: Number(process.env.PRODUCT_COUNT || 2000),
  campaignCount: Number(process.env.CAMPAIGN_COUNT || 40),
  insightDays: Number(process.env.INSIGHT_DAYS || 90),
  /** Non-Meta dev routes at /_dev (disable for strict graph-only surface). */
  devRoutes: process.env.SANDBOX_DEV_ROUTES !== "false",
};

export function normalizeActId(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return `act_${defaultAccountNumeric}`;
  return s.startsWith("act_") ? s : `act_${s.replace(/^act_/, "")}`;
}

export function resolveDbPath(): string {
  return path.isAbsolute(config.dbPath) ? config.dbPath : path.resolve(process.cwd(), config.dbPath);
}

export function publicBaseUrl(): string {
  return `http://localhost:${config.port}`;
}
