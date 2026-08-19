#!/usr/bin/env node
/**
 * Scan Angular templates/TS for translate keys and add any missing entries
 * to en.json, es.json, and fr.json with humanized placeholder text.
 *
 * Usage: node scripts/sync-i18n-keys.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const i18nDir = path.join(webRoot, 'src/assets/i18n');
const srcDir = path.join(webRoot, 'src');

const KEY_PATTERN = /^[A-Z][A-Z0-9_.]+$/;

const patterns = [
  /'([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+)'\s*\|\s*translate/g,
  /"([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+)"\s*\|\s*translate/g,
  /translate\.instant\('([^']+)'\)/g,
  /labelKey:\s*'([^']+)'/g,
  /titleKey:\s*'([^']+)'/g,
  /descriptionKey:\s*'([^']+)'/g,
  /companionText:\s*'([^']+)'/g,
  /return\s+'([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)+)'/g,
];

function walk(dir, ext, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      walk(full, ext, files);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function unflatten(flat) {
  const root = {};
  for (const [key, val] of Object.entries(flat).sort(([a], [b]) => a.localeCompare(b))) {
    const parts = key.split('.');
    let cur = root;
    for (const p of parts.slice(0, -1)) {
      cur = cur[p] ??= {};
    }
    cur[parts.at(-1)] = val;
  }
  return root;
}

function deepMerge(base, extra) {
  for (const [k, v] of Object.entries(extra)) {
    if (base[k] && typeof base[k] === 'object' && typeof v === 'object') {
      deepMerge(base[k], v);
    } else {
      base[k] = v;
    }
  }
}

function humanizeKey(key) {
  const leaf = key.split('.').at(-1);
  const text = leaf.replace(/_/g, ' ').toLowerCase();
  const small = new Set(['a', 'an', 'the', 'to', 'in', 'on', 'at', 'of', 'for', 'and', 'or', 'vs', 'per']);
  const words = text.split(' ').map((w, i) => {
    if (w === 'n') return '{{n}}';
    if (w === 'pct') return '%';
    if (i > 0 && small.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
  let s = words.join(' ');
  if (leaf.includes('LOADING') && !s.includes('...')) s += '...';
  if (leaf.includes('PLACEHOLDER') && !s.endsWith('...')) s += '...';
  if (leaf.includes('ERROR') && leaf.includes('TITLE')) return 'Something went wrong';
  if (leaf.includes('RETRY') || leaf === 'TRY_AGAIN') return 'Try again';
  if (leaf.includes('CANCEL')) return 'Cancel';
  if (leaf.startsWith('BACK_TO_')) {
    return `Back to ${leaf.replace('BACK_TO_', '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;
  }
  return s;
}

function collectUsedKeys() {
  const used = new Set();
  const files = [...walk(srcDir, '.ts'), ...walk(srcDir, '.html')];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (KEY_PATTERN.test(match[1])) used.add(match[1]);
      }
    }
  }
  return used;
}

const used = collectUsedKeys();
let totalAdded = 0;

for (const lang of ['en', 'es', 'fr']) {
  const filePath = path.join(i18nDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const flat = flatten(data);
  const missing = [...used].filter((k) => !(k in flat));
  if (missing.length) {
    const additions = Object.fromEntries(missing.map((k) => [k, humanizeKey(k)]));
    deepMerge(data, unflatten(additions));
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    totalAdded += missing.length;
    console.log(`${lang}: added ${missing.length} keys`);
  } else {
    console.log(`${lang}: up to date`);
  }
}

const enFlat = flatten(JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8')));
const stillMissing = [...used].filter((k) => !(k in enFlat));
console.log(`Scanned ${used.size} keys; still missing: ${stillMissing.length}`);
if (stillMissing.length) {
  process.exitCode = 1;
}
