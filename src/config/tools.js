/** Tool registry — keep in sync with public/app.js */
export const TOOL_CATEGORIES = [
  {
    id: "website-seo",
    name: "Website & SEO",
    description: "Analyze sites, crawlers, performance and search readiness.",
    tools: [
      { id: "audit", name: "Website Audit", description: "Unified multi-analyzer report for a public URL.", route: "/tools/audit", status: "available" },
      { id: "website", name: "Website SEO & Performance", description: "On-page SEO, structure, social tags, and request-level timing.", route: "/tools/website", status: "available" },
      { id: "http-status", name: "HTTP Status Checker", description: "Check response status codes and redirects.", route: "/tools/http-status", status: "available" },
      { id: "robots", name: "Robots.txt Analyzer", description: "Fetch and analyze robots.txt crawl rules.", route: "/tools/robots", status: "available" },
      { id: "sitemap", name: "Sitemap Analyzer", description: "Inspect XML sitemaps and coverage.", route: "/tools/sitemap", status: "available" },
      { id: "mobile-friendly", name: "Mobile-Friendly Analyzer", description: "Viewport, responsive signals, and mobile SEO heuristics.", route: "/tools/mobile", status: "available" },
      { id: "lighthouse", name: "Lighthouse / Performance", description: "Performance, accessibility and best-practice insights.", route: "/tools/performance", status: "coming_soon" },
    ],
  },
  {
    id: "dns-email",
    name: "DNS & Email",
    description: "Inspect DNS records and email authentication setup.",
    tools: [
      { id: "dns-lookup", name: "DNS Lookup", description: "Query common DNS record types for a domain.", route: "/tools/dns", status: "available" },
      { id: "email-infra", name: "Email Infrastructure Checker", description: "Check MX, SPF, DMARC, DKIM and email security score.", route: "/tools/email", status: "available" },
      { id: "mx", name: "MX Record Checker", description: "Check MX records.", route: "/tools/mx", status: "available" },
      { id: "spf", name: "SPF Checker", description: "Validate SPF records.", route: "/tools/spf", status: "available" },
      { id: "dkim", name: "DKIM Checker", description: "Inspect DKIM selectors.", route: "/tools/dkim", status: "available" },
      { id: "dmarc", name: "DMARC Checker", description: "Review DMARC policy.", route: "/tools/dmarc", status: "available" },
      { id: "nameserver", name: "Nameserver Lookup", description: "List nameservers.", route: "/tools/nameserver", status: "available" },
    ],
  },
  {
    id: "security",
    name: "Security",
    description: "Basic security posture and infrastructure detection.",
    tools: [
      { id: "blacklist", name: "Blacklist Checker", description: "Check blacklists.", route: "/tools/blacklist", status: "coming_soon" },
      { id: "ssl", name: "SSL/TLS & HTTPS Analyzer", description: "Observable HTTPS, redirects, and HSTS (not full cert audit).", route: "/tools/ssl", status: "available" },
      { id: "security-headers", name: "HTTP Headers Analyzer", description: "Review security headers.", route: "/tools/headers", status: "available" },
      { id: "port-scanner", name: "Basic Port Scanner", description: "Common ports.", route: "/tools/ports", status: "coming_soon" },
      { id: "waf", name: "WAF Detector", description: "Detect WAF.", route: "/tools/waf", status: "coming_soon" },
      { id: "cloudflare", name: "Cloudflare Detector", description: "Detect Cloudflare.", route: "/tools/cloudflare", status: "coming_soon" },
      { id: "cdn", name: "CDN Detector", description: "Identify CDN.", route: "/tools/cdn", status: "coming_soon" },
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "Hosting, IP, ASN and server information.",
    tools: [
      { id: "ip", name: "IP Lookup", description: "Resolve public domain/IP details and reverse DNS context.", route: "/tools/ip", status: "available" },
      { id: "asn", name: "ASN Lookup", description: "ASN info.", route: "/tools/asn", status: "coming_soon" },
      { id: "hosting", name: "Hosting Provider Detector", description: "Hosting signals.", route: "/tools/hosting", status: "coming_soon" },
      { id: "rdns", name: "Reverse DNS", description: "PTR lookups for public IPv4/IPv6 addresses.", route: "/tools/rdns", status: "available" },
      { id: "http-headers", name: "HTTP Headers", description: "Response headers.", route: "/tools/headers", status: "available" },
      { id: "server-info", name: "Server Information", description: "Server signals.", route: "/tools/server", status: "coming_soon" },
    ],
  },
];
