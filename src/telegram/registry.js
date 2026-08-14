/**
 * Central command metadata for help and routing.
 * Aliases map to a primary command name.
 */

/** @type {Array<{name:string, aliases?:string[], description:string, usage:string, category:string, requiresArgument:boolean, argumentType?:string, expensive?:boolean}>} */
export const COMMANDS = [
  {
    name: "start",
    description: "Welcome and quick start",
    usage: "/start",
    category: "general",
    requiresArgument: false,
  },
  {
    name: "help",
    description: "List available commands",
    usage: "/help",
    category: "general",
    requiresArgument: false,
  },
  {
    name: "about",
    description: "What Cloud Engine is (and is not)",
    usage: "/about",
    category: "general",
    requiresArgument: false,
  },
  {
    name: "status",
    description: "Cloud Engine health check",
    usage: "/status",
    category: "general",
    requiresArgument: false,
  },
  {
    name: "id",
    description: "Your Telegram chat id (diagnostic)",
    usage: "/id",
    category: "general",
    requiresArgument: false,
  },
  {
    name: "audit",
    aliases: ["check"],
    description: "Unified website audit",
    usage: "/audit example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
  },
  {
    name: "website",
    aliases: ["site"],
    description: "On-page SEO overview",
    usage: "/website example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
  },
  {
    name: "mobile",
    description: "Mobile configuration heuristics",
    usage: "/mobile example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
  },
  {
    name: "robots",
    description: "robots.txt analysis",
    usage: "/robots example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
  },
  {
    name: "sitemap",
    description: "sitemap.xml analysis",
    usage: "/sitemap https://example.com/sitemap.xml",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
  },
  {
    name: "headers",
    description: "HTTP security headers",
    usage: "/headers example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
  },
  {
    name: "ssl",
    description: "HTTPS / HSTS configuration",
    usage: "/ssl example.com",
    category: "website",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
  },
  {
    name: "dns",
    description: "DNS record lookup",
    usage: "/dns example.com",
    category: "infrastructure",
    requiresArgument: true,
    argumentType: "domain",
    expensive: true,
  },
  {
    name: "email",
    description: "MX / SPF / DMARC / DKIM overview",
    usage: "/email example.com",
    category: "infrastructure",
    requiresArgument: true,
    argumentType: "domain",
    expensive: true,
  },
  {
    name: "http",
    description: "HTTP status and redirects",
    usage: "/http example.com",
    category: "infrastructure",
    requiresArgument: true,
    argumentType: "url",
    expensive: true,
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

/** Resolve alias or primary name → primary command name. */
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

export function formatHelpFromRegistry() {
  const groups = [
    { id: "general", title: "General" },
    { id: "website", title: "Website" },
    { id: "infrastructure", title: "Infrastructure" },
  ];
  const lines = ["SautiLink Cloud Engine", "", "Commands"];
  for (const g of groups) {
    lines.push("", g.title);
    for (const c of COMMANDS.filter((x) => x.category === g.id)) {
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
