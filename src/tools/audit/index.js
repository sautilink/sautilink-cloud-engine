/**
 * Unified Website Audit — orchestration layer over existing analyzers.
 */

import { prepareUrl } from "../http-status/url.js";
import { assertUrlSafeToFetch } from "../http-status/ssrf.js";
import { checkHttpStatus } from "../http-status/index.js";
import { analyzeHttpHeaders } from "../headers/index.js";
import { analyzeSsl } from "../ssl/index.js";
import { analyzeWebsite } from "../website/index.js";
import { analyzeMobile } from "../mobile/index.js";
import { analyzeRobotsTxt } from "../robots/index.js";
import { analyzeSitemap } from "../sitemap/index.js";
import { lookupDns, prepareDomain } from "../dns/index.js";
import { checkEmailInfrastructure } from "../email/index.js";
import {
  AUDIT_DEADLINE_MS,
  ANALYZER_TIMEOUT_MS,
  MAX_CONCURRENCY,
  AUDIT_ANALYZERS,
} from "./limits.js";
import {
  calculateUnifiedScore,
  normalizeFinding,
  normalizeRecommendation,
} from "./score.js";

/**
 * Score objects may use `total` (most tools) or `score` (headers security).
 * @param {object|null|undefined} s
 * @returns {number|null}
 */
function scoreValue(s) {
  if (!s || typeof s !== "object") return null;
  if (typeof s.total === "number") return s.total;
  if (typeof s.score === "number") return s.score;
  return null;
}

/**
 * @param {string} input
 */
export async function runWebsiteAudit(input) {
  const prepared = prepareUrl(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
      httpStatus: 400,
    };
  }

  const url = prepared.url;

  const safe = await assertUrlSafeToFetch(url);
  if (!safe.ok) {
    throw {
      code: safe.code,
      message: safe.message,
      httpStatus:
        safe.code === "PRIVATE_ADDRESS_BLOCKED" || safe.code === "SSRF_BLOCKED"
          ? 403
          : 400,
    };
  }

  const domain = url.hostname.replace(/\.$/, "").toLowerCase();
  const started = Date.now();
  const deadlineAt = started + AUDIT_DEADLINE_MS;

  const jobs = {
    httpStatus: () => checkHttpStatus(url.toString()),
    headers: () => analyzeHttpHeaders(url.toString()),
    ssl: () => analyzeSsl(url.toString()),
    website: () => analyzeWebsite(url.toString()),
    mobile: () => analyzeMobile(url.toString()),
    robots: () => analyzeRobotsTxt(url.toString()),
    dns: () => runDns(domain),
    email: () => checkEmailInfrastructure(domain, null),
    sitemap: () =>
      analyzeSitemap(new URL("/sitemap.xml", url.origin).toString()),
  };

  const analyzers = await runPool(
    AUDIT_ANALYZERS.map((id) => ({
      id,
      run: jobs[id],
    })),
    {
      concurrency: MAX_CONCURRENCY,
      deadlineAt,
      perTimeoutMs: ANALYZER_TIMEOUT_MS,
    }
  );

  const categoriesInput = buildCategories(analyzers);
  const score = calculateUnifiedScore(categoriesInput);

  const findings = [];
  const recommendations = [];
  for (const cat of Object.values(score.categories)) {
    for (const f of cat.findings || []) findings.push(f);
    for (const r of cat.recommendations || []) recommendations.push(r);
  }

  const findingsOut = dedupeByCodeSource(findings);
  const recsOut = dedupeByCodeSource(recommendations);
  findingsOut.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  return {
    url: url.toString(),
    domain,
    score: {
      total: score.total,
      max: score.max,
      percentage: score.percentage,
      grade: score.grade,
      label: score.label,
      version: score.version,
      renormalized: score.renormalized,
      weightSumUsed: score.weightSumUsed,
      disclaimer: score.disclaimer,
    },
    categories: score.categories,
    findings: findingsOut.slice(0, 80),
    recommendations: recsOut.slice(0, 40),
    analyzers: summarizeAnalyzers(analyzers),
    meta: {
      durationMs: Date.now() - started,
      deadlineMs: AUDIT_DEADLINE_MS,
      concurrency: MAX_CONCURRENCY,
      analyzerTimeoutMs: ANALYZER_TIMEOUT_MS,
    },
  };
}

async function runDns(domain) {
  const prepared = prepareDomain(domain);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
    };
  }
  return lookupDns(prepared.domain, ["A", "AAAA", "NS", "MX"]);
}

async function runPool(tasks, { concurrency, deadlineAt, perTimeoutMs }) {
  const results = {};
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      if (Date.now() >= deadlineAt) {
        while (idx < tasks.length) {
          const t = tasks[idx++];
          results[t.id] = {
            status: "deadline_skipped",
            error: {
              code: "AUDIT_DEADLINE",
              message:
                "Global audit deadline reached before this analyzer started.",
            },
            data: null,
            durationMs: 0,
          };
        }
        return;
      }

      const current = tasks[idx++];
      const t0 = Date.now();
      const remainingGlobal = Math.max(0, deadlineAt - Date.now());
      const budget = Math.min(perTimeoutMs, remainingGlobal);

      if (budget < 200) {
        results[current.id] = {
          status: "deadline_skipped",
          error: {
            code: "AUDIT_DEADLINE",
            message: "Insufficient time remaining for analyzer.",
          },
          data: null,
          durationMs: 0,
        };
        continue;
      }

      try {
        const data = await withTimeout(current.run(), budget, current.id);
        results[current.id] = {
          status: "ok",
          error: null,
          data,
          durationMs: Date.now() - t0,
        };
      } catch (err) {
        const code = err && err.code ? err.code : "ANALYZER_ERROR";
        const status =
          code === "ANALYZER_TIMEOUT" || code === "AUDIT_DEADLINE"
            ? "timeout"
            : code === "PRIVATE_ADDRESS_BLOCKED" || code === "SSRF_BLOCKED"
              ? "blocked"
              : "error";
        results[current.id] = {
          status,
          error: {
            code,
            message:
              err && err.message ? String(err.message) : "Analyzer failed.",
          },
          data: null,
          durationMs: Date.now() - t0,
        };
      }
    }
  }

  const n = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

function withTimeout(promise, ms, id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject({
        code: "ANALYZER_TIMEOUT",
        message: `Analyzer “${id}” timed out after ${ms}ms.`,
      });
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function buildCategories(analyzers) {
  const get = (id) => analyzers[id];
  const ok = (id) => get(id) && get(id).status === "ok" && get(id).data;

  const security = {
    available: false,
    score: null,
    findings: [],
    recommendations: [],
    sources: [],
  };
  if (ok("headers")) {
    const d = get("headers").data;
    const s = d.security || d.score;
    const val = scoreValue(s);
    if (val != null) {
      security.available = true;
      security.score = val;
      security.sources = ["headers"];
      for (const f of s.findings || []) {
        const n = normalizeFinding(f, "headers", "security");
        if (n) security.findings.push(n);
      }
      for (const r of s.recommendations || []) {
        const n = normalizeRecommendation(r, "headers", "security");
        if (n) security.recommendations.push(n);
      }
    }
  } else if (get("headers")) security.status = get("headers").status;

  const seo = {
    available: false,
    score: null,
    findings: [],
    recommendations: [],
    sources: [],
  };
  if (ok("website")) {
    const s = get("website").data.score;
    const val = scoreValue(s);
    if (val != null) {
      seo.available = true;
      seo.score = val;
      seo.sources = ["website"];
      for (const f of s.findings || []) {
        const n = normalizeFinding(f, "website", "seo");
        if (n) seo.findings.push(n);
      }
      for (const r of s.recommendations || []) {
        const n = normalizeRecommendation(r, "website", "seo");
        if (n) seo.recommendations.push(n);
      }
    }
  } else if (get("website")) seo.status = get("website").status;

  const mobile = {
    available: false,
    score: null,
    findings: [],
    recommendations: [],
    sources: [],
  };
  if (ok("mobile")) {
    const s = get("mobile").data.score;
    const val = scoreValue(s);
    if (val != null) {
      mobile.available = true;
      mobile.score = val;
      mobile.sources = ["mobile"];
      for (const f of s.findings || []) {
        const n = normalizeFinding(f, "mobile", "mobile");
        if (n) mobile.findings.push(n);
      }
      for (const r of s.recommendations || []) {
        const n = normalizeRecommendation(r, "mobile", "mobile");
        if (n) mobile.recommendations.push(n);
      }
    }
  } else if (get("mobile")) mobile.status = get("mobile").status;

  const infrastructure = {
    available: false,
    score: null,
    findings: [],
    recommendations: [],
    sources: [],
  };
  {
    const parts = [];
    if (ok("dns")) {
      const d = get("dns").data;
      const rec = d.records || {};
      const hasAddress =
        (Array.isArray(rec.A) && rec.A.length > 0) ||
        (Array.isArray(rec.AAAA) && rec.AAAA.length > 0);
      parts.push({ source: "dns", score: hasAddress ? 85 : 40 });
      infrastructure.sources.push("dns");
    }
    if (ok("httpStatus")) {
      const st = get("httpStatus").data.status;
      let hs = 50;
      if (st >= 200 && st < 400) hs = 90;
      else if (st >= 400 && st < 500) hs = 45;
      else if (st >= 500) hs = 25;
      parts.push({ source: "httpStatus", score: hs });
      infrastructure.sources.push("httpStatus");
    }
    if (parts.length) {
      infrastructure.available = true;
      infrastructure.score = Math.round(
        parts.reduce((a, p) => a + p.score, 0) / parts.length
      );
    } else if (get("dns") || get("httpStatus")) {
      infrastructure.status =
        (get("dns") && get("dns").status) ||
        (get("httpStatus") && get("httpStatus").status) ||
        "unavailable";
    }
  }

  const email = {
    available: false,
    score: null,
    findings: [],
    recommendations: [],
    sources: [],
  };
  if (ok("email")) {
    const s = get("email").data.score;
    const val = scoreValue(s);
    if (val != null) {
      email.available = true;
      email.score = val;
      email.sources = ["email"];
      for (const f of s.findings || []) {
        const n = normalizeFinding(f, "email", "email");
        if (n) email.findings.push(n);
      }
      for (const r of s.recommendations || []) {
        const n = normalizeRecommendation(r, "email", "email");
        if (n) email.recommendations.push(n);
      }
    }
  } else if (get("email")) email.status = get("email").status;

  const https = {
    available: false,
    score: null,
    findings: [],
    recommendations: [],
    sources: [],
  };
  if (ok("ssl")) {
    const s = get("ssl").data.score;
    const val = scoreValue(s);
    if (val != null) {
      https.available = true;
      https.score = val;
      https.sources = ["ssl"];
      for (const f of s.findings || []) {
        const n = normalizeFinding(f, "ssl", "https");
        if (n) https.findings.push(n);
      }
      for (const r of s.recommendations || []) {
        const n = normalizeRecommendation(r, "ssl", "https");
        if (n) https.recommendations.push(n);
      }
    }
  } else if (get("ssl")) https.status = get("ssl").status;

  const technical = {
    available: false,
    score: null,
    findings: [],
    recommendations: [],
    sources: [],
  };
  {
    const parts = [];
    if (ok("robots")) {
      const s = get("robots").data.score;
      const val = scoreValue(s);
      if (val != null) {
        parts.push(val);
        technical.sources.push("robots");
        for (const f of s.findings || []) {
          const n = normalizeFinding(f, "robots", "technical");
          if (n) technical.findings.push(n);
        }
      }
    }
    if (ok("sitemap")) {
      const s = get("sitemap").data.score;
      const val = scoreValue(s);
      if (val != null) {
        parts.push(val);
        technical.sources.push("sitemap");
        for (const f of s.findings || []) {
          const n = normalizeFinding(f, "sitemap", "technical");
          if (n) technical.findings.push(n);
        }
      }
    }
    if (parts.length) {
      technical.available = true;
      technical.score = Math.round(
        parts.reduce((a, b) => a + b, 0) / parts.length
      );
    } else if (get("robots") || get("sitemap")) {
      technical.status =
        (get("robots") && get("robots").status) ||
        (get("sitemap") && get("sitemap").status) ||
        "unavailable";
    }
  }

  return {
    security,
    seo,
    mobile,
    infrastructure,
    email,
    https,
    technical,
  };
}

function summarizeAnalyzers(analyzers) {
  const out = {};
  for (const id of AUDIT_ANALYZERS) {
    const a = analyzers[id] || {
      status: "skipped",
      error: null,
      durationMs: 0,
    };
    out[id] = {
      status: a.status,
      durationMs: a.durationMs || 0,
      error: a.error || null,
    };
  }
  return out;
}

function dedupeByCodeSource(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.source}:${it.code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function severityRank(s) {
  const m = { error: 0, warning: 1, info: 2, success: 3 };
  return m[String(s)] != null ? m[String(s)] : 9;
}
