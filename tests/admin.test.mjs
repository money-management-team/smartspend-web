import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const locales = ['en', 'ar'].map(lang => JSON.parse(readFileSync(new URL(`../src/locales/${lang}/${lang}.json`, import.meta.url))));
const keys = value => Object.entries(value).flatMap(([key, child]) => child && typeof child === 'object' ? keys(child).map(k => `${key}.${k}`) : [key]).sort();
test('administrator overview provides complete bilingual text', () => {
  for (const locale of locales) {
    assert.ok(locale.admin, 'admin translations must exist');
    assert.ok(locale.admin.preview.includes(locale === locales[0] ? 'preview' : 'معاينة'));
  }
  assert.deepEqual(keys(locales[0].admin), keys(locales[1].admin));
});
test('administrator Arabic content is translated rather than English fallback', () => {
  assert.match(locales[1].admin?.title || '', /[\u0600-\u06ff]/);
});
