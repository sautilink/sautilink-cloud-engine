/**
 * Lightweight HTML extraction for mobile signals (no JS execution).
 */

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttrs(chunk) {
  const attrs = {};
  const re = /([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(chunk)) !== null) {
    const name = m[1].toLowerCase();
    const val = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
    attrs[name] = decodeEntities(val);
  }
  return attrs;
}

/**
 * @param {string} html
 */
export function parseMobileHtml(html) {
  const text = typeof html === "string" ? html : "";

  const hasDoctype = /<!doctype\s+html/i.test(text);
  const hasHtml = /<html[\s>]/i.test(text);
  const hasHead = /<head[\s>]/i.test(text);
  const hasBody = /<body[\s>]/i.test(text);

  let lang = null;
  const langM = text.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i);
  if (langM) lang = langM[1].trim();

  const metas = [];
  const metaRe = /<meta\b([^>]*?)\/?>/gi;
  let mm;
  while ((mm = metaRe.exec(text)) !== null) {
    metas.push(parseAttrs(mm[1]));
    if (metas.length > 200) break;
  }

  const linkTags = [];
  const linkRe = /<link\b([^>]*?)\/?>/gi;
  let lm;
  while ((lm = linkRe.exec(text)) !== null) {
    linkTags.push(parseAttrs(lm[1]));
    if (linkTags.length > 100) break;
  }

  const images = [];
  const imgRe = /<img\b([^>]*?)\/?>/gi;
  let im;
  while ((im = imgRe.exec(text)) !== null) {
    const a = parseAttrs(im[1]);
    images.push({
      src: a.src || null,
      srcset: a.srcset || null,
      sizes: a.sizes || null,
      width: a.width || null,
      height: a.height || null,
      loading: a.loading || null,
      hasAlt: Object.prototype.hasOwnProperty.call(a, "alt"),
      alt: Object.prototype.hasOwnProperty.call(a, "alt") ? a.alt : null,
    });
    if (images.length > 500) break;
  }

  const anchors = [];
  const aRe = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let am;
  while ((am = aRe.exec(text)) !== null) {
    const a = parseAttrs(am[1]);
    anchors.push({
      href: a.href != null ? a.href : null,
      text: stripTags(am[2]).slice(0, 80),
    });
    if (anchors.length > 2000) break;
  }

  const iframes = [];
  const ifRe = /<iframe\b([^>]*?)(?:\/>|>[\s\S]*?<\/iframe>)/gi;
  let fm;
  while ((fm = ifRe.exec(text)) !== null) {
    const a = parseAttrs(fm[1]);
    iframes.push({ src: a.src || null, width: a.width || null, height: a.height || null });
    if (iframes.length > 50) break;
  }

  const tables = (text.match(/<table\b/gi) || []).length;
  const fonts = extractFontSizes(text);
  const fixedWidth = detectFixedWidthSignals(text);

  return {
    hasDoctype,
    hasHtml,
    hasHead,
    hasBody,
    lang,
    metas,
    linkTags,
    images,
    anchors,
    iframes,
    tables,
    fonts,
    fixedWidth,
    rawLength: text.length,
  };
}

function extractFontSizes(html) {
  const sizes = [];
  const re = /font-size\s*:\s*([\d.]+)\s*(px|pt|em|rem)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    sizes.push({ value: Number(m[1]), unit: m[2].toLowerCase() });
    if (sizes.length > 100) break;
  }
  return sizes;
}

function detectFixedWidthSignals(html) {
  const signals = [];
  if (/width\s*=\s*["']?(\d{3,})["']?/i.test(html)) {
    const m = html.match(/width\s*=\s*["']?(\d{3,})["']?/i);
    if (m && Number(m[1]) >= 980) signals.push(`width attribute ${m[1]}`);
  }
  if (/width\s*:\s*(\d{3,})\s*px/i.test(html)) {
    const m = html.match(/width\s*:\s*(\d{3,})\s*px/i);
    if (m && Number(m[1]) >= 980) signals.push(`CSS width ${m[1]}px`);
  }
  if (/min-width\s*:\s*(\d{3,})\s*px/i.test(html)) {
    const m = html.match(/min-width\s*:\s*(\d{3,})\s*px/i);
    if (m && Number(m[1]) >= 980) signals.push(`min-width ${m[1]}px`);
  }
  // table layout width
  if (/<table[^>]*width\s*=\s*["']?(\d{3,})/i.test(html)) {
    signals.push("wide table width attribute");
  }
  return signals;
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
