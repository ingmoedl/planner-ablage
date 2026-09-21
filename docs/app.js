/* Planner-Ablage – Formular "Aufgabe in Planner" (ing Burghausen GmbH)
 * Läuft in der WebView2-Hülle (Drop-Punkt) oder eigenständig im Browser.
 * Legt die abgelegte Datei im SharePoint des Jahres-Teams ab (Projektordner des Plans) und
 * erstellt die Planner-Aufgabe mit der Datei als Anlage (Referenz). Auth: MSAL.js, Redirect-Flow.
 * Abgeleitet vom Planner-Knopf v2.1 (Outlook-Add-in); Plan-, Bucket- und Personenlogik identisch.
 * v0.1: erster Stand. */

"use strict";

const CONFIG = {
  version: "0.2",
  // App-Registrierung "Planner-Ablage" (eigene App, NICHT der Planner-Knopf), angelegt 18.09.2026.
  // ?client=<id>&scopes=knopf erlaubt Zwischentests mit einer anderen App.
  clientId: "239b6012-5d61-4e37-9041-75b0218e6a09",
  tenantId: "1571141a-75a9-43a3-ad47-8d613cfbb3e6",
  scopes: ["User.Read", "User.ReadBasic.All", "Tasks.ReadWrite", "Files.ReadWrite.All"],
  graph: "https://graph.microsoft.com/v1.0",
  plannerWeb: "https://planner.cloud.microsoft/webui/plan/",
  uploadSubfolder: "",            // "" = direkt in den Projektordner; z. B. "01 Kom" für einen Unterordner
  smallUploadLimit: 4 * 1024 * 1024,
  chunkSize: 5 * 1024 * 1024,     // Vielfaches von 320 KiB
  planCacheKey: "pa_plans_v1",
  peopleCacheKey: "pa_people_v1",
  bucketCachePrefix: "pa_buckets_v1_",
  folderCachePrefix: "pa_folders_v1_",
  lastBucketPrefix: "pa_lastbucket_",
  cacheTtlMs: 6 * 60 * 60 * 1000,
  internalDomain: "ing-burghausen.de",
  personNamePattern: /^[^,]+,\s*\S+/,
  maxListRows: 500,
};

let pca = null;
let plans = [];            // [{id, title, owner}]  owner = Gruppen-ID des Teams
let people = [];
let buckets = [];
let myGroups = null;
let groupsError = null;
let plansReady = null;
let bucketsReady = null;
let selectedPlan = null;
let selectedPerson = null;
let files = [];            // [{name, size, blob|url, path}]
let canUpload = true;
const inHost = !!(window.chrome && window.chrome.webview);
const el = (id) => document.getElementById(id);

/* ---------- Boot ---------- */

async function boot() {
  try {
    applyQueryOverrides();
    canUpload = CONFIG.scopes.some((s) => /^(Files|Sites)\.ReadWrite/.test(s));
    wireUi();
    wireHost();
    el("version").textContent = "Planner-Ablage v" + CONFIG.version + (canUpload ? "" : " · Testmodus ohne Upload");
    if (inHost) el("cancel").style.display = "";

    if (!CONFIG.clientId) {
      showStatus("Noch keine App-Registrierung hinterlegt (CONFIG.clientId). Formular lässt sich ansehen, aber nicht anmelden.", "err");
      el("plan").placeholder = "Anmeldung nicht möglich";
      return;
    }

    pca = await msal.PublicClientApplication.createPublicClientApplication({
      auth: {
        clientId: CONFIG.clientId,
        authority: "https://login.microsoftonline.com/" + CONFIG.tenantId,
        redirectUri: window.location.origin + window.location.pathname,
        navigateToLoginRequestUrl: true,
      },
      cache: { cacheLocation: "localStorage" }, // jedes Formularfenster ist ein neuer Tab → Cache muss überleben
    });
    try {
      const rr = await pca.handleRedirectPromise();
      if (rr && rr.account) pca.setActiveAccount(rr.account);
    } catch (e) { console.warn("[PA] handleRedirectPromise:", msg(e)); }

    const token = await silentToken(8000);
    if (token) afterAuth();
    else {
      el("login").style.display = "block";
      el("plan").placeholder = "Bitte zuerst anmelden (Knopf oben)";
    }
  } catch (e) {
    showStatus("Startfehler: " + msg(e), "err");
  }
}

/* Nur für Zwischentests: ?client=<id>&scopes=knopf nutzt eine andere App (z. B. den Planner-Knopf ohne Upload). */
function applyQueryOverrides() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("client")) CONFIG.clientId = q.get("client");
  if (q.get("scopes") === "knopf") CONFIG.scopes = ["User.Read", "User.ReadBasic.All", "Tasks.ReadWrite", "Mail.ReadWrite"];
  const saved = localStorage.getItem("pa_override");
  if (q.get("client")) localStorage.setItem("pa_override", JSON.stringify({ client: CONFIG.clientId, scopes: CONFIG.scopes }));
  else if (saved && !CONFIG.clientId) { try { const o = JSON.parse(saved); CONFIG.clientId = o.client; CONFIG.scopes = o.scopes; } catch (_) {} }
  if (q.get("reset") === "1") localStorage.removeItem("pa_override");
}

/* ---------- Verbindung zur Hülle ---------- */

function wireHost() {
  if (!inHost) return;
  window.chrome.webview.addEventListener("message", async (ev) => {
    const m = ev.data || {};
    if (m.type === "files" && Array.isArray(m.files)) {
      // Die Hülle schickt die Liste mehrfach: sofort (Kopie läuft noch) und je fertiger Datei erneut.
      for (const f of m.files) {
        let entry = files.find((x) => x.fromHost && x.name === f.name && x.path === (f.path || ""));
        if (!entry) {
          entry = { name: f.name, size: f.size || 0, url: "", path: f.path || "", ok: null, ready: false, fromHost: true };
          files.push(entry);
        }
        if (f.size) entry.size = f.size;
        if (f.error) { entry.ready = true; entry.ok = false; entry.error = f.error; }
        else if (f.ready && f.url && !entry.ready) { entry.ready = true; entry.url = f.url; verifyFile(entry); }
      }
      renderFiles();
      prefillFromFiles();
    }
  });
  window.chrome.webview.postMessage({ type: "ready" });
}

function hostPost(obj) { if (inHost) window.chrome.webview.postMessage(obj); }
function diag(text) { console.log("[PA] " + text); hostPost({ type: "log", text: text }); }

async function verifyFile(f) {
  try {
    const b = await fileBlob(f);
    f.blob = b;                       // einmal gelesen, für den Upload merken
    f.ok = !f.size || b.size === f.size;
    if (f.ok && !f.size) f.size = b.size;
  } catch (e) {
    f.ok = false;
    hostPost({ type: "log", text: "Datei nicht lesbar: " + f.name + " – " + msg(e) });
  }
  renderFiles();
}

/* ---------- Anlagen ---------- */

function renderFiles() {
  const ul = el("files");
  ul.innerHTML = "";
  files.forEach((f, i) => {
    const li = document.createElement("li");
    const state = f.ok === false ? ' <span style="color:var(--err)">⚠ nicht lesbar</span>'
      : (f.ok === true ? ' <span style="color:var(--ok)">✓</span>'
      : (f.fromHost && !f.ready ? ' <span>wird übernommen …</span>' : ""));
    li.innerHTML = '<span class="name" title="' + esc(f.name) + '">📎 ' + esc(f.name) + '</span><span class="size">' + fmtSize(f.size) + state + '</span><button class="rm" title="Entfernen">×</button>';
    li.querySelector(".rm").addEventListener("click", () => { files.splice(i, 1); renderFiles(); });
    ul.appendChild(li);
  });
  el("dropzone").classList.toggle("hasfiles", files.length > 0);
  el("dropempty").style.display = files.length ? "none" : "";
  el("dropmore").style.display = files.length ? "" : "none";
}

function prefillFromFiles() {
  if (!files.length) return;
  if (!el("title").value.trim()) el("title").value = titleFromName(files[0].name);
  if (plans.length) detectProject();
  else if (plansReady) plansReady.then(() => detectProject());
}

function titleFromName(name) {
  let t = name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  t = t.replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return t || name;
}

function wireDropzone() {
  const dz = el("dropzone");
  ["dragenter", "dragover"].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); if (t === "dragleave" && e.relatedTarget) return; dz.classList.remove("over"); }));
  document.addEventListener("drop", (e) => {
    const list = e.dataTransfer && e.dataTransfer.files ? [...e.dataTransfer.files] : [];
    for (const f of list) {
      if (files.some((x) => x.name === f.name && x.size === f.size)) continue;
      files.push({ name: f.name, size: f.size, blob: f, path: "", ok: true, ready: true });
    }
    if (list.length) { renderFiles(); prefillFromFiles(); }
  });
}

async function fileBlob(f) {
  if (f.blob) return f.blob;
  const res = await fetch(f.url);
  if (!res.ok) throw new Error("Datei konnte nicht gelesen werden (" + res.status + "): " + f.name);
  return await res.blob();
}

/* ---------- Auth ---------- */

async function silentToken(timeoutMs) {
  const account = pca.getActiveAccount() || pca.getAllAccounts()[0];
  if (!account) return null;
  const attempt = pca.acquireTokenSilent({ scopes: CONFIG.scopes, account }).then((r) => { pca.setActiveAccount(r.account); return r.accessToken; });
  const timeout = new Promise((res) => setTimeout(() => res(null), timeoutMs || 8000));
  try { return await Promise.race([attempt, timeout]); } catch (e) { console.warn("[PA] silent:", msg(e)); return null; }
}

async function interactiveToken() {
  // Redirect-Flow: die ganze Seite geht zur Anmeldung und kommt zurück (Popups sind in WebView2 unpraktisch).
  await pca.acquireTokenRedirect({ scopes: CONFIG.scopes });
  return new Promise(() => {});
}

async function getToken() {
  const t = await silentToken(15000);
  if (t) return t;
  el("login").style.display = "block";
  throw new Error("Anmeldung erforderlich – bitte oben auf 'Bei Microsoft anmelden' klicken.");
}

function myAccount() { return pca.getActiveAccount() || pca.getAllAccounts()[0] || null; }

function afterAuth() {
  el("login").style.display = "none";
  plansReady = loadPlans();
  loadPeople();
  const acct = myAccount();
  if (acct && !selectedPerson) {
    selectedPerson = { id: acct.idTokenClaims && acct.idTokenClaims.oid, name: acct.name || "Ich" };
    el("assign").value = selectedPerson.name;
  }
}

/* ---------- Graph ---------- */

async function graph(path, opts = {}, retry = true, progress = null) {
  if (progress) progress("Token");
  const token = await getToken();
  if (progress) progress("Abruf");
  const headers = { Authorization: "Bearer " + token };
  if (!(opts.body instanceof Blob)) headers["Content-Type"] = "application/json";
  Object.assign(headers, opts.headers || {});
  const url = /^https?:/.test(path) ? path : CONFIG.graph + path;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 429 && retry) {
    const wait = parseInt(res.headers.get("Retry-After") || "2", 10) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return graph(path, opts, false);
  }
  return res;
}

async function graphAll(path, opts = {}, progress = null) {
  const out = [];
  let url = path;
  while (url) {
    const res = await graph(url, opts, true, progress);
    if (!res.ok) throw new Error("Graph " + res.status + " bei " + path.split("?")[0]);
    const j = await res.json();
    out.push(...(j.value || []));
    url = j["@odata.nextLink"] ? j["@odata.nextLink"].replace(CONFIG.graph, "") : null;
  }
  return out;
}

/* ---------- Pläne (wie Planner-Knopf: /me/planner/plans + alle Gruppen per $batch) ---------- */

async function loadPlans() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG.planCacheKey) || "null");
    if (cached && Array.isArray(cached.plans) && cached.plans.length) {
      plans = cached.plans;
      myGroups = Array.isArray(cached.groups) ? cached.groups : null;
      groupsError = cached.groupsError || null;
      renderPlanInfo();
      el("plan").placeholder = "Projektnummer oder Name tippen …";
      detectProject();
      if (Date.now() - cached.ts < CONFIG.cacheTtlMs) { refreshPlans().catch(() => {}); return; }
    }
    await refreshPlans();
    el("plan").placeholder = "Projektnummer oder Name tippen …";
  } catch (e) {
    console.error("[PA] loadPlans:", e);
    if (!plans.length) {
      el("plan").placeholder = "Laden fehlgeschlagen";
      showStatus("Pläne konnten nicht geladen werden: " + msg(e), "err");
    }
  }
}

async function refreshPlans() {
  const setPh = (step) => { el("plan").placeholder = "Pläne werden geladen … (" + step + ")"; };
  setPh("Anmeldung");
  const byId = new Map();
  const add = (p, gid) => {
    if (!p || !p.id) return;
    const owner = p.owner || (p.container && p.container.containerId) || gid || "";
    if (!byId.has(p.id)) byId.set(p.id, { id: p.id, title: p.title || "", owner });
    else if (!byId.get(p.id).owner && owner) byId.get(p.id).owner = owner;
  };
  let firstError = null;

  try { (await graphAll("/me/planner/plans", {}, setPh)).forEach((p) => add(p, "")); }
  catch (e) { console.warn("[PA] /me/planner/plans:", msg(e)); firstError = e; }

  let groups = [], groupsOk = false;
  try { groups = await loadMyGroups(setPh); groupsOk = true; }
  catch (e) { console.warn("[PA] memberOf:", msg(e)); myGroups = null; groupsError = msg(e); firstError = firstError || e; }

  const stats = groups.map((g) => ({ id: g.id, name: g.name || "", plans: 0, years: {} }));
  const note = (st, p) => { st.plans++; const m = /^(\d{2})\d{3}/.exec(p.title || ""); if (m) st.years[m[1]] = (st.years[m[1]] || 0) + 1; };
  let done = 0;
  for (let i = 0; i < groups.length; i += 20) {
    const chunk = groups.slice(i, i + 20);
    setPh("Teams " + done + "/" + groups.length);
    const batch = { requests: chunk.map((g, k) => ({ id: String(k), method: "GET", url: "/groups/" + g.id + "/planner/plans" })) };
    try {
      const res = await graph("/$batch", { method: "POST", body: JSON.stringify(batch) });
      if (!res.ok) throw new Error("Graph " + res.status + " beim Batch-Abruf der Team-Pläne");
      const j = await res.json();
      for (const r of (j.responses || [])) {
        if (r.status !== 200 || !r.body) continue;
        const idx = i + parseInt(r.id, 10);
        const st = stats[idx];
        const gid = groups[idx] ? groups[idx].id : "";
        let list = r.body.value || [];
        if (r.body["@odata.nextLink"]) { try { list = list.concat(await graphAll(r.body["@odata.nextLink"].replace(CONFIG.graph, ""))); } catch (_) {} }
        list.forEach((p) => { add(p, gid); if (st) note(st, p); });
      }
    } catch (e) { console.warn("[PA] Batch:", msg(e)); firstError = firstError || e; }
    done += chunk.length;
  }
  if (groupsOk) { myGroups = stats.map((st) => ({ id: st.id, plans: st.plans, label: groupLabel(st) })); groupsError = null; }

  const acc = [...byId.values()];
  if (!acc.length && firstError) throw firstError;
  acc.sort((a, b) => b.title.localeCompare(a.title, "de"));
  plans = acc;
  console.log("[PA] Pläne gesamt:", plans.length);
  localStorage.setItem(CONFIG.planCacheKey, JSON.stringify({ ts: Date.now(), plans, groups: myGroups, groupsError }));
  renderPlanInfo();
  detectProject();
}

function groupLabel(st) {
  if (st.name) return st.name;
  const years = Object.keys(st.years).sort((a, b) => st.years[b] - st.years[a]);
  if (!years.length) return st.plans ? "Sonstige" : "";
  const top = years[0];
  return (st.years[top] >= st.plans * 0.5) ? "20" + top : "gemischt";
}

function renderPlanInfo() {
  const info = el("planinfo");
  if (!plans.length) { info.textContent = ""; info.title = ""; return; }
  let s = plans.length + " Pläne";
  if (myGroups && myGroups.length) {
    const withPlans = myGroups.filter((g) => g.plans > 0);
    const labels = [...new Set(withPlans.map((g) => g.label).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
    if (withPlans.length) {
      s += " · Teams: " + labels.slice(0, 8).join(", ") + (labels.length > 8 ? " +" + (labels.length - 8) + " weitere" : "");
      info.title = withPlans.map((g) => g.label + " – " + g.plans + " Pläne").join("\n");
    } else s += " · " + myGroups.length + " Gruppen ohne Planner-Pläne";
  } else if (myGroups && !myGroups.length) s += " – keine Team-Mitgliedschaft gefunden";
  else if (groupsError) s += " – Team-Mitgliedschaften nicht lesbar (" + groupsError + ")";
  info.textContent = s;
}

async function loadMyGroups(setPh) {
  if (setPh) setPh("Teams");
  let url = "/me/memberOf/microsoft.graph.group?$select=id,displayName&$top=999";
  let opts = {};
  const out = [];
  while (url) {
    let res = await graph(url, opts);
    if (res.status === 400 && !opts.headers) {
      opts = { headers: { ConsistencyLevel: "eventual" } };
      url = url + (url.includes("$count=true") ? "" : "&$count=true");
      res = await graph(url, opts);
    }
    if (!res.ok) throw new Error("Graph " + res.status + " beim Lesen der Team-Mitgliedschaften");
    const j = await res.json();
    (j.value || []).forEach((g) => { if (g.id) out.push({ id: g.id, name: g.displayName || "" }); });
    url = j["@odata.nextLink"] ? j["@odata.nextLink"].replace(CONFIG.graph, "") : null;
  }
  return out;
}

async function loadPeople() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG.peopleCacheKey) || "null");
    if (cached && Array.isArray(cached.people) && cached.people.length) {
      people = cached.people;
      if (Date.now() - cached.ts < CONFIG.cacheTtlMs) return;
    }
    const users = await graphAll("/users?$select=id,displayName,mail&$top=999");
    const dom = "@" + CONFIG.internalDomain.toLowerCase();
    people = users
      .filter((u) => u.displayName && u.mail && u.mail.toLowerCase().endsWith(dom) && CONFIG.personNamePattern.test(u.displayName))
      .map((u) => ({ id: u.id, name: u.displayName, mail: u.mail }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    localStorage.setItem(CONFIG.peopleCacheKey, JSON.stringify({ ts: Date.now(), people }));
  } catch (e) { /* Zuweisung bleibt auf "mir" */ }
}

/* ---------- Buckets ---------- */

function hideBuckets() { buckets = []; bucketsReady = null; el("bucketRow").style.display = "none"; el("bucket").innerHTML = ""; }

async function loadBuckets(planId) {
  const sel = el("bucket"), row = el("bucketRow"), key = CONFIG.bucketCachePrefix + planId;
  let list = null;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Array.isArray(cached.buckets) && Date.now() - cached.ts < CONFIG.cacheTtlMs) list = cached.buckets;
  } catch (_) {}
  if (!list) {
    row.style.display = "block";
    sel.innerHTML = '<option value="">Buckets werden geladen …</option>';
    sel.disabled = true;
    try {
      const res = await graph("/planner/plans/" + planId + "/buckets");
      if (!res.ok) throw new Error("Graph " + res.status + " beim Laden der Buckets");
      const j = await res.json();
      list = (j.value || []).map((b) => ({ id: b.id, name: b.name || "", orderHint: b.orderHint || "" }));
      list.sort((a, b) => (a.orderHint < b.orderHint ? -1 : a.orderHint > b.orderHint ? 1 : 0));
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), buckets: list }));
    } catch (e) { console.warn("[PA] loadBuckets:", msg(e)); list = []; }
    finally { sel.disabled = false; }
  }
  if (!selectedPlan || selectedPlan.id !== planId) return;
  renderBuckets(planId, list);
}

function renderBuckets(planId, list) {
  buckets = list;
  const sel = el("bucket");
  if (!list.length) { hideBuckets(); return; }
  const last = localStorage.getItem(CONFIG.lastBucketPrefix + planId);
  sel.innerHTML = "";
  list.forEach((b) => { const o = document.createElement("option"); o.value = b.id; o.textContent = b.name; sel.appendChild(o); });
  sel.value = (last && list.some((b) => b.id === last)) ? last : list[0].id;
  el("bucketRow").style.display = "block";
}

/* ---------- Projekt erkennen (aus Dateinamen und Herkunftspfad) ---------- */

function detectProject() {
  if (!plans.length || selectedPlan || !files.length) return;
  const text = files.map((f) => f.name + "\n" + (f.path || "")).join("\n");
  const seen = new Set();
  const withSuffix = [], bare = [];
  const re = /\b(\d{5})(-[A-Za-z0-9]{1,6})?\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const full = m[1] + (m[2] || "");
    if (seen.has(full)) continue;
    seen.add(full);
    (m[2] ? withSuffix : bare).push(full);
  }
  const candidates = [...withSuffix, ...bare];
  for (const cand of candidates) {
    const hits = plans.filter((p) => p.title.toUpperCase().startsWith(cand.toUpperCase()));
    if (hits.length === 1) { choosePlan(hits[0], "erkannt: " + cand); return; }
    if (hits.length > 1) {
      el("plan").value = cand;
      el("detected").innerHTML = "Nummer <b>" + esc(cand) + "</b> gefunden – bitte Plan wählen:";
      renderList("plan", cand);
      return;
    }
  }
  el("detected").textContent = candidates.length
    ? "Nummer " + candidates[0] + " gefunden, aber kein passender Plan – bitte manuell wählen."
    : "Keine Projektnummer im Dateinamen – bitte Plan wählen.";
}

function choosePlan(p, note) {
  selectedPlan = p;
  el("plan").value = p.title;
  el("planlist").style.display = "none";
  el("detected").innerHTML = note ? "✓ <b>" + esc(p.title) + "</b> (" + esc(note) + ")" : "";
  bucketsReady = loadBuckets(p.id);
}

function choosePerson(p) { selectedPerson = p; el("assign").value = p.name; el("assignlist").style.display = "none"; }

/* ---------- Durchsuchbare Listen ---------- */

const combos = {
  plan:   { listId: "planlist",   items: () => plans,  label: (p) => p.title, pick: (p) => choosePlan(p), clear: () => { selectedPlan = null; hideBuckets(); }, idx: -1 },
  assign: { listId: "assignlist", items: () => people, label: (p) => p.name,  pick: (p) => choosePerson(p), clear: () => { selectedPerson = null; }, idx: -1 },
};

function renderList(key, filter) {
  const c = combos[key], list = el(c.listId);
  c.idx = -1;
  const f = (filter || "").trim().toUpperCase();
  const all = c.items();
  const hits = (f ? all.filter((p) => c.label(p).toUpperCase().includes(f)) : all).slice(0, CONFIG.maxListRows);
  list.innerHTML = "";
  if (!hits.length) {
    list.innerHTML = '<div class="none">' + (key === "plan" ? "Nichts gefunden – sichtbar sind nur Pläne aus Teams, in denen du Mitglied bist." : "Nichts gefunden") + "</div>";
  } else {
    hits.forEach((p) => {
      const d = document.createElement("div");
      d.textContent = c.label(p);
      d.addEventListener("mousedown", (ev) => { ev.preventDefault(); c.pick(p); });
      d._item = p;
      list.appendChild(d);
    });
  }
  list.style.display = "block";
}

function wireCombo(key) {
  const c = combos[key], input = el(key);
  input.addEventListener("input", () => { c.clear(); renderList(key, input.value); });
  input.addEventListener("focus", () => renderList(key, ""));
  input.addEventListener("keydown", (ev) => {
    const list = el(c.listId);
    const items = [...list.children].filter((d) => d._item);
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!items.length) return;
      c.idx = ev.key === "ArrowDown" ? Math.min(c.idx + 1, items.length - 1) : Math.max(c.idx - 1, 0);
      items.forEach((d, i) => d.classList.toggle("active", i === c.idx));
      items[c.idx].scrollIntoView({ block: "nearest" });
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const pick = c.idx >= 0 && items[c.idx] ? items[c.idx] : items[0];
      if (pick) c.pick(pick._item);
    } else if (ev.key === "Escape") list.style.display = "none";
  });
}

function wireUi() {
  wireCombo("plan");
  wireCombo("assign");
  wireDropzone();
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".combobox")) { el("planlist").style.display = "none"; el("assignlist").style.display = "none"; }
  });
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("a[href]");
    if (a && inHost) { ev.preventDefault(); hostPost({ type: "open", url: a.href }); }
  });
  el("create").addEventListener("click", createTask);
  el("cancel").addEventListener("click", () => hostPost({ type: "close" }));
  el("loginBtn").addEventListener("click", async () => {
    try { showStatus("Weiterleitung zur Microsoft-Anmeldung …", ""); await interactiveToken(); }
    catch (e) { showStatus(friendlyAuthError(e), "err"); }
  });
}

/* ---------- Upload in den Projektordner des Jahres-Teams ---------- */

function projectNumber(title) {
  const m = /^(\d{5}(?:-[A-Za-z0-9]{1,6})?)/.exec(title || "");
  return m ? m[1].toUpperCase() : "";
}

/* Ordner der Team-Bibliothek, der zum Plan gehört (Name beginnt mit der Projektnummer bzw. = Plantitel). */
async function findProjectFolder(groupId, planTitle) {
  const key = CONFIG.folderCachePrefix + groupId;
  let list = null;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Array.isArray(cached.folders) && Date.now() - cached.ts < CONFIG.cacheTtlMs) list = cached.folders;
  } catch (_) {}
  if (!list) {
    const items = await graphAll("/groups/" + groupId + "/drive/root/children?$select=id,name,folder&$top=999");
    list = items.filter((i) => i.folder).map((i) => ({ id: i.id, name: i.name }));
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), folders: list }));
  }
  const num = projectNumber(planTitle);
  const up = (planTitle || "").trim().toUpperCase();
  let hit = list.find((f) => f.name.trim().toUpperCase() === up);
  if (!hit && num) {
    const hits = list.filter((f) => f.name.toUpperCase().startsWith(num));
    if (hits.length === 1) hit = hits[0];
    else if (hits.length > 1) hit = hits.find((f) => /^\d{5}(-[A-Za-z0-9]{1,6})?[\s_-]/.test(f.name.toUpperCase()) && f.name.toUpperCase().startsWith(num + " ")) || hits[0];
  }
  return hit || null;
}

function encodePath(path) { return path.split("/").filter(Boolean).map(encodeURIComponent).join("/"); }

async function uploadFile(groupId, folderPath, file, onProgress) {
  const blob = await fileBlob(file);
  const base = "/groups/" + groupId + "/drive/root:/" + (folderPath ? encodePath(folderPath) + "/" : "") + encodeURIComponent(file.name);
  if (blob.size <= CONFIG.smallUploadLimit) {
    const res = await graph(base + ":/content?@microsoft.graph.conflictBehavior=rename", { method: "PUT", body: blob, headers: { "Content-Type": blob.type || "application/octet-stream" } });
    if (!res.ok) throw new Error(await uploadError(res, file.name));
    onProgress(1);
    const item = await res.json();
    diag("Upload ok: " + (item && item.name) + " → " + (item && item.webUrl));
    return item;
  }
  // Große Datei: Upload-Session in Blöcken
  const sess = await graph(base + ":/createUploadSession", { method: "POST", body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename", name: file.name } }) });
  if (!sess.ok) throw new Error(await uploadError(sess, file.name));
  const uploadUrl = (await sess.json()).uploadUrl;
  let pos = 0, result = null;
  while (pos < blob.size) {
    const end = Math.min(pos + CONFIG.chunkSize, blob.size);
    const part = blob.slice(pos, end);
    let res = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Range": "bytes " + pos + "-" + (end - 1) + "/" + blob.size }, body: part });
      if (res.ok || res.status < 500) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!res.ok) throw new Error("Upload von '" + file.name + "' abgebrochen (HTTP " + res.status + ")");
    pos = end;
    onProgress(pos / blob.size);
    if (res.status === 200 || res.status === 201) result = await res.json();
  }
  return result;
}

async function uploadError(res, name) {
  let detail = "";
  try { const j = await res.json(); detail = (j.error && j.error.message) || ""; } catch (_) {}
  if (res.status === 403) return "Keine Berechtigung, '" + name + "' im Team dieses Projekts abzulegen. Bist du Mitglied im Jahres-Team?";
  if (res.status === 404) return "Die Dateiablage des Teams wurde nicht gefunden (Graph 404). " + detail;
  return "Upload von '" + name + "' fehlgeschlagen (Graph " + res.status + "). " + detail;
}

function refType(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["doc", "docx"].includes(ext)) return "Word";
  if (["xls", "xlsx", "xlsm"].includes(ext)) return "Excel";
  if (["ppt", "pptx"].includes(ext)) return "PowerPoint";
  return "Other";
}

/* ---------- Aufgabe erstellen ---------- */

async function createTask() {
  if (!selectedPlan) {
    const f = el("plan").value.trim().toUpperCase();
    const exact = plans.filter((p) => p.title.toUpperCase() === f);
    if (exact.length === 1) choosePlan(exact[0]);
  }
  if (!selectedPlan) { showStatus("Bitte zuerst einen Plan auswählen (Feld 'Projekt / Plan').", "err"); el("plan").focus(); return; }
  const title = el("title").value.trim();
  if (!title) { showStatus("Bitte einen Titel eingeben.", "err"); el("title").focus(); return; }
  const start = el("start").value, end = el("end").value, due = el("due").value;
  if (start && end && start > end) { showStatus("Das Startdatum liegt nach dem Ende. Bitte Termine prüfen.", "err"); el("start").focus(); return; }
  if (start && due && start > due) { showStatus("Das Startdatum liegt nach dem Fälligkeitsdatum. Bitte Termine prüfen.", "err"); el("start").focus(); return; }
  const notes = el("notes").value.trim();
  const btn = el("create");
  if (files.some((f) => !f.ready || f.ok === null)) {
    // Kopie aus der Hülle läuft noch → kurz warten, statt den Nutzer erneut klicken zu lassen
    btn.disabled = true;
    showStatus("Datei wird noch übernommen …", "");
    const t0 = Date.now();
    while (files.some((f) => !f.ready || f.ok === null) && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 300));
    btn.disabled = false;
  }
  if (files.some((f) => f.ok === false)) { showStatus("Mindestens eine Datei ist nicht lesbar. Bitte entfernen (×) und erneut ablegen.", "err"); return; }

  btn.disabled = true;
  const bar = el("progress");
  bar.style.display = files.length ? "block" : "none";
  const setBar = (v) => { bar.firstElementChild.style.width = Math.round(v * 100) + "%"; };
  setBar(0);

  const planId = selectedPlan.id;
  try {
    try { await getToken(); } catch (_) { await interactiveToken(); }
    if (bucketsReady) { try { await bucketsReady; } catch (_) {} }
    const bucketId = el("bucketRow").style.display !== "none" ? (el("bucket").value || "") : "";

    // 1) Dateien hochladen (vor der Aufgabe, damit bei Upload-Fehlern keine halbe Aufgabe entsteht)
    const uploaded = [];   // [{name, webUrl}]
    const skipped = [];    // Dateinamen ohne Upload (Testmodus / kein Team)
    if (files.length && canUpload) {
      if (!selectedPlan.owner) throw new Error("Zu diesem Plan ist kein Team bekannt – Datei kann nicht abgelegt werden.");
      showStatus("Ablageordner wird gesucht …", "");
      const folder = await findProjectFolder(selectedPlan.owner, selectedPlan.title);
      let folderPath = folder ? folder.name : "";
      diag("Plan " + selectedPlan.title + " | Gruppe " + selectedPlan.owner + " | Ordner " + (folderPath || "(Wurzel)"));
      if (CONFIG.uploadSubfolder) folderPath = (folderPath ? folderPath + "/" : "") + CONFIG.uploadSubfolder;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        showStatus("Datei " + (i + 1) + " von " + files.length + " wird abgelegt: " + esc(f.name) + " …", "");
        const item = await uploadFile(selectedPlan.owner, folderPath, f, (p) => setBar((i + p) / files.length));
        uploaded.push({ name: (item && item.name) || f.name, webUrl: (item && item.webUrl) || "" });
      }
    } else if (files.length) {
      files.forEach((f) => skipped.push(f.name));
    }

    // 2) Aufgabe anlegen
    showStatus("Aufgabe wird erstellt …", "");
    const body = { planId, title };
    if (bucketId) body.bucketId = bucketId;
    if (start) body.startDateTime = start + "T10:00:00Z";
    if (due) body.dueDateTime = due + "T10:00:00Z";
    const acct = myAccount();
    const assigneeId = (selectedPerson && selectedPerson.id) || (acct && acct.idTokenClaims && acct.idTokenClaims.oid);
    if (assigneeId) body.assignments = { [assigneeId]: { "@odata.type": "#microsoft.graph.plannerAssignment", orderHint: " !" } };
    const createRes = await graph("/planner/tasks", { method: "POST", body: JSON.stringify(body) });
    if (createRes.status === 403) throw new Error("Keine Berechtigung für diesen Plan: Du bist nicht Mitglied im Team dieses Projekts. Bitte vom Team-Besitzer ins Team aufnehmen lassen – danach klappt es.");
    if (!createRes.ok) throw new Error("Aufgabe anlegen fehlgeschlagen (Graph " + createRes.status + ")");
    const task = await createRes.json();
    if (bucketId) { try { localStorage.setItem(CONFIG.lastBucketPrefix + planId, bucketId); } catch (_) {} }

    // 3) Beschreibung + Anlagen (Referenzen) an die Aufgabe
    // Planner kennt nur Start und Fälligkeit; das geplante Ende wird als Zeile in die Beschreibung geschrieben.
    let description = notes;
    if (end) description = "Geplantes Ende: " + fmtDate(end) + (description ? "\n\n" + description : "");
    if (skipped.length) description = (description ? description + "\n\n" : "") + "Datei(en): " + skipped.join(", ");
    const refs = uploaded.filter((u) => u.webUrl);
    let detailsError = "";
    if (description || refs.length) {
      try { await patchDetails(task.id, description, refs, 3); }
      catch (e) { detailsError = msg(e); }
    }

    const bucketName = bucketId ? (buckets.find((b) => b.id === bucketId) || {}).name : "";
    const link = CONFIG.plannerWeb + planId + "/view/board/task/" + task.id;
    let html = '✓ Aufgabe angelegt in „' + esc(selectedPlan.title) + '"' + (bucketName ? " → Bucket „" + esc(bucketName) + '"' : "") + ".";
    if (refs.length && !detailsError) html += "<br>" + refs.length + (refs.length === 1 ? " Datei" : " Dateien") + " im Team abgelegt und angehängt.";
    if (detailsError) html += '<br><span style="color:var(--err)">⚠ ' + esc(detailsError) + "</span>";
    if (skipped.length) html += "<br>Ohne Upload (Testmodus): " + esc(skipped.join(", "));
    html += '<br><a href="' + link + '" target="_blank" rel="noopener">In Planner öffnen</a>';
    showStatus(html, "ok");
    setBar(1);
    hostPost({ type: "done", taskId: task.id });
    // Formular für die nächste Aufgabe leeren, Fenster bleibt offen bis der Nutzer es schließt
    files = []; renderFiles();
    el("title").value = ""; el("notes").value = ""; el("start").value = ""; el("end").value = ""; el("due").value = "";
    if (inHost) { el("cancel").textContent = "Schließen"; }
  } catch (e) {
    showStatus(friendlyAuthError(e), "err");
  } finally {
    btn.disabled = false;
  }
}

async function patchDetails(taskId, description, refs, tries) {
  let lastErr = "";
  for (let i = 0; i < tries; i++) {
    const det = await graph("/planner/tasks/" + taskId + "/details");
    if (!det.ok) { lastErr = "Details lesen: Graph " + det.status; continue; }
    const etag = (await det.json())["@odata.etag"];
    const patch = {};
    if (description) patch.description = description;
    if (refs.length) {
      patch.previewType = "reference"; // Karte im Planner-Board zeigt die Anlage
      patch.references = {};
      refs.forEach((r) => {
        patch.references[encodeRefKey(r.webUrl)] = {
          "@odata.type": "#microsoft.graph.plannerExternalReference",
          alias: r.name.slice(0, 250),
          type: refType(r.name),
          previewPriority: " !",   // gültiger orderHint (Planner sortiert selbst); " !x" wäre ungültig → 400
        };
      });
    }
    diag("PATCH details: " + JSON.stringify(patch).slice(0, 1500));
    const res = await graph("/planner/tasks/" + taskId + "/details", { method: "PATCH", headers: { "If-Match": etag }, body: JSON.stringify(patch) });
    diag("PATCH Antwort: " + res.status);
    if (res.ok) return;
    let detail = ""; try { const j = await res.json(); detail = (j.error && j.error.message) || ""; } catch (_) {}
    lastErr = "Graph " + res.status + (detail ? ": " + detail : "");
    hostPost({ type: "log", text: "patchDetails fehlgeschlagen: " + lastErr });
    if (res.status !== 409 && res.status !== 412) break; // nur bei ETag-Konflikt erneut versuchen
  }
  throw new Error("Aufgabe wurde angelegt, aber Beschreibung/Anlage konnten nicht gesetzt werden (" + lastErr + ").");
}

/* Planner-Referenz-Keys: % zuerst, dann . : @ # encodieren */
function encodeRefKey(url) {
  return url.replace(/%/g, "%25").replace(/\./g, "%2E").replace(/:/g, "%3A").replace(/@/g, "%40").replace(/#/g, "%23");
}

/* ---------- Helfer ---------- */

function showStatus(html, cls) { const s = el("status"); s.className = cls || ""; s.innerHTML = html; }

function friendlyAuthError(e) {
  const m = msg(e);
  if (/consent|AADSTS65001|admin approval|AADSTS90094/i.test(m)) {
    return "Zustimmung erforderlich: Falls 'Administratorgenehmigung erforderlich' erscheint, muss der M365-Admin der App 'Planner-Ablage' einmalig zustimmen. (" + esc(m) + ")";
  }
  if (/AADSTS50011|redirect/i.test(m)) return "Die Rücksprungadresse dieser Seite ist in der App-Registrierung nicht eingetragen. (" + esc(m) + ")";
  return "Fehler: " + esc(m);
}

function fmtDate(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? m[3] + "." + m[2] + "." + m[1] : iso; }

function fmtSize(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

function msg(e) { return (e && (e.message || e.errorMessage)) || String(e); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

boot(); // erst hier, wenn alle Konstanten (combos, CONFIG) definiert sind
