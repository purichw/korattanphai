import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { theme } from '../src/theme.ts';

const root = new URL('../../../', import.meta.url);
const webRequire = createRequire(new URL('package.json', root));
const postcss = webRequire('postcss');
const css = postcss.parse(readFileSync(new URL('src/styles.css', root), 'utf8'));
const tokens = new Map();
css.nodes.find((node) => node.type === 'rule' && node.selector === ':root')
  .walkDecls((decl) => tokens.set(decl.prop, decl.value));

test('native colors and radius match the web CI source of truth', () => {
  for (const [key, value] of Object.entries(theme.colors)) {
    const property = `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    assert.equal(value, tokens.get(property), property);
  }
  assert.equal(`${theme.radius}px`, tokens.get('--radius'));
});

test('native typography uses the web primary family and loaded weights', () => {
  assert.equal(tokens.get('font-family').split(',')[0].trim(), `"${theme.fontFamily}"`);
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert.ok(html.includes('family=Google+Sans:wght@400;500;600;700'));
  assert.deepEqual(theme.fonts, {
    regular: 'GoogleSans_400Regular',
    semibold: 'GoogleSans_600SemiBold',
    bold: 'GoogleSans_700Bold',
  });
});

test('native emblem is the unmodified Korat web artwork', () => {
  const digest = (path) => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
  assert.equal(
    digest('apps/mobile/assets/korat-tan-phai-emblem.png'),
    digest('public/brand/korat-tan-phai-emblem.png'),
  );
});
