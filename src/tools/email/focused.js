/**
 * Focused email/DNS checks over the existing analyzer modules.
 * Keeps standalone web tools efficient without duplicating analyzer logic.
 */

import { prepareDomain, lookupDns } from "../dns/index.js";
import { analyzeMx } from "./mx.js";
import { analyzeSpf } from "./spf.js";
import { analyzeDmarc } from "./dmarc.js";
import { checkDkim, prepareSelector } from "./dkim.js";

export const FOCUSED_EMAIL_CHECKS = ["mx", "spf", "dmarc", "dkim"];

function fail(code, message) {
  throw { code, message };
}

/**
 * Run exactly one focused email infrastructure check.
 * @param {string|null|undefined} domainInput
 * @param {string|null|undefined} checkInput
 * @param {string|null|undefined} selectorInput
 */
export async function runFocusedEmailCheck(domainInput, checkInput, selectorInput) {
  const prepared = prepareDomain(domainInput);
  if (prepared.error) fail(prepared.error.code, prepared.error.message);

  const check = String(checkInput || "").trim().toLowerCase();
  if (!check) fail("MISSING_CHECK", "Choose an email infrastructure check.");
  if (!FOCUSED_EMAIL_CHECKS.includes(check)) {
    fail("INVALID_EMAIL_CHECK", "Unsupported email infrastructure check.");
  }

  const domain = prepared.domain;

  try {
    if (check === "mx") {
      const dns = await lookupDns(domain, ["MX"]);
      return { domain, check, result: analyzeMx(dns.records.MX || []) };
    }

    if (check === "spf") {
      const dns = await lookupDns(domain, ["TXT"]);
      return { domain, check, result: analyzeSpf(dns.records.TXT || []) };
    }

    if (check === "dmarc") {
      const dns = await lookupDns(`_dmarc.${domain}`, ["TXT"]);
      return { domain, check, result: analyzeDmarc(dns.records.TXT || []) };
    }

    const selector = prepareSelector(selectorInput);
    if (selector.error) fail(selector.error.code, selector.error.message);
    return {
      domain,
      check,
      result: await checkDkim(domain, selector.selector),
    };
  } catch (err) {
    if (err && err.code === "DNS_RESOLVER_ERROR") {
      fail("DNS_LOOKUP_FAILED", err.message || "Unable to reach the DNS resolver.");
    }
    throw err;
  }
}
