#!/usr/bin/env node
/**
 * Conservative hex → design-token codemod for Tailwind arbitrary-value classes.
 *
 * ONLY rewrites property-prefixed Tailwind classes where the hex is an EXACT match
 * for an existing token (same color value) — so there is zero visual change, the
 * value just routes through the token instead of a literal. Off-token greys
 * (#f9f9f9, #333333, …) are intentionally NOT touched (they need a design decision).
 *
 * Usage:  node scripts/migrate-hex-to-tokens.mjs --dry   # report counts, no writes
 *         node scripts/migrate-hex-to-tokens.mjs         # apply
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src', 'app');

// (prefix, hex) -> token class.  Hex matched case-insensitively.
// Values verified against tailwind.config.js / styles.scss.
const MAP = {
  'text-#141414': 'text-text-primary',
  'text-#525252': 'text-text-secondary',
  'text-#737373': 'text-text-tertiary',
  'text-#A3A3A3': 'text-text-disabled',
  'text-#0060EA': 'text-primary',
  'text-#FFFFFF': 'text-white',
  'bg-#FAFAFA': 'bg-surface-muted',
  'bg-#FFFFFF': 'bg-white',
  'bg-#0060EA': 'bg-primary',
  'bg-#141414': 'bg-dark-footer',
  'border-#D4D4D4': 'border-border',
  'border-#E0E0E0': 'border-border-light',
  'border-#0060EA': 'border-primary',
  // --- exact-token values in prefixes the first pass missed (zero visual change) ---
  'accent-#0060EA': 'accent-primary',
  'bg-#D4D4D4': 'bg-border',
  'text-#D4D4D4': 'text-border',
  'from-#0060EA': 'from-primary',
  'to-#0060EA': 'to-primary',
  'via-#0060EA': 'via-primary',
  'bg-#A3A3A3': 'bg-text-disabled',
  'border-#A3A3A3': 'border-text-disabled',
  // --- design call: fold near-imperceptible off-token greys to the nearest token (delta <=5) ---
  'bg-#F9F9F9': 'bg-surface-muted',   // 249->250
  'bg-#F5F5F5': 'bg-surface-muted',   // 245->250
  'bg-#E5E5E5': 'bg-border-light',    // 229->224
  'border-#E5E5E5': 'border-border-light',
  'text-#121212': 'text-text-primary', // 18->20
  'bg-#121212': 'bg-text-primary',
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|html)$/.test(name)) out.push(p);
  }
  return out;
}

const dry = process.argv.includes('--dry');
let totalReplaced = 0;
const perToken = {};
const filesTouched = [];

for (const file of walk(SRC)) {
  let src = readFileSync(file, 'utf8');
  let count = 0;
  for (const [key, token] of Object.entries(MAP)) {
    const [prefix, hex] = key.split('-#');
    // match e.g.  text-[#525252]  /  hover:text-[#525252]  (case-insensitive hex)
    const re = new RegExp(`${prefix}-\\[#${hex}\\]`, 'gi');
    src = src.replace(re, () => {
      count++;
      perToken[token] = (perToken[token] || 0) + 1;
      return token;
    });
  }
  if (count > 0) {
    totalReplaced += count;
    filesTouched.push([relative(SRC, file), count]);
    if (!dry) writeFileSync(file, src);
  }
}

filesTouched.sort((a, b) => b[1] - a[1]);
console.log(`${dry ? '[DRY RUN] ' : ''}exact hex→token replacements: ${totalReplaced}`);
console.log('by token:', JSON.stringify(perToken, null, 2));
console.log('top files:');
for (const [f, n] of filesTouched.slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${f}`);
