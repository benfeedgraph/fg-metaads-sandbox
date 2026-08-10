import { config } from "../config.js";

/** Documented Graph paths that mirror graph.facebook.com — used by /_dev/info and verify. */
export const META_GRAPH_API_PATHS = {
  oauthAccessToken: `/${config.apiVersion}/oauth/access_token`,
  me: `/${config.apiVersion}/me`,
  meBusinesses: `/${config.apiVersion}/me/businesses`,
  meAdAccounts: `/${config.apiVersion}/me/adaccounts`,
  meCatalogs: `/${config.apiVersion}/me/owned_product_catalogs`,
  adAccountInsights: `/${config.apiVersion}/{act_XXX}/insights`,
  adAccountCampaigns: `/${config.apiVersion}/{act_XXX}/campaigns`,
  adAccountAdSets: `/${config.apiVersion}/{act_XXX}/adsets`,
  adAccountAds: `/${config.apiVersion}/{act_XXX}/ads`,
  adAccountAudiences: `/${config.apiVersion}/{act_XXX}/customaudiences`,
  campaignInsights: `/${config.apiVersion}/{campaignId}/insights`,
  catalogProducts: `/${config.apiVersion}/{catalogId}/products`,
  catalogProductSets: `/${config.apiVersion}/{catalogId}/product_sets`,
  catalogProductFeeds: `/${config.apiVersion}/{catalogId}/product_feeds`,
  catalogDiagnostics: `/${config.apiVersion}/{catalogId}/diagnostic_insights`,
  itemsBatch: `/${config.apiVersion}/{catalogId}/items_batch`,
  productSetProducts: `/${config.apiVersion}/{productSetId}/products`,
  batchIds: `/${config.apiVersion}/?ids=...&fields=objective`,
  nodeUpdate: `/${config.apiVersion}/{id}` + " (POST mutate / DELETE)",
} as const;

export const META_GRAPH_DOC_LINKS = {
  graphApi: "https://developers.facebook.com/docs/graph-api",
  marketingApi: "https://developers.facebook.com/docs/marketing-api",
  insights: "https://developers.facebook.com/docs/marketing-api/insights",
  catalog: "https://developers.facebook.com/docs/marketing-api/catalog",
  advantagePlus: "https://developers.facebook.com/docs/marketing-api/advantage-shopping-campaigns",
  commerce: "https://developers.facebook.com/docs/commerce-platform",
};
