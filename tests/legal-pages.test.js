import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const privacy = read("public/privacy.html");
const terms = read("public/terms.html");
const deletion = read("public/account-deletion.html");
const legalCss = read("public/legal.css");
const legalJs = read("public/legal.js");
const sitemap = read("public/sitemap.xml");
const llms = read("public/llms.txt");
const legalPages = [privacy, terms, deletion];

test("legal pages use Cloud Engine metadata and the shared product UI", () => {
  assert.match(privacy, /<title>Privacy Policy — SautiLink Cloud Engine<\/title>/);
  assert.match(terms, /<title>Terms of Service — SautiLink Cloud Engine<\/title>/);
  assert.match(deletion, /<title>Delete Your Account &amp; Data — SautiLink Cloud Engine<\/title>/);

  for (const page of legalPages) {
    assert.match(page, /Manrope-Variable\.woff2\?v=1/);
    assert.match(page, /typography-manrope\.css\?v=1/);
    assert.match(page, /href="\/legal\.css\?v=1"/);
    assert.match(page, /src="\/legal\.js\?v=1"/);
    assert.match(page, /class="legal-hero"/);
    assert.match(page, /data-legal-toc/);
    assert.match(page, /class="site-footer legal-footer"/);
    assert.doesNotMatch(page, /fonts\.googleapis|fonts\.gstatic/i);
    assert.doesNotMatch(page, /<style>|<script>(?!\s*\{)/i);
  }

  assert.match(privacy, /rel="canonical" href="https:\/\/cloudengine\.sautilink\.com\/privacy"/);
  assert.match(terms, /rel="canonical" href="https:\/\/cloudengine\.sautilink\.com\/terms"/);
  assert.match(deletion, /rel="canonical" href="https:\/\/cloudengine\.sautilink\.com\/account-deletion"/);
});

test("privacy policy describes current data flows, providers and user rights", () => {
  for (const topic of [
    /Information we process/i,
    /Diagnostic targets, requests and results/i,
    /Cookies, sessions and storage on your device/i,
    /How we use information/i,
    /Legal bases for processing/i,
    /International data transfers/i,
    /How long information is kept/i,
    /How we protect information/i,
    /Your rights and choices/i,
    /Account and data deletion/i,
    /Children and younger users/i,
  ]) assert.match(privacy, topic);

  for (const provider of [/Cloudflare/, /Supabase/, /ZeptoMail/, /Telegram/]) {
    assert.match(privacy, provider);
  }

  assert.match(privacy, /do not sell personal data/i);
  assert.match(privacy, /do not collect card or billing details/i);
  assert.match(privacy, /does not currently maintain an application-level history of anonymous scans/i);
  assert.match(privacy, /Tanzania Personal Data Protection Act, 2022/i);
});

test("terms cover free responsible use, report limits and software licensing", () => {
  for (const topic of [
    /Free service and no current payments/i,
    /SautiLink Accounts/i,
    /Acceptable use/i,
    /responsibility for diagnostic targets/i,
    /API, automation and rate limits/i,
    /Reports, scores, recommendations and exports/i,
    /Public source code and software licences/i,
    /Privacy and communications/i,
    /Suspension, termination and account deletion/i,
    /Service disclaimers/i,
    /Limitation of liability/i,
    /laws of the United Republic of Tanzania/i,
  ]) assert.match(terms, topic);

  assert.match(terms, /do not currently sell subscriptions, paid reports, credits or in-app purchases/i);
  assert.match(terms, /Public visibility alone is not a software licence/i);
  assert.match(terms, /rather than a guarantee or professional certification/i);
});

test("deletion page provides a complete and safe external request route", () => {
  assert.match(deletion, /registered email/i);
  assert.match(deletion, /username/i);
  assert.match(deletion, /Telegram user ID/i);
  assert.match(deletion, /support@sautilink\.com/);
  assert.match(deletion, /within <strong>30 days<\/strong>/i);
  assert.match(deletion, /never ask for your password or OTP/i);
  assert.match(deletion, /not the same as temporary suspension or deactivation/i);
  assert.match(deletion, /data-clear-recents/);
  assert.match(deletion, /Google Play/);
  assert.match(deletion, /Apple App Store/);
});

test("all legal surfaces publish the official contacts and address", () => {
  for (const page of legalPages) {
    assert.match(page, /team@sautilink\.com/);
    assert.match(page, /support@sautilink\.com/);
    assert.match(page, /Uhuru Street, Mwanza, Tanzania/i);
  }
});

test("legal UI is responsive, printable and exposes browser-local deletion", () => {
  assert.match(legalCss, /position:\s*sticky/);
  assert.match(legalCss, /@media \(max-width: 980px\)/);
  assert.match(legalCss, /@media \(max-width: 720px\)/);
  assert.match(legalCss, /@media \(max-width: 520px\)/);
  assert.match(legalCss, /@media print/);
  assert.match(legalJs, /IntersectionObserver/);
  assert.match(legalJs, /localStorage\.removeItem\("sautilink\.cloudengine\.recentTargets\.v1"\)/);
  assert.match(legalJs, /aria-expanded/);
});

test("legal and deletion pages are discoverable", () => {
  for (const route of ["privacy", "terms", "account-deletion"]) {
    assert.match(sitemap, new RegExp(`https:\\/\\/cloudengine\\.sautilink\\.com\\/${route}`));
    assert.match(llms, new RegExp(`https:\\/\\/cloudengine\\.sautilink\\.com\\/${route}`));
  }
});
