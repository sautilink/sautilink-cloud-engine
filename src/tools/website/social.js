import { metaByProperty, metaByName } from "./parser.js";

export function analyzeSocial(metas) {
  const og = {
    title: metaByProperty(metas, "og:title"),
    description: metaByProperty(metas, "og:description"),
    image: metaByProperty(metas, "og:image"),
    url: metaByProperty(metas, "og:url"),
    type: metaByProperty(metas, "og:type"),
    site_name: metaByProperty(metas, "og:site_name"),
  };
  const twitter = {
    card: metaByName(metas, "twitter:card") || metaByProperty(metas, "twitter:card"),
    title: metaByName(metas, "twitter:title") || metaByProperty(metas, "twitter:title"),
    description:
      metaByName(metas, "twitter:description") ||
      metaByProperty(metas, "twitter:description"),
    image: metaByName(metas, "twitter:image") || metaByProperty(metas, "twitter:image"),
  };

  const ogPresent = Object.values(og).some((v) => v != null && v !== "");
  const twPresent = Object.values(twitter).some((v) => v != null && v !== "");

  return {
    openGraph: { present: ogPresent, ...og },
    twitter: { present: twPresent, ...twitter },
  };
}
