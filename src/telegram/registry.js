/**
 * Central command metadata for help, routing, cost, and visibility.
 */

/** @type {Array<{name:string, aliases?:string[], description:string, usage:string, category:string, requiresArgument:boolean, argumentType?:string, cost:'cheap'|'expensive', visibility?:'public'|'admin'}>} */
export const COMMANDS = [
  {
    name: "start",
    description: "Welcome and quick start",
    usage: "/start",
    category: "general",
    requiresArgument: false,
    cost: "cheap",
  },
  {
    name: "help",
    description: "List available commands",
    usage: "/help",
    category: "general",
    requiresArgument: false,
    cost: "cheap",
  },
  {
    name: "about",
    description: "What Cloud Engine is (and is not)",
    usage: "/about",
    category: "general",
    requiresArgument: false,
    cost: "cheap",
  },
  {
    name: "status",
    description: "Cloud Engine health check",
    usage: "/status",
    category: "general",
    requiresArgument: false,
    cost: "cheap",
  },
  {
    name: "id",
    description: "Your Telegram chat id (diagnostic)",
    usage: "/id",
    category: "general",
    requiresArgument: false,
    cost: "cheap",
  },
  {
    name: "admin",
    description: "Admin operational status",
    usage: "/admin",
    category: "admin",
    requiresArgument: false,
    cost: "cheap",
    visibility: "admin",
  },
  {
    name: "audit",
    aliases: ["check"],
    description: "Unified website audit",
    usage: "/audit example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
  {
    name: "website",
    aliases: ["site"],
    description: "On-page SEO overview",
    usage: "/website example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
  {
    name: "mobile",
    description: "Mobile configuration heuristics",
    usage: "/mobile example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
  {
    name: "robots",
    description: "robots.txt analysis",
    usage: "/robots example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
  {
    name: "sitemap",
    description: "sitemap.xml analysis",
    usage: "/sitemap https://example.com/sitemap.xml",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
  {
    name: "headers",
    description: "HTTP security headers",
    usage: "/headers example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
  {
    name: "ssl",
    description: "HTTPS / HSTS configuration",
    usage: "/ssl example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
  {
    name: "dns",
    description: "DNS record lookup",
    usage: "/dns example.com",
    category: "infrastructure",
    requiresArgument: true,
    argumentType: "domain",
    cost: "expensive",
  },
  {
    name: "email",
    description: "MX / SPF / DMARC / DKIM overview",
    usage: "/email example.com",
    category: "infrastructure",
    requiresArgument: true,
    argumentType: "domain",
    cost: "expensive",
  },
  {
    name: "http",
    description: "HTTP status and redirects",
    usage: "/http example.com",
    category: "infrastructure",
    requiresArgument: true,
    argumentType: "url",
    cost: "expensive",
  },
];

const byName = new Map();
const aliasToPrimary = new Map();

for (const c of COMMANDS) {
  byName.set(c.name, c);
  aliasToPrimary.set(c.name, c.name);
  for (const a of c.aliases || []) {
    aliasToPrimary.set(a, c.name);
  }
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

/** Public help — omits admin-only commands. */
export function formatHelpFromRegistry() {
  const groups = [
    { id: "general", title: "General" },
    { id: "website", title: "Website" },
    { id: "infrastructure", title: "Infrastructure" },
  ];
  const lines = ["SautiLink Cloud Engine", "", "Commands"];
  for (const g of groups) {
    lines.push("", g.title);
    for (const c of COMMANDS.filter(
      (x) => x.category === g.id && x.visibility !== "admin"
    )) {
      const alias =
        c.aliases && c.aliases.length
          ? ` (alias: ${c.aliases.map((a) => "/" + a).join(", ")})`
          : "";
      lines.push(`/${c.name}${alias}`);
      lines.push(`  ${c.description}`);
      lines.push(`  e.g. ${c.usage}`);
    }
  }
  lines.push(
    "",
    "Automated configuration checks — not a pentest or Lighthouse."
  );
  return lines.join("\n");
}
