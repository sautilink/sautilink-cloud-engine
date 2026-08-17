import test from "node:test";
import assert from "node:assert/strict";

import {
  _resetPersonalisationForTests,
  getPresentationPreferences,
  hasPresentationPreferences,
  setPresentationPreferences,
  updatePresentationPreferences,
} from "../src/telegram/personalisation.js";
import { formatDns, formatWebsite } from "../src/telegram/format.js";
import { formatAuditReport } from "../src/telegram/audit_report.js";

const realNow = Date.now;

test.afterEach(() => {
  Date.now = realNow;
  _resetPersonalisationForTests();
});

test("presentation defaults are compact with developer mode off", () => {
  assert.deepEqual(getPresentationPreferences(123), {
    reportDetail: "compact",
    developerMode: false,
  });
  assert.equal(hasPresentationPreferences(123), false);
});

test("presentation cache hydrates, updates, expires, and remains bounded", () => {
  let now = 1_000_000;
  Date.now = () => now;
  setPresentationPreferences(123, { reportDetail: "detailed", developerMode: true });
  assert.equal(hasPresentationPreferences(123), true);
  assert.deepEqual(getPresentationPreferences(123), { reportDetail: "detailed", developerMode: true });

  updatePresentationPreferences(123, { developerMode: false });
  assert.deepEqual(getPresentationPreferences(123), { reportDetail: "detailed", developerMode: false });

  now += 5 * 60 * 1000 + 1;
  assert.equal(hasPresentationPreferences(123), false);
  assert.deepEqual(getPresentationPreferences(123), { reportDetail: "compact", developerMode: false });

  now += 1;
  for (let i = 0; i < 501; i += 1) {
    setPresentationPreferences(i, { reportDetail: "compact", developerMode: false });
  }
  assert.equal(hasPresentationPreferences(0), false);
  assert.equal(hasPresentationPreferences(500), true);
});

test("detailed DNS output returns more records than compact", () => {
  const data = {
    domain: "example.com",
    records: {
      A: ["1", "2", "3", "4", "5", "6"],
    },
  };
  const compact = formatDns(data, "en", { reportDetail: "compact", developerMode: false });
  const detailed = formatDns(data, "en", { reportDetail: "detailed", developerMode: false });
  assert.match(compact, /… \+2 more/);
  assert.doesNotMatch(detailed, /… \+2 more/);
  assert.match(detailed, /  6/);
});

test("developer mode adds target diagnostics and machine finding codes", () => {
  const data = {
    url: "https://example.com/",
    finalUrl: "https://www.example.com/",
    status: 200,
    responseTimeMs: 123,
    redirectCount: 1,
    contentType: "text/html",
    score: {
      total: 80,
      grade: "B",
      findings: [{ title: "Missing description", code: "META_DESCRIPTION_MISSING" }],
    },
  };
  const normal = formatWebsite(data, "en", { reportDetail: "compact", developerMode: false });
  const developer = formatWebsite(data, "en", { reportDetail: "compact", developerMode: true });
  assert.doesNotMatch(normal, /META_DESCRIPTION_MISSING/);
  assert.doesNotMatch(normal, /Developer details/);
  assert.match(developer, /META_DESCRIPTION_MISSING/);
  assert.match(developer, /Developer details/);
  assert.match(developer, /Requested: https:\/\/example\.com\//);
});

test("audit compact and detailed modes use different item limits", () => {
  const findings = Array.from({ length: 6 }, (_, i) => ({ title: `Finding ${i + 1}`, code: `F_${i + 1}` }));
  const recommendations = Array.from({ length: 6 }, (_, i) => ({ title: `Recommendation ${i + 1}`, code: `R_${i + 1}` }));
  const data = {
    domain: "example.com",
    score: { total: 75, max: 100, grade: "B" },
    categories: {},
    findings,
    recommendations,
  };

  const compact = formatAuditReport(data, "en", { reportDetail: "compact", developerMode: false });
  const detailed = formatAuditReport(data, "en", { reportDetail: "detailed", developerMode: false });
  assert.match(compact, /Finding 3/);
  assert.doesNotMatch(compact, /Finding 4/);
  assert.match(detailed, /Finding 6/);
  assert.match(detailed, /Recommendation 6/);
});

test("developer audit output adds machine codes without architecture details", () => {
  const data = {
    domain: "example.com",
    score: { total: 50, max: 100, grade: "C" },
    categories: {},
    findings: [{ title: "Missing header", code: "HEADER_MISSING" }],
    recommendations: [],
  };
  const output = formatAuditReport(data, "en", { reportDetail: "compact", developerMode: true });
  assert.match(output, /HEADER_MISSING/);
  assert.match(output, /Developer details/);
  assert.doesNotMatch(output, /Supabase|Cloudflare|GitHub/i);
});
