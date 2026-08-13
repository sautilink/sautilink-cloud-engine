/**
 * Email infrastructure checker — MX + SPF + DMARC + DKIM via DoH.
 */

import { prepareDomain, lookupDns } from "../dns/index.js";
import { analyzeMx } from "./mx.js";
import { analyzeSpf } from "./spf.js";
import { analyzeDmarc } from "./dmarc.js";
import { checkDkim, prepareSelector } from "./dkim.js";

export { prepareDomain };

/**
 * @param {string} domainInput - raw domain query param
 * @param {string|null|undefined} [selectorInput] - optional DKIM selector
 * @returns {Promise<object>} data payload
 * @throws {{ code: string, message: string }}
 */
export async function checkEmailInfrastructure(domainInput, selectorInput) {
  const prepared = prepareDomain(domainInput);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
    };
  }

  const selPrep = prepareSelector(selectorInput);
  if (selPrep.error) {
    throw {
      code: selPrep.error.code,
      message: selPrep.error.message,
    };
  }

  const domain = prepared.domain;
  const dmarcName = `_dmarc.${domain}`;

  let dnsResult;
  let dmarcDns;
  let dkim;
  try {
    [dnsResult, dmarcDns, dkim] = await Promise.all([
      lookupDns(domain, ["MX", "TXT"]),
      lookupDns(dmarcName, ["TXT"]),
      checkDkim(domain, selPrep.selector),
    ]);
  } catch (err) {
    if (err && err.code === "DNS_RESOLVER_ERROR") {
      throw {
        code: "DNS_LOOKUP_FAILED",
        message: err.message || "Unable to reach the DNS resolver.",
      };
    }
    throw err;
  }

  const mx = analyzeMx(dnsResult.records.MX || []);
  const spf = analyzeSpf(dnsResult.records.TXT || []);
  const dmarc = analyzeDmarc(dmarcDns.records.TXT || []);

  return {
    domain,
    mx,
    spf,
    dmarc,
    dkim,
  };
}
