#!/usr/bin/env node
/**
 * Conservative font-size codemod for Tailwind arbitrary-value classes.
 *
 * Rewrites `text-[Npx]` arbitrary sizes to the named fontSize token that has
 * the EXACT same pixel value (defined in tailwind.config.js). Because each
 * token equals the pixel size it replaces, this is a pure rename with zero
 * visual change — the value just routes through a named class.
 *
 * Only the px values explicitly mapped below are touched. Arbitrary clamp()
 * sizes, rem/em sizes, and any px value without a matching token are left
 * untouched (they need a design decision).
 *
 * Usage:  node scripts/migrate-text-size-to-scale.mjs --dry   # report counts, no writes
 *         node scripts/migrate-text-size-to-scale.mjs         # apply
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOTS = [
  join(__dirname, '..', 'src', 'app'),
  join(__dirname, '..', 'projects', 'admin', 'src', 'app'),
  join(__dirname, '..', 'projects', 'b2b', 'src', 'app'),
];

// px value -> named fontSize token.  Values verified against tailwind.config.js
// theme.extend.fontSize so each named class renders the identical pixel size.
const MAP = {
  10: '2xs',
  11: '2xs-plus',
  12: 'xs',
  13: 'xs-plus',
  14: 'sm',
  15: 'sm-plus',
  16: 'base',
  17: 'base-plus',
  18: 'lg',
  20: 'xl',
  22: '2xl',
  24: '3xl',
  28: '4xl',
  30: '4xl-plus',
  32: '5xl',
  34: '5xl-plus',
  36: '6xl',
  40: '7xl',
  44: '7xl-plus',
  48: '8xl',
  128: '9xl',
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

for (const file of ROOTS.filter((r) => { try { return statSync(r).isDirectory(); } catch { return false; } }).flatMap(walk)) {
  let src = readFileSync(file, 'utf8');
  let count = 0;
  for (const [px, token] of Object.entries(MAP)) {
    const cls = `text-${token}`;
    // match e.g.  text-[14px]  /  md:text-[14px]  /  hover:text-[14px]
    // \b before `text` keeps it from matching inside another token.
    const re = new RegExp(`\\btext-\\[${px}px\\]`, 'g');
    src = src.replace(re, () => {
      count++;
      perToken[cls] = (perToken[cls] || 0) + 1;
      return cls;
    });
  }
  if (count > 0) {
    totalReplaced += count;
    filesTouched.push([relative(join(__dirname, '..'), file), count]);
    if (!dry) writeFileSync(file, src);
  }
}

filesTouched.sort((a, b) => b[1] - a[1]);
console.log(`${dry ? '[DRY RUN] ' : ''}exact text-size→token replacements: ${totalReplaced}`);
console.log('by token:', JSON.stringify(perToken, null, 2));
console.log('top files:');
for (const [f, n] of filesTouched.slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${f}`);
