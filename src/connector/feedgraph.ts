/**
 * FeedGraph Meta Ads Sandbox Connector — CANONICAL CONTRACT
 *
 * Single source of truth for the live↔sandbox switch shared by both repos.
 * FeedGraph's runtime implementation lives at
 * `feedgraph/server/meta-ads-sandbox-connector.ts` and MUST stay aligned with
 * the env-var names and defaults declared here.
 */

export type MetaAdsEnvironment = "live" | "sandbox";

export type MetaSandboxConnectorConfig = {
  environment: MetaAdsEnvironment;
  sandboxBaseUrl: string;
  sandboxAccessToken: string;
  sandboxAdAccountId: string;
  sandboxCatalogId: string;
  sandboxAppId: string;
  sandboxAppSecret: string;
  graphVersion: string;
};

export const DEFAULT_META_SANDBOX_CONFIG: MetaSandboxConnectorConfig = {
  environment: "sandbox",
  sandboxBaseUrl: "http://localhost:4790",
  sandboxAccessToken: "sandbox-access-token",
  sandboxAdAccountId: "act_1000000001",
  sandboxCatalogId: "2000000001",
  sandboxAppId: "sandbox-app-id",
  sandboxAppSecret: "sandbox-app-secret",
  graphVersion: "v19.0",
};

export function loadMetaConnectorConfigFromEnv(): MetaSandboxConnectorConfig {
  const env = (process.env.META_ADS_ENVIRONMENT || "live").toLowerCase();
  const rawAct = process.env.SANDBOX_AD_ACCOUNT_ID || "act_1000000001";
  const adAccountId = rawAct.startsWith("act_") ? rawAct : `act_${rawAct}`;
  return {
    environment: env === "sandbox" ? "sandbox" : "live",
    sandboxBaseUrl: (process.env.META_SANDBOX_URL || "http://localhost:4790").replace(/\/$/, ""),
    sandboxAccessToken: process.env.SANDBOX_ACCESS_TOKEN || "sandbox-access-token",
    sandboxAdAccountId: adAccountId,
    sandboxCatalogId: process.env.SANDBOX_CATALOG_ID || "2000000001",
    sandboxAppId: process.env.SANDBOX_META_APP_ID || process.env.META_APP_ID || "sandbox-app-id",
    sandboxAppSecret:
      process.env.SANDBOX_META_APP_SECRET || process.env.META_APP_SECRET || "sandbox-app-secret",
    graphVersion: process.env.META_GRAPH_VERSION || "v19.0",
  };
}

export function isMetaSandboxMode(
  config: MetaSandboxConnectorConfig = loadMetaConnectorConfigFromEnv(),
): boolean {
  return config.environment === "sandbox";
}

/** Build the Graph API origin for the current environment. */
export function metaGraphApiOrigin(
  config: MetaSandboxConnectorConfig = loadMetaConnectorConfigFromEnv(),
): string {
  if (isMetaSandboxMode(config)) return config.sandboxBaseUrl;
  return "https://graph.facebook.com";
}

/** Facebook OAuth dialog origin (sandbox has no real dialog — use connect-sandbox). */
export function metaOAuthDialogOrigin(
  config: MetaSandboxConnectorConfig = loadMetaConnectorConfigFromEnv(),
): string {
  if (isMetaSandboxMode(config)) return config.sandboxBaseUrl;
  return "https://www.facebook.com";
}

export function metaGraphEndpoint(
  path: string,
  config: MetaSandboxConnectorConfig = loadMetaConnectorConfigFromEnv(),
): string {
  const base = metaGraphApiOrigin(config);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function metaRequestHeaders(
  opts: { accessToken?: string },
  config: MetaSandboxConnectorConfig = loadMetaConnectorConfigFromEnv(),
): Record<string, string> {
  const token = isMetaSandboxMode(config) ? config.sandboxAccessToken : opts.accessToken || "";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Integration patch for FeedGraph:
 *
 * 1. Add to .env:
 *    META_ADS_ENVIRONMENT=sandbox
 *    META_SANDBOX_URL=http://localhost:4790
 *    META_GRAPH_VERSION=v19.0
 *    SANDBOX_ACCESS_TOKEN=sandbox-access-token
 *    SANDBOX_AD_ACCOUNT_ID=act_1000000001
 *    SANDBOX_CATALOG_ID=2000000001
 *
 * 2. Replace hardcoded graph.facebook.com URLs with metaGraphApiOrigin().
 *
 * 3. Skip Facebook OAuth when sandbox — POST /api/meta/connect-sandbox.
 */
export const FEEDGRAPH_INTEGRATION_NOTES = `
See feedgraph/server/meta-ads-sandbox-connector.ts and sandbox-meta/README.md.
`.trim();
