const API = "/_dev/ui/api";

const views = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "adsets", label: "Ad sets" },
  { id: "catalog", label: "Catalog" },
  { id: "sets", label: "Product sets" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "audiences", label: "Audiences" },
  { id: "changes", label: "Change history" },
  { id: "api", label: "API verification" },
];

let active = "overview";

async function api(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function money(n, currency = "INR") {
  return `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

function badge(status) {
  const s = String(status || "").toLowerCase();
  let cls = "paused";
  if (s === "active" || s === "approved" || s === "published") cls = "active";
  if (s === "rejected" || s === "error") cls = "bad";
  return `<span class="badge ${cls}">${status || "—"}</span>`;
}

function renderNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = views
    .map((v) => `<button data-view="${v.id}" class="${v.id === active ? "active" : ""}">${v.label}</button>`)
    .join("");
  nav.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      active = btn.dataset.view;
      renderNav();
      render();
    });
  });
}

async function renderOverview() {
  const o = await api("/overview");
  return `
    <div class="grid">
      <div class="kpi"><div class="label">Spend</div><div class="value">${money(o.spend, o.currency)}</div></div>
      <div class="kpi"><div class="label">Revenue</div><div class="value">${money(o.revenue, o.currency)}</div></div>
      <div class="kpi"><div class="label">ROAS</div><div class="value">${o.roas}</div></div>
      <div class="kpi"><div class="label">Campaigns</div><div class="value">${o.campaigns}</div></div>
      <div class="kpi"><div class="label">Approved products</div><div class="value">${o.productsApproved}</div></div>
      <div class="kpi"><div class="label">Rejected / pending</div><div class="value">${o.productsRejected} / ${o.productsPending}</div></div>
    </div>
    <div class="panel">
      <h2>Business Manager · Commerce · Ads</h2>
      <table>
        <tr><th>Business</th><td>${o.business?.name || "—"} (${o.business?.id || "—"})</td></tr>
        <tr><th>Ad account</th><td>${o.accountId} · ${o.accountName}</td></tr>
        <tr><th>Catalog</th><td>${o.catalogId}</td></tr>
        <tr><th>Product sets</th><td>${o.productSets}</td></tr>
        <tr><th>Ad sets / ads</th><td>${o.adSets} / ${o.ads}</td></tr>
        <tr><th>Insight rows</th><td>${Number(o.insights || 0).toLocaleString()}</td></tr>
      </table>
    </div>`;
}

async function renderCampaigns() {
  const { data } = await api("/campaigns");
  const rows = data
    .map(
      (c) => `<tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>${badge(c.status)}</td>
        <td>${c.objective}</td>
        <td>${c.smartPromotionType || "—"}</td>
      </tr>`,
    )
    .join("");
  return `<div class="panel"><h2>Campaigns (${data.length})</h2>
    <table><thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Objective</th><th>smart_promotion_type</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function renderAdSets() {
  const { data } = await api("/adsets");
  const rows = data
    .map(
      (a) => `<tr>
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${badge(a.status)}</td>
        <td>${a.productSetId || "—"}</td>
        <td>${a.optimizationGoal}</td>
      </tr>`,
    )
    .join("");
  return `<div class="panel"><h2>Ad sets (${data.length})</h2>
    <table><thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Product set</th><th>Optimization</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function renderCatalog() {
  const { data, catalog } = await api("/products?limit=80");
  const rows = data
    .map(
      (p) => `<tr>
        <td>${p.retailerId}</td>
        <td>${p.name}</td>
        <td>${p.price} ${p.currency}</td>
        <td>${badge(p.reviewStatus)}</td>
        <td>${p.availability}</td>
        <td>${p.customLabel0 || "—"}</td>
      </tr>`,
    )
    .join("");
  return `
    <p class="muted">Catalog ${catalog?.id || "—"} · ${catalog?.name || ""} · vertical ${catalog?.vertical || "commerce"}</p>
    <div class="panel"><h2>Products (sample)</h2>
    <table><thead><tr><th>Retailer ID</th><th>Name</th><th>Price</th><th>Review</th><th>Availability</th><th>Label</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function renderSets() {
  const { data } = await api("/product-sets");
  const rows = data
    .map(
      (s) => `<tr>
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>${s.productCount}</td>
        <td><code>${s.filterJson}</code></td>
      </tr>`,
    )
    .join("");
  return `<div class="panel"><h2>Product sets</h2>
    <table><thead><tr><th>ID</th><th>Name</th><th>Count</th><th>Filter</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function renderDiagnostics() {
  const { data } = await api("/diagnostics");
  const rows = data
    .map(
      (d) => `<tr>
        <td>${badge(d.severity)}</td>
        <td>${d.errorCode}</td>
        <td>${d.title}</td>
        <td>${d.affectedCount}</td>
      </tr>`,
    )
    .join("");
  return `<div class="panel"><h2>Catalog diagnostics</h2>
    <table><thead><tr><th>Severity</th><th>Code</th><th>Title</th><th>Affected</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function renderAudiences() {
  const { data } = await api("/audiences");
  const rows = data
    .map(
      (a) => `<tr>
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${a.subtype}</td>
        <td>${Number(a.approximateCount).toLocaleString()}</td>
      </tr>`,
    )
    .join("");
  return `<div class="panel"><h2>Custom audiences</h2>
    <table><thead><tr><th>ID</th><th>Name</th><th>Subtype</th><th>Size</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

async function renderChanges() {
  const { data } = await api("/changes");
  const rows = data
    .map(
      (c) => `<tr>
        <td>${c.createdAt}</td>
        <td>${c.action}</td>
        <td>${c.entityType}</td>
        <td>${c.entityId}</td>
      </tr>`,
    )
    .join("");
  return `<div class="panel"><h2>Change history</h2>
    <table><thead><tr><th>When</th><th>Action</th><th>Type</th><th>Entity</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" class="muted">No changes yet</td></tr>`}</tbody></table></div>`;
}

async function renderApi() {
  const cfg = await api("/config");
  const act = cfg.adAccountId;
  const v = cfg.apiVersion;
  const token = cfg.accessToken;
  const checks = [
    { name: "me/businesses", path: `/${v}/me/businesses?fields=id,name,verification_status` },
    { name: "me/adaccounts", path: `/${v}/me/adaccounts?fields=id,name,account_id,account_status&limit=5` },
    { name: "campaigns Advantage+", path: `/${v}/${act}/campaigns?fields=id,name,objective,smart_promotion_type,status&limit=5` },
    { name: "adsets + promoted_object", path: `/${v}/${act}/adsets?fields=id,name,promoted_object,status&limit=3` },
    { name: "insights product_id", path: `/${v}/${act}/insights?fields=spend,ad_id,product_id&date_preset=last_7d&level=ad&time_increment=1&breakdowns=product_id&limit=3` },
    { name: "product_sets", path: `/${v}/${cfg.catalogId}/product_sets?fields=id,name,filter,product_count` },
    { name: "diagnostics", path: `/${v}/${cfg.catalogId}/diagnostic_insights` },
  ];
  const results = [];
  for (const c of checks) {
    const res = await fetch(c.path, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    results.push({ name: c.name, status: res.status, json });
  }
  return `<div class="panel"><h2>API verification (Graph paths FeedGraph / Commerce use)</h2>
    <pre>${JSON.stringify(results, null, 2)}</pre></div>`;
}

async function render() {
  const app = document.getElementById("app");
  app.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const map = {
      overview: renderOverview,
      campaigns: renderCampaigns,
      adsets: renderAdSets,
      catalog: renderCatalog,
      sets: renderSets,
      diagnostics: renderDiagnostics,
      audiences: renderAudiences,
      changes: renderChanges,
      api: renderApi,
    };
    app.innerHTML = await (map[active] || renderOverview)();
  } catch (e) {
    app.innerHTML = `<p class="err">${e.message}</p>`;
  }
}

renderNav();
render();
