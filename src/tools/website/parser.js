/**
 * Lightweight HTML extraction (no JS execution, no DOM deps).
 */

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return Number.isFinite(c) && c < 0xffff ? String.fromCharCode(c) : _;
    });
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * @param {string} html
 */
export function parseHtmlDocument(html) {
  const text = typeof html === "string" ? html : "";
  const lower = text.toLowerCase();

  const hasDoctype = /<!doctype\s+html/i.test(text);
  const hasHtml = /<html[\s>]/i.test(text);
  const hasHead = /<head[\s>]/i.test(text);
  const hasBody = /<body[\s>]/i.test(text);

  let lang = null;
  const langM = text.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i);
  if (langM) lang = langM[1].trim();

  let charset = null;
  const cs1 = text.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  if (cs1) charset = cs1[1];
  else {
    const cs2 = text.match(
      /<meta[^>]+http-equiv\s*=\s*["']content-type["'][^>]+content\s*=\s*["'][^"']*charset=([\w-]+)/i
    );
    if (cs2) charset = cs2[1];
  }

  const titles = [];
  const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/gi;
  let tm;
  while ((tm = titleRe.exec(text)) !== null) {
    titles.push(stripTags(tm[1]));
    if (titles.length > 5) break;
  }

  const metas = extractMetas(text);
  const links = extractLinks(text);
  const canonical =
    links.find((l) => (l.rel || "").toLowerCase().includes("canonical")) || null;

  const headings = { h1: [], h2: [], h3: [] };
  for (const level of ["h1", "h2", "h3"]) {
    const re = new RegExp(`<${level}[^>]*>([\\s\\S]*?)<\\/${level}>`, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      headings[level].push(stripTags(m[1]).slice(0, 200));
      if (headings[level].length >= 50) break;
    }
  }

  const images = extractImages(text);
  const anchors = extractAnchors(text);

  return {
    hasDoctype,
    hasHtml,
    hasHead,
    hasBody,
    lang,
    charset,
    titles,
    metas,
    canonicalHref: canonical ? canonical.href : null,
    headings,
    images,
    anchors,
    rawLength: text.length,
  };
}

function extractMetas(html) {
  const out = [];
  const re = /<meta\b([^>]*?)\/?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    out.push(attrs);
    if (out.length > 200) break;
  }
  return out;
}

function extractLinks(html) {
  const out = [];
  const re = /<link\b([^>]*?)\/?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    out.push({
      rel: attrs.rel || null,
      href: attrs.href || null,
      type: attrs.type || null,
    });
    if (out.length > 100) break;
  }
  return out;
}

function extractImages(html) {
  const out = [];
  const re = /<img\b([^>]*?)\/?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    const hasAlt = Object.prototype.hasOwnProperty.call(attrs, "alt");
    out.push({
      src: attrs.src || null,
      alt: hasAlt ? attrs.alt : null,
      hasAlt,
      emptyAlt: hasAlt && String(attrs.alt).trim() === "",
      width: attrs.width || null,
      height: attrs.height || null,
    });
    if (out.length > 500) break;
  }
  return out;
}

function extractAnchors(html) {
  const out = [];
  const re = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    out.push({
      href: attrs.href != null ? attrs.href : null,
      rel: attrs.rel || null,
      text: stripTags(m[2]).slice(0, 120),
    });
    if (out.length > 2000) break;
  }
  return out;
}

function parseAttrs(chunk) {
  const attrs = {};
  const re =
    /([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(chunk)) !== null) {
    const name = m[1].toLowerCase();
    const val = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
    attrs[name] = decodeEntities(val);
  }
  // boolean attrs without value (e.g. alt alone is rare)
  return attrs;
}

export function metaByName(metas, name) {
  const n = name.toLowerCase();
  for (const m of metas) {
    if ((m.name || "").toLowerCase() === n) return m.content ?? null;
  }
  return null;
}

export function metaByProperty(metas, prop) {
  const p = prop.toLowerCase();
  for (const m of metas) {
    if ((m.property || "").toLowerCase() === p) return m.content ?? null;
  }
  return null;
}
