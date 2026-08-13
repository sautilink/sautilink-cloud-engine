/**
 * Email infrastructure checker — MX + SPF + DMARC via shared DoH lookups.
 */

import { prepareDomain, lookupDns } from "../dns/index.js";
import { analyzeMx } from "./mx.js";
import { analyzeSpf } from "./spf.js";
import { analyzeDmarc } from "./dmarc.js";

export { prepareDomain };

/**
 * @param {string} input - raw domain query param
 * @returns {Promise<object>} data payload
 * @throws {{ code: string, message: string }}
 */
export async function checkEmailInfrastructure(input) {
  const prepared = prepareDomain(input);
  if (prepared.error) {
    throw {
      code: prepared.error.code,
      message: prepared.error.message,
    };
  }

  const domain = prepared.domain;
  const dmarcName = `_dmarc.${domain}`;

  let dnsResult;
  let dmarcDns;
  try {
    [dnsResult, dmarcDns] = await Promise.all([
      lookupDns(domain, ["MX", "TXT"]),
      lookupDns(dmarcName, ["TXT"]),
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
  };
}
