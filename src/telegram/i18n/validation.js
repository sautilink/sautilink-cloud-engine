const SW = new Map([
  ["Please provide a URL.", "Tafadhali tuma URL."],
  ["Only http and https URLs are supported.", "URL za http na https pekee ndizo zinakubalika."],
  ["Please provide a valid URL.", "Tafadhali tuma URL halali."],
  ["Please provide a domain (e.g. example.com).", "Tafadhali tuma domain (mfano example.com)."],
  ["Please provide a domain, not a URL (e.g. example.com).", "Tafadhali tuma domain pekee, si URL (mfano example.com)."],
]);

export function localizeValidationMessage(message, locale = "en") {
  const text = String(message || "");
  if (locale !== "sw") return text;
  return SW.get(text) || text;
}
