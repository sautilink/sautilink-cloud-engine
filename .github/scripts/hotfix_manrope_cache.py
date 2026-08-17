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

for filename in ['tests/brand-typography.test.js', 'tests/web-experience.test.js']:
    path = Path(filename)
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    text = text.replace('public/assets/brand/typography.css', 'public/assets/brand/typography-manrope.css')
    text = text.replace('/assets/brand/typography\\.css', '/assets/brand/typography-manrope\\.css\\?v=1')
    text = text.replace('/assets/brand/typography.css', '/assets/brand/typography-manrope.css?v=1')
    path.write_text(text, encoding='utf-8')

headers = Path('public/_headers')
text = headers.read_text(encoding='utf-8').rstrip() + '''\n\n/assets/brand/typography-manrope.css\n  Cache-Control: public, max-age=0, must-revalidate\n\n/assets/fonts/manrope/*\n  Cache-Control: public, max-age=31536000, immutable\n'''
headers.write_text(text, encoding='utf-8')
