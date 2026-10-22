/** Public snapshot reader. This page never contacts or probes a proxy host. */
export const PROXY_STATUSES = Object.freeze(["active", "all", "offline", "unstable", "unverified", "stale"]);
const ROW_FRESHNESS_MS = 600_000;
const THEME_KEY = "sautilink.cloudengine.theme.v1";

export const COPY = Object.freeze({
  en: {
    skip: "Skip to content", primaryNav: "Primary", workspace: "Workspace", allTools: "All tools", proxies: "Proxies", menu: "Menu",
    kicker: "A clearer way to connect", title: "Telegram proxies.\nStatus you can see.", lead: "Explore recently checked connections, choose a proxy, and open it in Telegram.", howLink: "How this works", updates: "Follow updates",
    monitor: "Directory status", loadingShort: "Loading", loadingTitle: "Reading the latest list", loadingDescription: "Checking for the most recent monitoring results.", noSnapshot: "No results loaded yet", refresh: "Refresh list", refreshing: "Refreshing…", refreshHint: "The list updates automatically. Refresh any time to see the latest results.",
    totals: "Directory totals", activeCount: "Recently active", lastActiveCount: "Active at last update", activeNote: "Passed a recent check", totalCount: "In the directory", totalNote: "Across all statuses", offlineCount: "Offline", offlineNote: "Failed repeated checks", targetCount: "Active target", targetNote: "A goal, not a guarantee",
    browse: "The connection directory", directory: "Find your next connection", noAccount: "No account needed", filterLabel: "Filter proxies by status", active: "Active", all: "All", offline: "Offline", unstable: "Unstable", unverified: "Unverified", stale: "Stale", sort: "Sort by", fastest: "Lowest check latency", reliabilitySort: "Most successful checks", loadingResults: "Loading the directory…", pagination: "Proxy result pages", previous: "Previous", next: "Next", browseAll: "Browse all statuses",
    guideKicker: "Good to know", guideTitle: "A recent check.\nAn informed choice.", guideLead: "Proxies are checked from a monitoring service. Your network or location can give a different result.", step1Title: "Start with Active", step1Text: "See when the proxy was checked. Latency describes the monitoring check, not your internet speed.", step2Title: "Open in Telegram", step2Text: "Tap Connect, then review and confirm the proxy in Telegram. Your Telegram app controls the connection.", step3Title: "Come back when you need another", step3Text: "The directory updates as checks change. Choose another proxy here to add it to Telegram.", statusGuide: "What each status means", activeMeaning: "Passed a recent MTProto connection check.", unstableMeaning: "Recent checks have mixed results. A reliable connection is not confirmed.", offlineMeaning: "Several consecutive connection checks failed.", unverifiedMeaning: "A current supported connection check is not confirmed.", staleMeaning: "The last confirmation is too old to recommend a connection.", communityNote: "Community-operated proxies. Availability may change.",
    footerLead: "Tools that keep you informed.", corporation: "Powered by SautiLink Corporation", footerNav: "More from Cloud Engine", telegramBot: "Telegram bot", privacy: "Privacy", terms: "Terms", footerNote: "MTProto · Telegram connection directory",
    ready: "Monitoring", warming: "Warming up", unavailable: "Unavailable", error: "Not loaded", readyTitle: "The latest checks are in", readyDescription: "{active} proxies were active at the latest update. The directory aims to keep {target} available; results change as checks run.", warmingTitle: "The directory is warming up", warmingDescription: "The first checks are still being collected. Any fresh active entries below are available to try.", staleTitle: "Fresh checks are needed", staleDescription: "These results have expired. Connect is paused until current monitoring results arrive.", unavailableTitle: "Monitoring is unavailable", unavailableDescription: "Current connection health cannot be confirmed. Try refreshing the list later.", errorTitle: "The list could not be loaded", errorDescription: "Please check your connection and try again.", updated: "List updated {time}", neverChecked: "Not checked", justNow: "just now", secondsAgo: "{n}s ago", minutesAgo: "{n}m ago", hoursAgo: "{n}h ago", daysAgo: "{n}d ago", invalidTime: "Time unavailable", snapshotExpired: "This saved list is out of date. Connect is disabled until a fresh list loads.", partialExpired: "Some checks have expired since this list loaded. Refresh to see the latest confirmed connections.",
    emptyTitle: "No proxies in this view", emptyDescription: "Try another status to explore the directory.", emptyActiveTitle: "No fresh active proxies yet", emptyActiveDescription: "Monitoring has not confirmed a recent working connection in this view. Check back after the next update, or browse the other statuses.", emptyWarmingTitle: "Checks are getting started", emptyWarmingDescription: "The first results will appear here after proxies are collected and checked. Return after the next monitoring update.", emptyUnavailableTitle: "No current results to show", emptyUnavailableDescription: "The monitoring service has not supplied a usable list. Please try again later.", emptyErrorTitle: "We could not read this list", emptyErrorDescription: "Use Refresh list to try again, or return later for the latest monitoring results.",
    results: "{start}–{end} of {total} · {status}", zeroResults: "0 results · {status}", page: "Page {page} of {pages}", networkError: "The latest list could not be read. Please try again.", oldResultsError: "Refresh failed. The last loaded results remain below, with their original check times.", invalidError: "The monitoring service returned an incomplete response. Please try again later.", limitedError: "The directory is receiving many requests. Please wait a moment before refreshing.",
    latency: "Check latency", reliability: "Successful checks", reliabilityHint: "Share of recorded checks that succeeded; not an uptime guarantee", checked: "Last checked", noHistory: "No history yet", notMeasured: "Not measured", location: "Checked from {location}", neutralLocation: "Checked from monitoring service", details: "Details", connect: "Connect", connectTo: "Connect to {label} in Telegram", paused: "Awaiting check", operator: "Operator", community: "Community provider", transport: "MTProto transport", lastSuccess: "Last successful check", neverSucceeded: "Not confirmed", classic: "Classic", padded: "Padded", fake_tls: "Fake TLS", noConnect: "A fresh active result and valid Telegram connection link are required.", languageLabel: "Switch to Kiswahili", lightTheme: "Switch to light theme", darkTheme: "Switch to dark theme",
  },
  sw: {
    skip: "Nenda kwenye maudhui", primaryNav: "Urambazaji mkuu", workspace: "Mwanzo", allTools: "Zana zote", proxies: "Proxies", menu: "Menyu",
    kicker: "Njia iliyo wazi ya kuunganisha", title: "Proxies za Telegram.\nHali unayoweza kuona.", lead: "Angalia miunganisho iliyokaguliwa karibuni, chagua proxy, kisha ifungue kwenye Telegram.", howLink: "Mfumo unavyofanya kazi", updates: "Fuata updates",
    monitor: "Hali ya orodha", loadingShort: "Inapakia", loadingTitle: "Tunasoma orodha ya karibuni", loadingDescription: "Tunatafuta matokeo mapya zaidi ya ukaguzi.", noSnapshot: "Bado hakuna matokeo yaliyopakiwa", refresh: "Sasisha orodha", refreshing: "Inasasisha…", refreshHint: "Orodha inasasishwa yenyewe. Sasisha wakati wowote kuona matokeo mapya.",
    totals: "Idadi kwenye orodha", activeCount: "Zilizofanya kazi karibuni", lastActiveCount: "Zilifanya kazi wakati huo", activeNote: "Zilipita ukaguzi wa karibuni", totalCount: "Zilizo kwenye orodha", totalNote: "Katika hali zote", offlineCount: "Hazifanyi kazi", offlineNote: "Zimeshindwa ukaguzi mara kadhaa", targetCount: "Lengo la zinazopatikana", targetNote: "Ni lengo, si dhamana",
    browse: "Orodha ya miunganisho", directory: "Tafuta muunganisho unaokufaa", noAccount: "Hakuna akaunti inayohitajika", filterLabel: "Chuja proxies kwa hali", active: "Hai", all: "Zote", offline: "Offline", unstable: "Zinayumba", unverified: "Hazijahakikiwa", stale: "Za zamani", sort: "Panga kwa", fastest: "Muda mfupi wa ukaguzi", reliabilitySort: "Ukaguzi uliofanikiwa zaidi", loadingResults: "Tunapakia orodha…", pagination: "Kurasa za matokeo ya proxy", previous: "Iliyopita", next: "Inayofuata", browseAll: "Angalia hali zote",
    guideKicker: "Fahamu hili", guideTitle: "Ukaguzi wa karibuni.\nChaguo lenye taarifa.", guideLead: "Proxies hukaguliwa na huduma ya ufuatiliaji. Mtandao au eneo lako linaweza kutoa matokeo tofauti.", step1Title: "Anza na zilizo Hai", step1Text: "Angalia muda proxy ilipokaguliwa. Muda wa ukaguzi haupimi kasi ya intaneti yako.", step2Title: "Fungua kwenye Telegram", step2Text: "Gusa Unganisha, kisha kagua na ukubali proxy kwenye Telegram. App yako ya Telegram ndiyo inadhibiti muunganisho.", step3Title: "Rudi unapohitaji nyingine", step3Text: "Orodha hubadilika kulingana na ukaguzi. Chagua proxy nyingine hapa ili kuiongeza kwenye Telegram.", statusGuide: "Maana ya kila hali", activeMeaning: "Imepita ukaguzi wa muunganisho wa MTProto karibuni.", unstableMeaning: "Baadhi ya ukaguzi umefanikiwa na mingine imeshindwa. Muunganisho thabiti haujathibitishwa.", offlineMeaning: "Ukaguzi kadhaa wa muunganisho mfululizo haukufanikiwa.", unverifiedMeaning: "Ukaguzi wa sasa wa muunganisho unaotumika haujathibitishwa.", staleMeaning: "Uthibitisho wa mwisho ni wa zamani sana kupendekeza muunganisho.", communityNote: "Proxies zinaendeshwa na jamii. Upatikanaji unaweza kubadilika.",
    footerLead: "Zana zinazokupa taarifa.", corporation: "Powered by SautiLink Corporation", footerNav: "Zaidi kutoka Cloud Engine", telegramBot: "Bot ya Telegram", privacy: "Faragha", terms: "Masharti", footerNote: "MTProto · Orodha ya miunganisho ya Telegram",
    ready: "Inafuatiliwa", warming: "Inaandaliwa", unavailable: "Haipatikani", error: "Haijapakiwa", readyTitle: "Matokeo mapya yamefika", readyDescription: "Proxies {active} zilifanya kazi wakati wa sasisho la mwisho. Lengo ni kuweka {target} zinazopatikana; matokeo hubadilika kadiri ukaguzi unavyoendelea.", warmingTitle: "Orodha inaandaliwa", warmingDescription: "Matokeo ya kwanza bado yanakusanywa. Proxy yoyote iliyo Hai na yenye ukaguzi mpya hapa chini inaweza kujaribiwa.", staleTitle: "Ukaguzi mpya unahitajika", staleDescription: "Matokeo haya yamepitwa na muda. Kuunganisha kumesitishwa hadi matokeo mapya yafike.", unavailableTitle: "Ufuatiliaji haupatikani", unavailableDescription: "Hali ya sasa ya miunganisho haiwezi kuthibitishwa. Jaribu kusasisha orodha baadaye.", errorTitle: "Orodha haikuweza kupakiwa", errorDescription: "Tafadhali angalia intaneti yako na ujaribu tena.", updated: "Orodha ilisasishwa {time}", neverChecked: "Haijakaguliwa", justNow: "sasa hivi", secondsAgo: "sekunde {n} zilizopita", minutesAgo: "dakika {n} zilizopita", hoursAgo: "saa {n} zilizopita", daysAgo: "siku {n} zilizopita", invalidTime: "Muda haupatikani", snapshotExpired: "Orodha hii imepitwa na muda. Kuunganisha kumezimwa hadi orodha mpya ipakiwe.", partialExpired: "Baadhi ya ukaguzi umepitwa na muda tangu orodha hii ipakiwe. Sasisha ili kuona miunganisho iliyothibitishwa karibuni.",
    emptyTitle: "Hakuna proxies katika hali hii", emptyDescription: "Jaribu hali nyingine kuangalia orodha.", emptyActiveTitle: "Bado hakuna proxies Hai za karibuni", emptyActiveDescription: "Ufuatiliaji haujathibitisha muunganisho unaofanya kazi karibuni katika sehemu hii. Rudi baada ya sasisho linalofuata au angalia hali nyingine.", emptyWarmingTitle: "Ukaguzi unaanza", emptyWarmingDescription: "Matokeo ya kwanza yataonekana hapa baada ya proxies kukusanywa na kukaguliwa. Rudi baada ya sasisho lijalo la ufuatiliaji.", emptyUnavailableTitle: "Hakuna matokeo ya sasa", emptyUnavailableDescription: "Huduma ya ufuatiliaji haijatoa orodha inayotumika. Tafadhali jaribu tena baadaye.", emptyErrorTitle: "Hatukuweza kusoma orodha hii", emptyErrorDescription: "Tumia Sasisha orodha kujaribu tena, au rudi baadaye kupata matokeo mapya ya ukaguzi.",
    results: "{start}–{end} kati ya {total} · {status}", zeroResults: "Matokeo 0 · {status}", page: "Ukurasa {page} kati ya {pages}", networkError: "Orodha mpya haikuweza kusomwa. Tafadhali jaribu tena.", oldResultsError: "Kusasisha kumeshindikana. Matokeo yaliyopakiwa awali bado yapo hapa chini, pamoja na muda wake wa ukaguzi.", invalidError: "Huduma ya ufuatiliaji imerudisha taarifa zisizokamilika. Tafadhali jaribu tena baadaye.", limitedError: "Orodha inapokea maombi mengi. Subiri kidogo kabla ya kusasisha.",
    latency: "Muda wa ukaguzi", reliability: "Ukaguzi uliofanikiwa", reliabilityHint: "Sehemu ya ukaguzi uliorekodiwa iliyofanikiwa; si dhamana ya upatikanaji", checked: "Imekaguliwa", noHistory: "Bado hakuna historia", notMeasured: "Haijapimwa", location: "Imekaguliwa kutoka {location}", neutralLocation: "Imekaguliwa na huduma ya ufuatiliaji", details: "Maelezo", connect: "Unganisha", connectTo: "Unganisha {label} kwenye Telegram", paused: "Inasubiri ukaguzi", operator: "Mtoa huduma", community: "Mtoa huduma wa jamii", transport: "Aina ya MTProto", lastSuccess: "Ukaguzi uliofanikiwa mwisho", neverSucceeded: "Haijathibitishwa", classic: "Classic", padded: "Padded", fake_tls: "Fake TLS", noConnect: "Matokeo Hai ya karibuni na kiungo sahihi cha Telegram vinahitajika.", languageLabel: "Switch to English", lightTheme: "Tumia mandhari angavu", darkTheme: "Tumia mandhari meusi",
  },
});

function words(lang, key, values = {}) {
  return (COPY[lang === "sw" ? "sw" : "en"][key] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boundedText(value, max = 240) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function isCount(value) { return Number.isSafeInteger(value) && value >= 0; }

export function initialView(search = "") {
  const params = new URLSearchParams(search);
  const page = Number(params.get("page"));
  return {
    status: PROXY_STATUSES.includes(params.get("status")) ? params.get("status") : "active",
    page: Number.isSafeInteger(page) && page > 0 && page <= 10_000 ? page : 1,
    sort: params.get("sort") === "reliability" ? "reliability" : "latency",
    lang: params.get("lang") === "sw" ? "sw" : "en",
    theme: ["light", "dark"].includes(params.get("theme")) ? params.get("theme") : null,
  };
}

export function snapshotUrl(view) {
  const parsed = initialView(new URLSearchParams({ status: view.status, page: String(view.page), sort: view.sort }));
  return `/api/proxies?${new URLSearchParams({ status: parsed.status, page: String(parsed.page), per_page: "20", sort: parsed.sort })}`;
}

export function normalizeSnapshot(payload) {
  const data = payload?.data;
  if (payload?.success !== true || data?.schema_version !== 1 || !["ready", "warming", "stale", "unavailable"].includes(data.monitor_status)) throw new Error("invalid");
  if (!data.counts || !["active", "offline", "unstable", "unverified", "stale", "total"].every(key => isCount(data.counts[key]))) throw new Error("invalid");
  if (!isCount(data.target_active) || data.target_active < 1 || !isCount(data.page) || data.page < 1 || !isCount(data.per_page) || data.per_page < 1 || data.per_page > 100 || !isCount(data.total_pages) || !isCount(data.total) || !Array.isArray(data.proxies) || data.proxies.length > data.per_page) throw new Error("invalid");
  if (data.total > 0 && (data.total_pages < 1 || data.page > data.total_pages)) throw new Error("invalid");
  const proxies = data.proxies.map((proxy) => {
    if (!proxy || typeof proxy.id !== "string" || !proxy.id || typeof proxy.host !== "string" || !proxy.host || !Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535 || proxy.type !== "mtproto" || !PROXY_STATUSES.includes(proxy.status) || proxy.status === "all") throw new Error("invalid");
    return {
      id: boundedText(proxy.id, 128), label: boundedText(proxy.label, 160), host: boundedText(proxy.host, 253), port: proxy.port, type: "mtproto", transport: ["classic", "padded", "fake_tls"].includes(proxy.transport) ? proxy.transport : null,
      status: proxy.status, latency_ms: typeof proxy.latency_ms === "number" && Number.isFinite(proxy.latency_ms) && proxy.latency_ms >= 0 ? proxy.latency_ms : null,
      last_checked_at: timestamp(proxy.last_checked_at) === null ? null : proxy.last_checked_at,
      last_success_at: timestamp(proxy.last_success_at) === null ? null : proxy.last_success_at,
      check_location: boundedText(proxy.check_location, 120),
      operator: "community", connect_url: boundedText(proxy.connect_url, 2500),
      availability_pct: typeof proxy.availability_pct === "number" && Number.isFinite(proxy.availability_pct) && proxy.availability_pct >= 0 && proxy.availability_pct <= 100 ? proxy.availability_pct : null,
    };
  });
  return { ...data, proxies, counts: { ...data.counts } };
}

export function snapshotState(snapshot, now = Date.now()) {
  if (!snapshot) return "loading";
  if (snapshot.monitor_status === "unavailable") return "unavailable";
  if (snapshot.monitor_status === "stale") return "stale";
  const expires = timestamp(snapshot.expires_at);
  const generated = timestamp(snapshot.generated_at);
  if (snapshot.monitor_status === "warming" && generated === null && !snapshot.proxies.length) return "warming";
  if (expires === null || generated === null || generated > now + 60_000 || expires <= now) return "stale";
  return snapshot.monitor_status;
}

export function proxyStatus(proxy, snapshot, now = Date.now()) {
  if (proxy.status !== "active") return proxy.status;
  const checked = timestamp(proxy.last_checked_at);
  const successful = timestamp(proxy.last_success_at);
  if (["stale", "unavailable"].includes(snapshotState(snapshot, now)) || checked === null || successful === null || checked > now + 60_000 || successful > now + 60_000 || now - Math.min(checked, successful) >= ROW_FRESHNESS_MS) return "stale";
  return "active";
}

export function connectUrl(proxy, snapshot, now = Date.now()) {
  if (proxyStatus(proxy, snapshot, now) !== "active" || proxy.type !== "mtproto" || !["classic", "padded", "fake_tls"].includes(proxy.transport)) return null;
  try {
    const url = new URL(proxy.connect_url);
    const allowed = (url.protocol === "https:" && url.hostname === "t.me" && url.pathname === "/proxy") || (url.protocol === "tg:" && url.hostname === "proxy" && url.pathname === "");
    if (!allowed || url.username || url.password || url.port || url.hash) return null;
    const keys = [...url.searchParams.keys()];
    if (keys.length !== 3 || !["server", "port", "secret"].every(key => url.searchParams.getAll(key).length === 1)) return null;
    if (url.searchParams.get("server")?.toLowerCase() !== proxy.host.toLowerCase() || url.searchParams.get("port") !== String(proxy.port)) return null;
    if (!/^[a-zA-Z0-9_-]{22,1024}$/.test(url.searchParams.get("secret") || "")) return null;
    return url.href;
  } catch { return null; }
}

export function relativeTime(value, lang = "en", now = Date.now()) {
  const parsed = timestamp(value);
  if (parsed === null) return words(lang, "neverChecked");
  if (parsed > now + 60_000) return words(lang, "invalidTime");
  const seconds = Math.max(0, Math.floor((now - parsed) / 1000));
  if (seconds < 10) return words(lang, "justNow");
  if (seconds < 60) return words(lang, "secondsAgo", { n: seconds });
  if (seconds < 3600) return words(lang, "minutesAgo", { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return words(lang, "hoursAgo", { n: Math.floor(seconds / 3600) });
  return words(lang, "daysAgo", { n: Math.floor(seconds / 86400) });
}

function absoluteTime(value, lang) {
  const parsed = timestamp(value);
  if (parsed === null) return words(lang, "neverChecked");
  return new Intl.DateTimeFormat(lang === "sw" ? "sw-TZ" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(parsed) + " UTC";
}

// The shared AnimateIcons adapter draws and animates these trusted catalog names.
function icon(name) {
  return `<svg class="public-icon" data-public-icon="${name}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"></svg>`;
}

export function renderProxyCard(proxy, snapshot, lang = "en", now = Date.now()) {
  const t = (key, values) => escapeHtml(words(lang, key, values));
  const status = proxyStatus(proxy, snapshot, now);
  const connection = connectUrl(proxy, snapshot, now);
  const label = proxy.label || proxy.host;
  const checked = timestamp(proxy.last_checked_at);
  const reliability = proxy.availability_pct === null ? t("noHistory") : `${new Intl.NumberFormat(lang === "sw" ? "sw-TZ" : "en-GB", { maximumFractionDigits: 1 }).format(proxy.availability_pct)}%`;
  return `<article class="proxy-card" data-proxy-id="${escapeHtml(proxy.id)}">
    <div class="proxy-card-header"><div><h3 class="proxy-card-title" tabindex="-1">${escapeHtml(label)}</h3><code class="proxy-endpoint">${escapeHtml(proxy.host.includes(":") ? `[${proxy.host}]:${proxy.port}` : `${proxy.host}:${proxy.port}`)}</code></div><span class="proxy-state" data-state="${escapeHtml(status)}">${t(status)}</span></div>
    <dl class="proxy-card-metrics"><div><dt>${t("latency")}</dt><dd>${proxy.latency_ms === null ? t("notMeasured") : `${Math.round(proxy.latency_ms)} ms`}</dd></div><div><dt><abbr title="${t("reliabilityHint")}">${t("reliability")}</abbr></dt><dd>${reliability}</dd></div><div><dt>${t("checked")}</dt><dd>${checked === null ? t("neverChecked") : `<time class="proxy-check-time" datetime="${escapeHtml(proxy.last_checked_at)}" title="${escapeHtml(absoluteTime(proxy.last_checked_at, lang))}">${escapeHtml(relativeTime(proxy.last_checked_at, lang, now))}</time>`}</dd></div></dl>
    <p class="proxy-location">${icon("location-0-1")}<span>${proxy.check_location ? t("location", { location: proxy.check_location }) : t("neutralLocation")}</span></p>
    <div class="proxy-card-footer"><details class="proxy-details"><summary>${t("details")}${icon("chevron-down")}</summary><dl><div><dt>${t("operator")}</dt><dd>${t("community")}</dd></div><div><dt>${t("transport")}</dt><dd>${proxy.transport ? t(proxy.transport) : t("unverified")}</dd></div><div><dt>${t("lastSuccess")}</dt><dd>${proxy.last_success_at ? escapeHtml(absoluteTime(proxy.last_success_at, lang)) : t("neverSucceeded")}</dd></div></dl></details>
    ${connection ? `<a class="btn btn-primary proxy-connect" href="${escapeHtml(connection)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" data-connect-id="${escapeHtml(proxy.id)}" aria-label="${t("connectTo", { label })}">${t("connect")}${icon("arrow-up-right-0-1")}</a>` : `<button type="button" class="btn proxy-connect" disabled title="${t("noConnect")}">${t("paused")}</button>`}</div>
  </article>`;
}

/** Request cancellation and view matching keep a late response out of another filter. */
export function createSnapshotLoader({ fetch: request, onState, timeoutMs = 12_000 }) {
  let sequence = 0;
  let activeController = null;
  let lastGood = null;
  let lastView = null;
  let disposed = false;
  let state = { loading: false, snapshot: null, summary: null, error: null, view: null };
  const sameQuery = (a, b) => a && b && a.status === b.status && a.sort === b.sort && a.page === b.page;
  const publish = (next) => { state = next; onState(next); };
  return {
    getState: () => state,
    async load(view) {
      if (disposed) return null;
      const current = ++sequence;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const query = { ...view };
      const previous = sameQuery(lastView, query) ? lastGood : null;
      publish({ loading: true, snapshot: previous, summary: lastGood, error: null, view: query });
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await request(snapshotUrl(query), { method: "GET", headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 429 ? "limited" : "network");
        let payload;
        try { payload = await response.json(); } catch { throw new Error("invalid"); }
        const snapshot = normalizeSnapshot(payload);
        if (current !== sequence || disposed || controller.signal.aborted) return null;
        lastGood = snapshot;
        lastView = { ...query, page: snapshot.page };
        publish({ loading: false, snapshot, summary: snapshot, error: null, view: lastView });
        return snapshot;
      } catch (error) {
        if (current !== sequence || disposed) return null;
        const code = ["invalid", "limited"].includes(error?.message) ? error.message : "network";
        publish({ loading: false, snapshot: previous, summary: lastGood, error: code, view: query });
        return null;
      } finally { clearTimeout(timer); }
    },
    dispose() { disposed = true; sequence += 1; activeController?.abort(); },
  };
}

export function bootProxyPage(doc = document, win = window) {
  if (!doc.querySelector("[data-proxy-page]")) return null;
  const byId = id => doc.getElementById(id);
  let view = initialView(win.location.search);
  let currentState = { loading: true, snapshot: null, summary: null, error: null, view };
  let refreshTimer = null;
  let freshnessTimer = null;
  let stopped = false;
  let theme = view.theme;
  if (!theme) {
    try { const stored = win.localStorage.getItem(THEME_KEY); if (["light", "dark"].includes(stored)) theme = stored; } catch { /* Theme still works when browser storage is blocked. */ }
  }
  if (!theme) theme = win.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";

  function syncUrl() {
    const url = new URL(win.location.href);
    url.search = "";
    if (view.lang === "sw") url.searchParams.set("lang", "sw");
    if (view.theme) url.searchParams.set("theme", theme);
    if (view.status !== "active") url.searchParams.set("status", view.status);
    if (view.page > 1) url.searchParams.set("page", String(view.page));
    if (view.sort !== "latency") url.searchParams.set("sort", view.sort);
    if (!["", "#monitor", "#proxy-results", "#how-it-works", "#main"].includes(url.hash)) url.hash = "";
    win.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function translate() {
    doc.documentElement.lang = view.lang;
    doc.documentElement.dataset.theme = theme;
    doc.title = view.lang === "sw" ? "Proxies za Telegram MTProto — SautiLink Cloud Engine" : "Telegram MTProto Proxies — SautiLink Cloud Engine";
    doc.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = words(view.lang, el.dataset.i18n); });
    doc.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", words(view.lang, el.dataset.i18nAria)); });
    const languageButton = byId("proxy-language");
    languageButton.textContent = view.lang.toUpperCase();
    languageButton.setAttribute("aria-label", words(view.lang, "languageLabel"));
    languageButton.title = words(view.lang, "languageLabel");
    const themeButton = byId("proxy-theme");
    themeButton.setAttribute("aria-pressed", String(theme === "dark"));
    themeButton.setAttribute("aria-label", words(view.lang, theme === "dark" ? "lightTheme" : "darkTheme"));
    themeButton.title = words(view.lang, theme === "dark" ? "lightTheme" : "darkTheme");
    themeButton.querySelector("svg").setAttribute("data-public-icon", theme === "dark" ? "sun-0-1" : "moon-0-1");
    doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#101114" : "#ffffff");
  }

  function render(state) {
    currentState = state;
    const now = Date.now();
    const summary = state.summary;
    const snapshot = state.snapshot;
    const status = summary ? snapshotState(summary, now) : state.error ? "error" : "loading";
    translate();
    byId("monitor").setAttribute("aria-busy", String(state.loading));
    byId("proxy-results").setAttribute("aria-busy", String(state.loading));
    const badge = byId("monitor-badge");
    badge.dataset.state = status;
    badge.textContent = words(view.lang, status === "loading" ? "loadingShort" : status);
    byId("monitor-heading").textContent = words(view.lang, `${status}Title`);
    byId("monitor-description").textContent = words(view.lang, `${status}Description`, { active: summary?.counts.active, target: summary?.target_active });
    const snapshotTime = byId("snapshot-time");
    snapshotTime.textContent = summary?.generated_at ? words(view.lang, "updated", { time: relativeTime(summary.generated_at, view.lang, now) }) : words(view.lang, "noSnapshot");
    snapshotTime.title = summary?.generated_at ? absoluteTime(summary.generated_at, view.lang) : "";
    const refresh = byId("proxy-refresh");
    refresh.disabled = state.loading;
    refresh.querySelector("span").textContent = words(view.lang, state.loading ? "refreshing" : "refresh");
    byId("count-active").textContent = summary ? String(summary.counts.active) : "—";
    byId("count-total").textContent = summary ? String(summary.counts.total) : "—";
    byId("count-offline").textContent = summary ? String(summary.counts.offline) : "—";
    byId("count-target").textContent = summary ? String(summary.target_active) : "—";
    const summaryHasExpiredRows = summary?.proxies.some(proxy => proxy.status === "active" && proxyStatus(proxy, summary, now) === "stale");
    byId("active-count-label").textContent = words(view.lang, ["stale", "unavailable"].includes(status) || summaryHasExpiredRows ? "lastActiveCount" : "activeCount");
    doc.querySelectorAll("[data-count]").forEach(el => { el.textContent = summary ? String(summary.counts[el.dataset.count]) : "—"; });
    doc.querySelectorAll("[data-status]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.status === view.status)));
    byId("proxy-sort").value = view.sort;
    const error = byId("proxy-error");
    error.hidden = !state.error;
    error.textContent = state.error ? words(view.lang, state.error === "invalid" ? "invalidError" : state.error === "limited" ? "limitedError" : snapshot ? "oldResultsError" : "networkError") : "";
    const expired = snapshot && ["stale", "unavailable"].includes(snapshotState(snapshot, now));
    const expiredRows = snapshot?.proxies.some(proxy => proxy.status === "active" && proxyStatus(proxy, snapshot, now) === "stale");
    const freshness = byId("proxy-freshness");
    freshness.hidden = !expired && !expiredRows;
    freshness.textContent = expired ? words(view.lang, "snapshotExpired") : expiredRows ? words(view.lang, "partialExpired") : "";
    const caption = byId("results-caption");
    caption.textContent = state.loading ? words(view.lang, "loadingResults") : snapshot ? words(view.lang, snapshot.total ? "results" : "zeroResults", { start: (snapshot.page - 1) * snapshot.per_page + 1, end: Math.min(snapshot.total, (snapshot.page - 1) * snapshot.per_page + snapshot.proxies.length), total: snapshot.total, status: words(view.lang, view.status) }) : words(view.lang, "emptyUnavailableTitle");
    const list = byId("proxy-list");
    const openCards = new Set([...list.querySelectorAll(".proxy-details[open]")].map(el => el.closest("[data-proxy-id]").dataset.proxyId));
    const focusedCard = doc.activeElement?.closest?.("[data-proxy-id]")?.dataset.proxyId;
    list.innerHTML = snapshot ? snapshot.proxies.map(proxy => renderProxyCard(proxy, snapshot, view.lang, now)).join("") : "";
    list.querySelectorAll("[data-proxy-id]").forEach(el => {
      if (openCards.has(el.dataset.proxyId)) el.querySelector("details").open = true;
      if (focusedCard === el.dataset.proxyId) el.querySelector(".proxy-card-title")?.focus({ preventScroll: true });
    });
    const empty = byId("proxy-empty");
    empty.hidden = Boolean(snapshot?.proxies.length) || state.loading;
    const emptyKind = state.error && !snapshot ? "emptyError" : ["unavailable", "stale"].includes(status) ? "emptyUnavailable" : status === "warming" && !summary?.counts.total ? "emptyWarming" : view.status === "active" ? "emptyActive" : "empty";
    byId("empty-title").textContent = words(view.lang, `${emptyKind}Title`);
    byId("empty-description").textContent = words(view.lang, `${emptyKind}Description`);
    byId("proxy-show-all").hidden = view.status === "all" || !summary?.counts.total;
    const pagination = byId("proxy-pagination");
    pagination.hidden = !snapshot || snapshot.total_pages < 2;
    byId("page-label").textContent = snapshot ? words(view.lang, "page", { page: snapshot.page, pages: snapshot.total_pages }) : "";
    byId("proxy-previous").disabled = state.loading || !snapshot || snapshot.page <= 1;
    byId("proxy-next").disabled = state.loading || !snapshot || snapshot.page >= snapshot.total_pages;
  }

  function clearTimers() { clearTimeout(refreshTimer); clearTimeout(freshnessTimer); }
  function scheduleFreshness(state) {
    clearTimeout(freshnessTimer);
    if (stopped || doc.visibilityState === "hidden") return null;
    const now = Date.now();
    const snapshot = state.snapshot;
    const deadlines = snapshot ? [timestamp(snapshot.expires_at), ...snapshot.proxies.filter(proxy => proxy.status === "active").flatMap(proxy => [proxy.last_checked_at, proxy.last_success_at].map(value => { const checked = timestamp(value); return checked === null ? null : checked + ROW_FRESHNESS_MS; }))].filter(value => value !== null && value > now) : [];
    const deadline = deadlines.length ? Math.min(...deadlines) - now + 30 : null;
    if (deadline !== null) freshnessTimer = setTimeout(() => { render(currentState); scheduleFreshness(currentState); }, deadline);
    return deadline;
  }
  function scheduleReads(state) {
    clearTimers();
    if (stopped || doc.visibilityState === "hidden") return;
    const interval = Math.max(30, Math.min(900, Number(state.snapshot?.refresh_interval_seconds) || 300)) * 1000;
    const deadline = scheduleFreshness(state);
    if (!state.loading) refreshTimer = setTimeout(() => { loader.load(view); }, Math.max(30_000, Math.min(interval, deadline === null ? interval : deadline + 1000)));
  }

  const loader = createSnapshotLoader({ fetch: (...args) => win.fetch(...args), onState(state) {
    if (!state.loading && state.snapshot) { view.page = state.snapshot.page; syncUrl(); }
    render(state);
    scheduleReads(state);
  } });

  function choose(status) { view.status = status; view.page = 1; syncUrl(); loader.load(view); }
  byId("proxy-language").addEventListener("click", () => { view.lang = view.lang === "sw" ? "en" : "sw"; syncUrl(); render(currentState); });
  byId("proxy-theme").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    view.theme = theme;
    try { win.localStorage.setItem(THEME_KEY, theme); } catch { /* The active theme remains usable. */ }
    syncUrl();
    translate();
    render(currentState);
  });
  byId("proxy-refresh").addEventListener("click", () => loader.load(view));
  byId("proxy-show-all").addEventListener("click", () => choose("all"));
  doc.querySelectorAll("[data-status]").forEach(button => button.addEventListener("click", () => choose(button.dataset.status)));
  byId("proxy-sort").addEventListener("change", event => { view.sort = event.target.value === "reliability" ? "reliability" : "latency"; view.page = 1; syncUrl(); loader.load(view); });
  byId("proxy-previous").addEventListener("click", () => { if (view.page > 1) { view.page -= 1; syncUrl(); loader.load(view); } });
  byId("proxy-next").addEventListener("click", () => { if (currentState.snapshot && view.page < currentState.snapshot.total_pages) { view.page += 1; syncUrl(); loader.load(view); } });
  byId("proxy-list").addEventListener("click", event => {
    const link = event.target.closest?.("[data-connect-id]");
    if (!link) return;
    const proxy = currentState.snapshot?.proxies.find(item => item.id === link.dataset.connectId);
    if (!proxy || !connectUrl(proxy, currentState.snapshot)) { event.preventDefault(); render(currentState); }
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") clearTimers();
    else if (!stopped) { render(currentState); loader.load(view); }
  });
  win.addEventListener("popstate", () => { view = initialView(win.location.search); theme = view.theme || theme; loader.load(view); });
  win.addEventListener("pagehide", event => { clearTimers(); if (!event.persisted) { stopped = true; loader.dispose(); } });
  win.addEventListener("pageshow", event => { if (event.persisted && !stopped) loader.load(view); });
  translate();
  loader.load(view);
  return loader;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => bootProxyPage(), { once: true });
  else bootProxyPage();
}
