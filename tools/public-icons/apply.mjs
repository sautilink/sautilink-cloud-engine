// One-time, repeatable markup migration. The renderer is the shared SautiLink
// public-icon helper; this script does not define any icon geometry.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

if (!process.argv[2]) throw new Error("Pass the shared public-icon markup helper path.");
const helper = await import(pathToFileURL(resolve(process.argv[2])).href);
const render = helper.iconMarkup;
if (typeof render !== "function") throw new Error("The shared helper must export iconMarkup(name, attrs).");

const rootPages = ["index", "faq", "privacy", "terms", "account-deletion"];
const pages = [...rootPages.map((name) => `public/${name}.html`),
  ...readdirSync("public/tools").filter((name) => name.endsWith(".html")).map((name) => `public/tools/${name}`)];
const toolIcons = {
  audit: "analytics-0-1", website: "globe-0-2", "http-status": "activity", robots: "file-0-1",
  sitemap: "lucide:network", mobile: "lucide:smartphone", cache: "refresh-0-1", dns: "lucide:router",
  email: "mail-0-1", mx: "mail-0-1", spf: "shield-check", dkim: "lock-keyhole", dmarc: "shield-check",
  nameserver: "server", ssl: "lock-keyhole", headers: "shield-check", cors: "security-block",
  ip: "globe-0-2", rdns: "lucide:network", server: "server",
};
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const svg = (name, classes = "") => render(name, { class: `public-icon ${classes}`.trim() });

function labelIcon(text, href = "", fallback = "arrow-right-0-2") {
  const route = href.match(/^\/tools\/([^?#/]+)/)?.[1];
  if (route && toolIcons[route]) return toolIcons[route];
  if (/telegram|companion/i.test(text) || /^https:\/\/t\.me\//.test(href)) return "send";
  if (/delete|\bclear\b|remove/i.test(text)) return "delete-0-2";
  if (/privacy|data/i.test(text)) return "lock-keyhole";
  if (/terms|legal/i.test(text)) return "sautilink:justice-scale";
  if (/workspace|^home$/i.test(text)) return "home-0-1";
  if (/full audit|audit/i.test(text)) return "analytics-0-1";
  if (/tools/i.test(text)) return "settings-0-1";
  if (/faq|help|questions/i.test(text)) return "help-circle";
  if (/status|engine|service/i.test(text)) return "activity";
  if (/api/i.test(text)) return "code";
  if (/blog|sautinote/i.test(text)) return "book-open-0-1";
  if (/contact|email/i.test(text)) return "mail-0-1";
  if (/about|sautilink/i.test(text)) return "user-group";
  if (/export|download/i.test(text)) return "download";
  if (/copy/i.test(text)) return "copy";
  if (/print/i.test(text)) return "printer";
  if (/link/i.test(text)) return "attachment-0-1";
  if (/compar/i.test(text)) return "repeat";
  if (/close/i.test(text)) return "cancel-0-1";
  if (/^open website/i.test(text)) return "lucide:external-link";
  if (/^errors|^warnings|^findings|^priority/i.test(text)) return "flag-0-1";
  if (/^passed|^recommendations/i.test(text)) return "check";
  if (/^info/i.test(text)) return "help-circle";
  if (/^analyzers/i.test(text)) return "activity";
  if (/analyz|check|inspect|look up/i.test(text)) return "search";
  return fallback;
}

function headingIcon(text, page) {
  if (/cloud engine/i.test(text)) return "lucide:cloud";
  if (/sautilink|social|groups/i.test(text)) return "user-group";
  if (/legal|terms|rights|bases|controller|exceptions/i.test(text)) return "sautilink:justice-scale";
  if (/privacy|protect|cookies|personal|security|safe|children/i.test(text)) return "shield-check";
  if (/account|identity|registered/i.test(text)) return "user";
  if (/delet|\bclear\b/i.test(text)) return "delete-0-2";
  if (/telegram|conversation|companion/i.test(text)) return "send";
  if (/choose how you use/i.test(text)) return "shield-check";
  if (/check you need/i.test(text)) return "search";
  if (/report|score|picture|overview|summary|audit|details|signals/i.test(text)) return "analytics-0-1";
  if (/recommend|next step|useful answers/i.test(text)) return "check";
  if (/findings|review|priority/i.test(text)) return "flag-0-1";
  if (/timing|duration|kept|retention/i.test(text)) return "clock-0-1";
  if (/recent|change/i.test(text)) return "refresh-0-1";
  if (/contact|complaint|email|mx/i.test(text)) return "mail-0-1";
  if (/server|infrastructure|proxy/i.test(text)) return "server";
  if (/dns|sitemap|redirect/i.test(text)) return "lucide:network";
  if (/certificate|tls|https|hsts|spf|dkim|dmarc/i.test(text)) return "lock-keyhole";
  if (/image|media/i.test(text)) return "image-0-1";
  if (/viewport|mobile/i.test(text)) return "lucide:smartphone";
  if (/status|healthy|engine|service|delivery/i.test(text)) return "activity";
  if (/category|tools|scope|settings|preferences/i.test(text)) return "settings-0-1";
  if (/web|seo|url|targets|request|response|fetch/i.test(text)) return "globe-0-2";
  if (/export|keep the useful/i.test(text)) return "download";
  if (/help|question/i.test(text)) return "help-circle";
  return toolIcons[page] ?? (page === "terms" ? "sautilink:justice-scale" : "file-0-1");
}

for (const path of pages) {
  // A pinned base may be supplied when refreshing this migration before review.
  const base = process.argv.find((arg) => arg.startsWith("--base="))?.slice(7);
  let html = base ? execFileSync("git", ["show", `${base}:${path}`], { encoding: "utf8" }) : readFileSync(path, "utf8");
  if (html.includes("data-public-icons")) continue;
  const page = path.split("/").at(-1).replace(/\.html$/, "");
  html = html.replace(/<body\b([^>]*)>/, '<body$1 data-public-icons>');
  html = html.replace("</head>", `  <link rel="stylesheet" href="/assets/public-icons/icons.css?v=20261019-1" />\n  <link rel="stylesheet" href="/assets/brand/public-icon-surfaces.css?v=20261019-1" />\n  <script src="/assets/public-icons/icons.js?v=20261019-1" defer></script>\n  <script src="/assets/public-icons/adapter.js?v=20261019-1" defer></script>\n  <script src="/assets/brand/public-icon-surfaces.js?v=20261019-1" defer></script>\n</head>`);

  // Keep corporate/product marks and official social brand glyphs unchanged.
  html = html.replace(/(<a\b[^>]*class="[^"]*\bnav-link\b[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/g,
    (_, open, content, close) => `${open}${svg(labelIcon(plain(content), open.match(/href="([^"]+)"/)?.[1]))}<span>${content}</span>${close}`);
  html = html.replace(/(<button\b[^>]*class="nav-toggle"[^>]*>)([\s\S]*?)(<\/button>)/g,
    (_, open, _content, close) => `${open}${svg("menu-0-1")}${close}`);

  html = html.replace(/<(h[234])\b([^>]*)>([\s\S]*?)<\/\1>/g, (_, tag, attrs, content) => {
    if (/id="(?:report-domain|category-detail-title|result-title)"/.test(attrs) || plain(content) === "—") return `<${tag}${attrs}>${content}</${tag}>`;
    const cls = attrs.includes('class="') ? attrs.replace(/class="/, 'class="cloud-heading ') : `${attrs} class="cloud-heading"`;
    return `<${tag}${cls}>${svg(headingIcon(plain(content), page))}<span>${content}</span></${tag}>`;
  });

  // Keep h1 text markup stable for heading semantics, indexing and existing clients.
  if (page !== "index") html = html.replace(/<h1>([\s\S]*?)<\/h1>/, (_, text) => `<div class="cloud-title-row" data-public-icon-intro data-public-icon-trigger>${svg(toolIcons[page] ?? (page === "faq" ? "help-circle" : page === "privacy" ? "shield-check" : page === "terms" ? "sautilink:justice-scale" : "user"))}<h1>${text}</h1></div>`);
  html = html.replace(/(<(?:a|button)\b[^>]*class="[^"]*\b(?:btn|text-button|report-tab|filter-chip)\b[^"]*"[^>]*>)([\s\S]*?)(<\/(?:a|button)>)/g,
    (_, open, content, close) => {
      if (/href="\/account\//.test(open) || /data-public-icon/.test(content)) return `${open}${content}${close}`;
      const name = labelIcon(plain(content), open.match(/href="([^"]+)"/)?.[1], toolIcons[page] ?? "arrow-right-0-2");
      const attrs = open.replace(/class="/, 'class="cloud-icon-label ').replace(/>$/, ` data-cloud-action-icon="${name}">`);
      return `${attrs}${svg(name)}${content}${close}`;
    });
  html = html.replace(/(<div class="product-footer-links">)([\s\S]*?)(<\/div>)/g, (_, open, content, close) => {
    return `${open}${content.replace(/(<a\b[^>]*>)([\s\S]*?)(<\/a>)/g, (_match, link, text, end) => {
      if (/href="\/account\//.test(link)) return `${link}${text}${end}`;
      return `${link.replace(/>$/, ' class="cloud-icon-label">')}${svg(labelIcon(plain(text), link.match(/href="([^"]+)"/)?.[1]))}<span>${text}</span>${end}`;
    })}${close}`;
  });
  html = html.replace(/(<summary>)([^<][\s\S]*?)(<\/summary>)/g, (_, open, content, close) => {
    if (page !== "faq") return `${open}${content}${close}`;
    return `${open}<span class="faq-question">${svg(headingIcon(plain(content), page))}<span>${content}</span></span>${close}`;
  });
  html = html.replace(/(<div class="(?:command-input-wrap|audit-input-wrap)">\s*)<svg[\s\S]*?<\/svg>/g, (_, open) => `${open}${svg("search")}`);
  html = html.replace(/(<article\b[^>]*class="[^"]*\b(?:feature-card|principle-card|bridge-card|workspace-card)\b[^"]*")/g, '$1 data-public-icon-trigger');
  html = html.replace('<p style="margin-top:1rem">', '<p class="cloud-bridge-cta">');
  writeFileSync(path, html.replace(/\r\n/g, "\n"));
}

console.log(`Prepared ${pages.length} public pages; account/auth/API files were not opened for writing.`);
