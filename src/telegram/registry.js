import { t } from "./i18n/index.js";

export const COMMANDS = [
  { name: "start", descriptionKey: "help.start", usage: "/start", category: "general", requiresArgument: false, cost: "cheap" },
  { name: "help", descriptionKey: "help.help", usage: "/help", category: "general", requiresArgument: false, cost: "cheap" },
  { name: "about", descriptionKey: "help.about", usage: "/about", category: "general", requiresArgument: false, cost: "cheap" },
  { name: "status", descriptionKey: "help.status", usage: "/status", category: "general", requiresArgument: false, cost: "cheap" },
  { name: "id", descriptionKey: "help.id", usage: "/id", category: "general", requiresArgument: false, cost: "cheap" },
  { name: "lang", descriptionKey: "help.lang", usage: "/lang sw", category: "general", requiresArgument: false, cost: "cheap" },
  { name: "admin", description: "Admin operational status", usage: "/admin", category: "admin", requiresArgument: false, cost: "cheap", visibility: "admin" },
  { name: "audit", aliases: ["check"], descriptionKey: "help.audit", usage: "/audit example.com", category: "website", requiresArgument: true, argumentType: "url", cost: "expensive" },
  { name: "website", aliases: ["site"], descriptionKey: "help.website_cmd", usage: "/website example.com", category: "website", requiresArgument: true, argumentType: "url", cost: "expensive" },
  { name: "mobile", descriptionKey: "help.mobile", usage: "/mobile example.com", category: "website", requiresArgument: true, argumentType: "url", cost: "expensive" },
  { name: "robots", descriptionKey: "help.robots", usage: "/robots example.com", category: "website", requiresArgument: true, argumentType: "url", cost: "expensive" },
  { name: "sitemap", descriptionKey: "help.sitemap", usage: "/sitemap https://example.com/sitemap.xml", category: "website", requiresArgument: true, argumentType: "url", cost: "expensive" },
  { name: "headers", descriptionKey: "help.headers", usage: "/headers example.com", category: "website", requiresArgument: true, argumentType: "url", cost: "expensive" },
  { name: "ssl", descriptionKey: "help.ssl", usage: "/ssl example.com", category: "website", requiresArgument: true, argumentType: "url", cost: "expensive" },
  { name: "dns", descriptionKey: "help.dns", usage: "/dns example.com", category: "infrastructure", requiresArgument: true, argumentType: "domain", cost: "expensive" },
  { name: "email", descriptionKey: "help.email", usage: "/email example.com", category: "infrastructure", requiresArgument: true, argumentType: "domain", cost: "expensive" },
  { name: "http", descriptionKey: "help.http", usage: "/http example.com", category: "infrastructure", requiresArgument: true, argumentType: "url", cost: "expensive" },
];

const byName = new Map();
const aliasToPrimary = new Map();
for (const c of COMMANDS) {
  byName.set(c.name, c);
  aliasToPrimary.set(c.name, c.name);
  for (const a of c.aliases || []) aliasToPrimary.set(a, c.name);
}

export function resolveCommandName(name) {
  if (!name) return null;
  return aliasToPrimary.get(String(name).toLowerCase()) || null;
}

export function getCommandMeta(name) {
  const primary = resolveCommandName(name);
  return primary ? byName.get(primary) : null;
}

export function knownCommandNames() {
  return new Set(aliasToPrimary.keys());
}

export function formatHelpFromRegistry(locale = "en") {
  const groups = [
    { id: "general", title: t(locale, "help.general") },
    { id: "website", title: t(locale, "help.website") },
    { id: "infrastructure", title: t(locale, "help.infrastructure") },
  ];
  const lines = ["SautiLink Cloud Engine", "", t(locale, "help.commands")];
  for (const g of groups) {
    lines.push("", g.title);
    for (const c of COMMANDS.filter((x) => x.category === g.id && x.visibility !== "admin")) {
      const alias = c.aliases && c.aliases.length ? ` (${t(locale, "help.alias")}: ${c.aliases.map((a) => "/" + a).join(", ")})` : "";
      lines.push(`/${c.name}${alias}`);
      lines.push(`  ${c.descriptionKey ? t(locale, c.descriptionKey) : c.description}`);
      lines.push(`  ${t(locale, "help.example")} ${c.usage}`);
    }
  }
  lines.push("", t(locale, "help.disclaimer"));
  return lines.join("\n");
}
