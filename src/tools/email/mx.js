/**
 * MX record parsing for the email infrastructure checker.
 */

/**
 * Parse MX string answers from DoH ("10 mail.example.com") into structured records.
 * Sorted by priority ascending. Null MX (host ".") is preserved.
 *
 * @param {string[]} rawRecords
 * @returns {{ found: boolean, records: { priority: number, host: string }[] }}
 */
export function analyzeMx(rawRecords) {
  const list = Array.isArray(rawRecords) ? rawRecords : [];
  const records = [];

  for (const raw of list) {
    const s = String(raw).trim();
    if (!s) continue;

    const parts = s.split(/\s+/);
    let priority = 0;
    let host = s;

    if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
      priority = Number(parts[0]);
      host = parts.slice(1).join(" ").replace(/\.$/, "") || ".";
    } else {
      host = s.replace(/\.$/, "") || ".";
    }

    records.push({ priority, host });
  }

  records.sort((a, b) => a.priority - b.priority || a.host.localeCompare(b.host));

  return {
    found: records.length > 0,
    records,
  };
}
