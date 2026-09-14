import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const tags = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/g)];
const scripts = tags.map(match => ({ attrs: `${match[1]} ${match[3]}`, src: match[2].split('?')[0] }));

test('production loads exactly one JavaScript entry module', () => {
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'js/production.js');
  assert.match(scripts[0].attrs, /\btype=["']module["']/);
});

test('legacy config, patch scripts and transitional migration bridges are inactive in production HTML', () => {
  const sources = scripts.map(script => script.src);
  assert.equal(sources.includes('config.js'), false);
  assert.equal(sources.some(src => /(^|\/)v\d/.test(src)), false);
  assert.equal(sources.some(src => src.startsWith('js/migration/')), false);
});

test('historical CSS remains untouched by the JavaScript runtime cutover', () => {
  assert.match(html, /<link rel="stylesheet" href="style\.css\?v=32">/);
  assert.match(html, /<link rel="stylesheet" href="v32\.css\?v=43">/);
});
