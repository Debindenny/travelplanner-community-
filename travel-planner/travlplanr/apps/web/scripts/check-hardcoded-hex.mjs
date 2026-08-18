#!/usr/bin/env node
/**
 * Token guard — prevents the hardcoded-hex problem from growing.
 *
 * The design system defines colors as tokens in tailwind.config.js / styles.scss,
 * but components bypass them with raw hex literals (e.g. `bg-[#141414]`, `text-[#888888]`).
 * This script counts raw hex occurrences in src/app and fails if the count RISES above the
 * committed baseline — so new code can't add more, while the existing debt is burned down
 * over time (lower the baseline in .hex-baseline.json as you migrate files to tokens).
 *
 * Usage:  node scripts/check-hardcoded-hex.mjs            # check against baseline
 *         node scripts/check-hardcoded-hex.mjs --update   # rewrite baseline to current count
 *         node scripts/check-hardcoded-hex.mjs --list     # show top offending files
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src', 'app');
const BASELINE = join(__dirname, '.hex-baseline.json');
// raw hex color literal; the token homes (tailwind.config.js, styles.scss :root) are excluded by scope
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|html|scss)$/.test(name)) out.push(p);
  }
  return out;
}

const perFile = [];
let total = 0;
for (const file of walk(SRC)) {
  const matches = readFileSync(file, 'utf8').match(HEX);
  if (matches?.length) {
    perFile.push([relative(SRC, file), matches.length]);
    total += matches.length;
  }
}
perFile.sort((a, b) => b[1] - a[1]);

const arg = process.argv[2];
if (arg === '--list') {
  console.log(`Top files by hardcoded hex (total ${total}):`);
  for (const [f, n] of perFile.slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${f}`);
  process.exit(0);
}
if (arg === '--update') {
  writeFileSync(BASELINE, JSON.stringify({ maxHex: total }, null, 2) + '\n');
  console.log(`Baseline updated to ${total}.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).maxHex : 0;
if (total > baseline) {
  console.error(
    `\n✗ Hardcoded hex count rose to ${total} (baseline ${baseline}).\n` +
      `  Use design tokens (bg-*/text-*/border-*) instead of raw #hex.\n` +
      `  Run "npm run lint:hex -- --list" to see the worst files.\n`,
  );
  process.exit(1);
}
console.log(`✓ Hardcoded hex ${total} ≤ baseline ${baseline}. (Lower the baseline as you migrate.)`);
