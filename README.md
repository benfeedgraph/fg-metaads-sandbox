# FeedGraph Meta Ads & Commerce Sandbox

This repository exists **solely to support FeedGraph development and testing**.

It is **not** a standalone product.

It is a **Meta Commerce + Meta Ads simulation environment** that lets FeedGraph be developed, tested, and validated **without live client accounts or production Meta Business accounts**.

---

## Critical requirement

The sandbox must stay as close as practical to the real Meta Commerce and Meta Ads ecosystem.

The goal is **not** dummy data for its own sake.

The goal is to simulate Meta’s **platform architecture, business logic, and API behaviour** so FeedGraph can move from sandbox → live Meta with **minimal or no application changes**.

| Same | Different |
|------|-----------|
| Workflows | Data source |
| API contracts | Host (`localhost` vs `graph.facebook.com`) |
| Request / response shapes | Credentials (`sandbox-access-token` vs real OAuth) |
| Business logic (statuses, product sets, Advantage+, insights) | |

Point FeedGraph at `http://localhost:4790` instead of `https://graph.facebook.com`.

---

## What is simulated

### Business Manager
- Business node (`/me/businesses`)
- Owned ad accounts + catalogs

### Commerce Manager
- Product catalogs (vertical, product_count)
- Catalog products with Meta fields: `retailer_id`, `price` (`"AMOUNT CURRENCY"`), availability, brand, labels, `review_status`, `visibility`, errors/warnings
- **Product sets** (filter-based) + `/product_sets` + `/{setId}/products`
- **Product feeds** (scheduled upload status)
- **Catalog diagnostics** (`diagnostic_insights`, check batch status)
- **`items_batch`** CREATE / UPDATE / DELETE with `handles` + `validation_status`

### Ads Manager / Marketing API
- Campaigns (incl. **Advantage+ Shopping** via `smart_promotion_type=AUTOMATED_SHOPPING_ADS`)
- Ad sets with `promoted_object.product_set_id` (DPA / catalog ads)
- Ads + creatives (template / product set linkage)
- Custom audiences
- Insights API: `date_preset`, `level`, `time_increment`, `breakdowns=product_id`
- Mutate: create / update / soft-delete campaigns, ad sets, ads, product sets

### Graph behaviour
- Meta error envelope `{ error: { message, type, code, fbtrace_id } }`
- Bearer **or** `access_token` query/body
- Cursor pagination with `paging.next` absolute URLs

---

## Quick start

```bash
npm install
npm run reset    # Wipe + seed Business Manager / Commerce / Ads hierarchy
npm run dev      # http://localhost:4790
```

```bash
npm run verify:api   # Graph / Commerce / Ads compliance checks
open http://localhost:4790/_dev/ui
```

---

## FeedGraph integration

### 1. Start sandbox

```bash
cd sandbox-meta
npm run reset && npm run dev
```

### 2. FeedGraph `.env`

```env
META_ADS_ENVIRONMENT=sandbox
META_SANDBOX_URL=http://localhost:4790
META_GRAPH_VERSION=v19.0
SANDBOX_ACCESS_TOKEN=sandbox-access-token
SANDBOX_AD_ACCOUNT_ID=act_1000000001
SANDBOX_CATALOG_ID=2000000001
SANDBOX_META_APP_ID=sandbox-app-id
SANDBOX_META_APP_SECRET=sandbox-app-secret
```

Restart FeedGraph. **Connect Meta Ads** uses `POST /api/meta/connect-sandbox` (no Facebook OAuth).

### 3. Go live later

Set `META_ADS_ENVIRONMENT=live` and use real Meta app credentials.  
FeedGraph keeps the **same Graph paths and payloads** — only origin + tokens change.

---

## Default seed identities

| Entity | Id |
|--------|-----|
| Business | `8000000001` |
| Ad account | `act_1000000001` |
| Catalog | `2000000001` |
| Product sets | `6000000001`… (All / Best Sellers / In Stock / …) |
| Primary feed | `7000000001` |
| Products | `shop_1000000001_{n}` (`retailer_id` / insight `product_id`) |

Align FeedGraph `products.merchantId` with sandbox `retailer_id` for product-level ROAS.

---

## Graph surface (production-shaped)

| Method | Path |
|--------|------|
| GET | `/v19.0/oauth/access_token` |
| GET | `/v19.0/me`, `/me/businesses`, `/me/adaccounts`, `/me/owned_product_catalogs` |
| GET | `/v19.0/?ids=…&fields=objective` |
| GET/POST | `/v19.0/{act}/campaigns`, `/adsets`, `/ads` |
| GET | `/v19.0/{act}/customaudiences` |
| GET | `/v19.0/{act\|campaign\|adset\|ad}/insights` |
| GET/POST | `/v19.0/{catalog}/product_sets` |
| GET | `/v19.0/{catalog}/products`, `/product_feeds`, `/diagnostic_insights` |
| GET | `/v19.0/{catalog}/check_batch_request_status` (diagnostics + error/warning/info summary) |
| POST | `/v19.0/{catalog}/items_batch` |
| GET | `/v19.0/{productSet}/products` |
| POST/DELETE | `/v19.0/{id}` (node mutate / soft-delete) |

---

## Dev surface (`/_dev` — not Meta)

Mounted when `SANDBOX_DEV_ROUTES` is enabled (default). Set `SANDBOX_DEV_ROUTES=false` for a strict Graph-only surface.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_dev/` | Sandbox metadata + stats as JSON (`Accept: application/json`); redirects browsers to `/_dev/ui` |
| GET | `/_dev/health` | Health check |
| GET | `/_dev/info` | Sandbox metadata, connector config, implemented Graph endpoints |
| GET | `/_dev/catalog-image` | SVG placeholder product image (`?id=`, `?size=` 40–800, default 80) |
| GET | `/_dev/ui` | Meta-style web console |

### Dev UI data API (`/_dev/ui/api` — used by the console)

| Endpoint | Returns |
|----------|---------|
| `GET /_dev/ui/api/overview` | Account/catalog identity, business node, overview stats |
| `GET /_dev/ui/api/campaigns` | Campaigns for the sandbox ad account |
| `GET /_dev/ui/api/adsets` | Ad sets |
| `GET /_dev/ui/api/ads` | Ads |
| `GET /_dev/ui/api/product-sets` | Product sets for the sandbox catalog |
| `GET /_dev/ui/api/feeds` | Product feeds |
| `GET /_dev/ui/api/diagnostics` | Catalog diagnostics |
| `GET /_dev/ui/api/audiences` | Custom audiences |
| `GET /_dev/ui/api/products` | Catalog products (`?q=` search, `?status=` review status, `?limit=` max 200) |
| `GET /_dev/ui/api/changes` | Audit log (last 100 changes) |
| `GET /_dev/ui/api/config` | Active sandbox config (API version, account, catalog, token, port) |

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4790 | Server port |
| `META_GRAPH_VERSION` | v19.0 | Graph API version path segment (`API_VERSION` also accepted); must match FeedGraph |
| `SANDBOX_AD_ACCOUNT_ID` | act_1000000001 | Ad account id (`act_` prefix added if omitted) |
| `SANDBOX_AD_ACCOUNT_NAME` | FeedGraph Sandbox Meta Store | Ad account display name |
| `SANDBOX_CATALOG_ID` | 2000000001 | Product catalog id |
| `SANDBOX_CATALOG_NAME` | FeedGraph Sandbox Catalog | Catalog display name |
| `SANDBOX_CURRENCY` | INR | Account currency (uppercased) |
| `SANDBOX_ACCESS_TOKEN` | sandbox-access-token | Accepted Bearer / `access_token` value |
| `SANDBOX_META_APP_ID` | sandbox-app-id | Accepted app id |
| `SANDBOX_META_APP_SECRET` | sandbox-app-secret | Accepted app secret |
| `SANDBOX_USER_ID` | 9000000001 | `/me` user id |
| `SANDBOX_USER_NAME` | FeedGraph Sandbox User | `/me` user name |
| `SANDBOX_USER_EMAIL` | sandbox@feedgraph.local | `/me` user email |
| `PRODUCT_COUNT` | 2000 | Catalog products to generate on seed |
| `CAMPAIGN_COUNT` | 40 | Campaigns to generate on seed |
| `INSIGHT_DAYS` | 90 | Days of insight history to generate |
| `DATA_DIR` | ./data | Data directory |
| `DB_PATH` | ./data/sandbox.db | SQLite database path |
| `SANDBOX_DEV_ROUTES` | true | Set to `false` to disable `/_dev` (Graph API only) |

---

## Design principle

> Same workflows · Same API contracts · Same request/response structures · Same business logic · **Different data source.**
# fg-meta
# fg-metaads-sandbox
