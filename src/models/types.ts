/** Meta-aligned domain models for the sandbox (Graph / Marketing / Commerce). */

export type Business = {
  id: string;
  name: string;
  verificationStatus: "verified" | "not_verified" | "pending";
  primaryPageId: string | null;
};

export type AdAccount = {
  id: string;
  accountId: string;
  name: string;
  accountStatus: number;
  currency: string;
  businessId: string;
  timezoneName: string;
  disableReason: number;
  amountSpent: string;
};

export type Catalog = {
  id: string;
  name: string;
  businessId: string;
  vertical: "commerce" | "destinations" | "flights" | "home_listings" | "hotels" | "vehicles";
  productCount: number;
};

/** Meta Commerce product item — mirrors Catalog Item fields FeedGraph / Commerce Manager use. */
export type CatalogProduct = {
  id: string;
  catalogId: string;
  retailerId: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  currency: string;
  availability: "in stock" | "out of stock" | "available for order" | "discontinued";
  condition: "new" | "refurbished" | "used";
  brand: string;
  imageUrl: string;
  additionalImageUrls: string[];
  link: string;
  googleProductCategory: string;
  productType: string;
  customLabel0: string | null;
  customLabel1: string | null;
  customLabel2: string | null;
  customLabel3: string | null;
  customLabel4: string | null;
  /** Meta review / ingestion status */
  reviewStatus: "approved" | "pending" | "rejected" | "outdated";
  visibility: "published" | "staging" | "hidden";
  errorsJson: string | null;
  warningsJson: string | null;
};

export type ProductSet = {
  id: string;
  catalogId: string;
  name: string;
  filterJson: string;
  productCount: number;
};

export type ProductFeed = {
  id: string;
  catalogId: string;
  name: string;
  scheduleInterval: "HOURLY" | "DAILY" | "WEEKLY";
  scheduleUrl: string;
  latestUploadStatus: "success" | "failed" | "processing" | "none";
  latestUploadStartedAt: string | null;
  latestUploadCompletedAt: string | null;
  productsAdded: number;
  productsUpdated: number;
  productsDeleted: number;
  productsWithErrors: number;
};

export type CatalogDiagnostic = {
  id: number;
  catalogId: string;
  retailerId: string | null;
  severity: "error" | "warning" | "info";
  errorCode: string;
  title: string;
  description: string;
  affectedCount: number;
};

export type Campaign = {
  id: string;
  adAccountId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  effectiveStatus: string;
  objective: string;
  buyingType: "AUCTION" | "RESERVED";
  /** OUTCOME_SALES + smart_promotion_type = AUTOMATED_SHOPPING_ADS ≈ Advantage+ Shopping */
  smartPromotionType: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  createdTime: string;
  updatedTime: string;
};

export type AdSet = {
  id: string;
  adAccountId: string;
  campaignId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  effectiveStatus: string;
  optimizationGoal: string;
  billingEvent: string;
  bidStrategy: string;
  dailyBudget: number | null;
  /** promoted_object.product_set_id for DPA / Advantage+ catalog ads */
  productSetId: string | null;
  catalogId: string | null;
  targetingJson: string;
  createdTime: string;
  updatedTime: string;
};

export type Ad = {
  id: string;
  adAccountId: string;
  campaignId: string;
  adSetId: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  effectiveStatus: string;
  creativeId: string | null;
  productSetId: string | null;
  createdTime: string;
  updatedTime: string;
};

export type AdCreative = {
  id: string;
  adAccountId: string;
  name: string;
  productSetId: string | null;
  catalogId: string | null;
  objectStorySpecJson: string;
};

export type CustomAudience = {
  id: string;
  adAccountId: string;
  name: string;
  subtype: string;
  approximateCount: number;
  deliveryStatus: string;
};

export type InsightRow = {
  id: number;
  adAccountId: string;
  campaignId: string;
  campaignName: string;
  adSetId: string | null;
  adSetName: string | null;
  adId: string;
  adName: string;
  productId: string | null;
  productName: string | null;
  dateStart: string;
  dateEnd: string;
  impressions: number;
  clicks: number;
  spend: number;
  purchases: number;
  purchaseValue: number;
  accountCurrency: string;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
};
