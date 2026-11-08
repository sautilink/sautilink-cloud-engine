import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const publicRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const origin = 'https://cloudengine.sautilink.com';
const pages = ['privacy', 'terms', 'account-deletion', 'faq'];
const tag = (head, key) => {
  const matches = [...head.matchAll(/<meta\s+[^>]+>/gi)]
    .map(match => match[0])
    .filter(value => value.includes(`name="${key}"`) || value.includes(`property="${key}"`));
  assert.equal(matches.length, 1, `Expected exactly one ${key}`);
  const value = matches[0].match(/content="([^"]*)"/);
  assert.ok(value && value[1], `Missing ${key} content`);
  return value[1];
};

test('public Cloud Engine legal and FAQ pages have complete SEO metadata', () => {
  for (const slug of pages) {
    const html = readFileSync(resolve(publicRoot, `${slug}.html`), 'utf8');
    const head = html.split('</head>')[0];
    const canonical = `${origin}/${slug}`;
    assert.equal([...head.matchAll(/<title>/g)].length, 1, slug);
    assert.equal([...head.matchAll(/rel="canonical"/g)].length, 1, slug);
    assert.ok(head.includes(`rel="canonical" href="${canonical}"`), slug);
    assert.ok(tag(head, 'description'));
    assert.match(tag(head, 'robots'), /^index,\s*follow/);
    assert.equal(tag(head, 'og:url'), canonical);
    assert.equal(tag(head, 'og:site_name'), 'SautiLink Cloud Engine');
    assert.equal(tag(head, 'og:locale'), 'en_US');
    assert.equal(tag(head, 'og:image'), tag(head, 'og:image:secure_url'));
    assert.ok(tag(head, 'og:image:alt'));
    assert.equal(tag(head, 'og:image:type'), 'image/png');
    assert.equal(tag(head, 'twitter:card'), 'summary_large_image');
    assert.ok(tag(head, 'twitter:title'));
    assert.ok(tag(head, 'twitter:description'));
    assert.equal(tag(head, 'twitter:image'), tag(head, 'og:image'));
    assert.ok(tag(head, 'twitter:image:alt'));
    assert.equal(tag(head, 'twitter:site'), '@sautilink');
    const image = new URL(tag(head, 'og:image'));
    if (image.hostname === 'cloudengine.sautilink.com') {
      assert.ok(existsSync(resolve(publicRoot, image.pathname.slice(1))), slug);
    }
    const block = head.match(/<script type="application\/ld\+json" data-seo="SEO_METADATA_20261108">([\s\S]*?)<\/script>/);
    assert.ok(block, slug);
    const graph = JSON.parse(block[1])['@graph'];
    const page = graph.find(value => value['@type'] === 'WebPage');
    const breadcrumbs = graph.find(value => value['@type'] === 'BreadcrumbList');
    assert.equal(page.url, canonical);
    assert.equal(page.breadcrumb['@id'], breadcrumbs['@id']);
    assert.equal(breadcrumbs.itemListElement[0].item, `${origin}/`);
    assert.equal(breadcrumbs.itemListElement[1].item, canonical);
    assert.match(html, /<body\b/);
  }
});
