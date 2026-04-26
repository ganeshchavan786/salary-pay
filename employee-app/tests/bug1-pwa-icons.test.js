/**
 * Bug Condition Exploration Test — Bug 1: PWA Icons Missing
 *
 * Validates: Requirements 1.1, 1.2
 *
 * PURPOSE: This test MUST FAIL on unfixed code.
 * Failure confirms the bug exists — do NOT fix the code to make this pass.
 *
 * Bug Condition (isBugCondition_Icons):
 *   NOT EXISTS(public_dir, "icon-512.png")
 *   OR NOT manifest_has_png_icon(manifest, "192x192")
 *   OR NOT manifest_has_png_icon(manifest, "512x512")
 *
 * Expected counterexamples:
 *   1. manifest.webmanifest icons array contains only SVG — no image/png entries
 *   2. icon-512.png does not exist in public/
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../public');
const MANIFEST_PATH = resolve(PUBLIC_DIR, 'manifest.webmanifest');

let passed = 0;
let failed = 0;
const counterexamples = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ FAIL: ${name}`);
    console.log(`         Counterexample: ${err.message}`);
    counterexamples.push({ test: name, counterexample: err.message });
    failed++;
  }
}

console.log('\n=== Bug 1 — PWA Icons: Bug Condition Exploration Test ===\n');

// ── Test 1: manifest.webmanifest must contain at least one PNG icon at 192×192 ──
test('manifest.webmanifest has an icon entry with type="image/png" and sizes="192x192"', () => {
  const raw = readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(raw);
  const icons = manifest.icons || [];

  const has192png = icons.some(
    icon => icon.type === 'image/png' && icon.sizes === '192x192'
  );

  if (!has192png) {
    const iconsSummary = JSON.stringify(icons, null, 2);
    throw new Error(
      `No image/png icon with sizes="192x192" found.\n` +
      `         Current icons array:\n${iconsSummary}`
    );
  }
});

// ── Test 2: manifest.webmanifest must contain at least one PNG icon at 512×512 ──
test('manifest.webmanifest has an icon entry with type="image/png" and sizes="512x512"', () => {
  const raw = readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(raw);
  const icons = manifest.icons || [];

  const has512png = icons.some(
    icon => icon.type === 'image/png' && icon.sizes === '512x512'
  );

  if (!has512png) {
    const iconsSummary = JSON.stringify(icons, null, 2);
    throw new Error(
      `No image/png icon with sizes="512x512" found.\n` +
      `         Current icons array:\n${iconsSummary}`
    );
  }
});

// ── Test 3: icon-512.png must exist on disk in public/ ──
test('public/icon-512.png exists on disk', () => {
  const iconPath = resolve(PUBLIC_DIR, 'icon-512.png');
  if (!existsSync(iconPath)) {
    throw new Error(
      `File not found: ${iconPath}\n` +
      `         Files present in public/: ${
        ['icon.svg', 'icon-192.png', 'manifest.webmanifest', 'robots.txt'].join(', ')
      }`
    );
  }
});

// ── Summary ──
console.log('\n─── Results ───────────────────────────────────────────');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (counterexamples.length > 0) {
  console.log('\n─── Counterexamples Found (Bug Confirmed) ──────────────');
  counterexamples.forEach((ce, i) => {
    console.log(`\n  [${i + 1}] Test: "${ce.test}"`);
    console.log(`      Counterexample: ${ce.counterexample}`);
  });
}

console.log('\n─── Interpretation ─────────────────────────────────────');
if (failed > 0) {
  console.log('  ✓ BUG CONFIRMED: Test failures above are EXPECTED on unfixed code.');
  console.log('  ✓ Counterexamples document the exact bug condition.');
  console.log('  ✗ DO NOT fix the code yet — this is the exploration phase.');
  // Exit with non-zero to signal test failure to CI / task runner
  process.exit(1);
} else {
  console.log('  ✗ UNEXPECTED: All tests passed — bug may already be fixed or test is wrong.');
  process.exit(0);
}
