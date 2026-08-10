/**
 * SQLite schema mirroring Meta Business Manager / Commerce Manager / Ads Manager entities.
 * Reset via `npm run reset` after schema changes (no live migrations).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  primary_page_id TEXT
);

CREATE TABLE IF NOT EXISTS ad_accounts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_status INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'INR',
  business_id TEXT NOT NULL,
  timezone_name TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  disable_reason INTEGER NOT NULL DEFAULT 0,
  amount_spent TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS catalogs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_id TEXT NOT NULL,
  vertical TEXT NOT NULL DEFAULT 'commerce',
  product_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id TEXT PRIMARY KEY,
  catalog_id TEXT NOT NULL,
  retailer_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  sale_price REAL,
  currency TEXT NOT NULL DEFAULT 'INR',
  availability TEXT NOT NULL DEFAULT 'in stock',
  condition TEXT NOT NULL DEFAULT 'new',
  brand TEXT,
  image_url TEXT,
  additional_image_urls TEXT,
  link TEXT,
  google_product_category TEXT,
  product_type TEXT,
  custom_label_0 TEXT,
  custom_label_1 TEXT,
  custom_label_2 TEXT,
  custom_label_3 TEXT,
  custom_label_4 TEXT,
  review_status TEXT NOT NULL DEFAULT 'approved',
  visibility TEXT NOT NULL DEFAULT 'published',
  errors_json TEXT,
  warnings_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_catalog ON catalog_products(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_status ON catalog_products(review_status);

CREATE TABLE IF NOT EXISTS product_sets (
  id TEXT PRIMARY KEY,
  catalog_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filter_json TEXT NOT NULL,
  product_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_sets_catalog ON product_sets(catalog_id);

CREATE TABLE IF NOT EXISTS product_set_members (
  product_set_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  PRIMARY KEY (product_set_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_feeds (
  id TEXT PRIMARY KEY,
  catalog_id TEXT NOT NULL,
  name TEXT NOT NULL,
  schedule_interval TEXT NOT NULL DEFAULT 'DAILY',
  schedule_url TEXT NOT NULL,
  latest_upload_status TEXT NOT NULL DEFAULT 'none',
  latest_upload_started_at TEXT,
  latest_upload_completed_at TEXT,
  products_added INTEGER NOT NULL DEFAULT 0,
  products_updated INTEGER NOT NULL DEFAULT 0,
  products_deleted INTEGER NOT NULL DEFAULT 0,
  products_with_errors INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalog_diagnostics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id TEXT NOT NULL,
  retailer_id TEXT,
  severity TEXT NOT NULL,
  error_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_catalog ON catalog_diagnostics(catalog_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_status TEXT NOT NULL DEFAULT 'ACTIVE',
  objective TEXT NOT NULL DEFAULT 'OUTCOME_SALES',
  buying_type TEXT NOT NULL DEFAULT 'AUCTION',
  smart_promotion_type TEXT,
  daily_budget REAL,
  lifetime_budget REAL,
  created_time TEXT NOT NULL,
  updated_time TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns(ad_account_id);

CREATE TABLE IF NOT EXISTS ad_sets (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_status TEXT NOT NULL DEFAULT 'ACTIVE',
  optimization_goal TEXT NOT NULL DEFAULT 'OFFSITE_CONVERSIONS',
  billing_event TEXT NOT NULL DEFAULT 'IMPRESSIONS',
  bid_strategy TEXT NOT NULL DEFAULT 'LOWEST_COST_WITHOUT_CAP',
  daily_budget REAL,
  product_set_id TEXT,
  catalog_id TEXT,
  targeting_json TEXT NOT NULL DEFAULT '{}',
  created_time TEXT NOT NULL,
  updated_time TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign ON ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_account ON ad_sets(ad_account_id);

CREATE TABLE IF NOT EXISTS ad_creatives (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  product_set_id TEXT,
  catalog_id TEXT,
  object_story_spec_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  adset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  effective_status TEXT NOT NULL DEFAULT 'ACTIVE',
  creative_id TEXT,
  product_set_id TEXT,
  created_time TEXT NOT NULL,
  updated_time TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ads_campaign ON ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_adset ON ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_ads_account ON ads(ad_account_id);

CREATE TABLE IF NOT EXISTS custom_audiences (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subtype TEXT NOT NULL DEFAULT 'CUSTOM',
  approximate_count INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'ready'
);

CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  date_start TEXT NOT NULL,
  date_end TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend REAL NOT NULL DEFAULT 0,
  purchases REAL NOT NULL DEFAULT 0,
  purchase_value REAL NOT NULL DEFAULT 0,
  account_currency TEXT NOT NULL DEFAULT 'INR'
);

CREATE INDEX IF NOT EXISTS idx_insights_account_date ON insights(ad_account_id, date_start);
CREATE INDEX IF NOT EXISTS idx_insights_campaign_date ON insights(campaign_id, date_start);
CREATE INDEX IF NOT EXISTS idx_insights_ad_date ON insights(ad_id, date_start);
CREATE INDEX IF NOT EXISTS idx_insights_product ON insights(product_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batch_handles (
  handle TEXT PRIMARY KEY,
  catalog_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'started'
);
`;
