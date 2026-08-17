from pathlib import Path

brand_dir = Path('public/assets/brand')
source_css = brand_dir / 'typography.css'
versioned_css = brand_dir / 'typography-manrope.css'
versioned_css.write_text(source_css.read_text(encoding='utf-8'), encoding='utf-8')

for path in Path('public').rglob('*.html'):
    text = path.read_text(encoding='utf-8')
    text = text.replace('/assets/brand/typography.css', '/assets/brand/typography-manrope.css?v=1')
    text = text.replace('/assets/fonts/manrope/Manrope-Variable.woff2"', '/assets/fonts/manrope/Manrope-Variable.woff2?v=1"')
    path.write_text(text, encoding='utf-8')

brand_test = Path('tests/brand-typography.test.js')
text = brand_test.read_text(encoding='utf-8')
text = text.replace('public/assets/brand/typography.css', 'public/assets/brand/typography-manrope.css')
text = text.replace(
    'assert.match(html, /href="\\/assets\\/brand\\/typography\\.css"/i, path);',
    'assert.match(html, /href="\\/assets\\/brand\\/typography-manrope\\.css\\?v=1"/i, path);'
)
text = text.replace(
    'assert.match(html, /href="\\/assets\\/fonts\\/manrope\\/Manrope-Variable\\.woff2"[^>]*as="font"/i, path);',
    'assert.match(html, /href="\\/assets\\/fonts\\/manrope\\/Manrope-Variable\\.woff2\\?v=1"[^>]*as="font"/i, path);'
)
brand_test.write_text(text, encoding='utf-8')

web_test = Path('tests/web-experience.test.js')
if web_test.exists():
    text = web_test.read_text(encoding='utf-8')
    text = text.replace('public/assets/brand/typography.css', 'public/assets/brand/typography-manrope.css')
    text = text.replace('/assets/brand/typography.css', '/assets/brand/typography-manrope.css?v=1')
    web_test.write_text(text, encoding='utf-8')

headers = Path('public/_headers')
text = headers.read_text(encoding='utf-8').rstrip() + '''\n\n/assets/brand/typography-manrope.css\n  Cache-Control: public, max-age=0, must-revalidate\n\n/assets/fonts/manrope/*\n  Cache-Control: public, max-age=31536000, immutable\n'''
headers.write_text(text, encoding='utf-8')
