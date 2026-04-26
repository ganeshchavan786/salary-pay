/**
 * Preservation Property Tests — Bug 2: Attendance Type Not Sent
 *
 * Validates: Requirements 3.3, 3.4, 3.5
 *
 * PURPOSE: These tests MUST PASS on unfixed code.
 * They document the baseline behaviors that MUST be preserved after the fix is applied.
 *
 * Observation-first methodology:
 *   - Observed on unfixed code: records.map() outputs 7 fields (local_id, emp_id, date, time, latitude, longitude, photo)
 *   - Observed on unfixed code: retry logic constants (MAX_SYNC_RETRIES=3, RETRY_BASE_DELAY_MS=1200)
 *   - Observed on unfixed code: syncWithRetry function uses exponential backoff
 *   - Observed on unfixed code: record status update (PENDING → SYNCED) after successful sync
 *
 * Preservation invariants:
 *   P1: All 7 existing fields (local_id, emp_id, date, time, latitude, longitude, photo)
 *       SHALL remain present in records.map() output after the fix
 *   P2: Retry logic constants (MAX_SYNC_RETRIES=3, RETRY_BASE_DELAY_MS=1200) SHALL remain unchanged
 *   P3: syncWithRetry function SHALL continue to use exponential backoff
 *   P4: Record status update logic (PENDING → SYNCED) SHALL remain present
 *
 * Expected outcome: ALL tests PASS on unfixed code — confirms baseline to preserve.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYNC_SERVICE_PATH = resolve(__dirname, '../src/services/syncService.js');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ FAIL: ${name}`);
    console.log(`         Reason: ${err.message}`);
    failures.push({ test: name, reason: err.message });
    failed++;
  }
}

console.log('\n=== Bug 2 — Attendance Type: Preservation Property Tests ===');
console.log('    (These MUST PASS on unfixed code — baseline to preserve)\n');

// Read syncService.js source once for all tests
const syncServiceSource = readFileSync(SYNC_SERVICE_PATH, 'utf-8');

// ── P1: All 7 existing fields must be present in records.map() output ──────
//
// Requirement 3.3: WHEN attendance_type field is added THEN the system SHALL
// CONTINUE TO include all 7 existing fields unchanged.
//
// Observed baseline: records.map() currently outputs exactly these 7 fields:
//   { local_id, emp_id, date, time, latitude, longitude, photo }
// The fix adds attendance_type as the 8th field — all 7 must remain identical.

test('records.map() includes local_id field', () => {
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  assert.ok(mapMatch, 'Could not find records.map() in syncService.js');
  
  const mappedFields = mapMatch[1];
  assert.ok(
    mappedFields.includes('local_id'),
    `local_id field missing from records.map().\n` +
    `         Current mapped fields: ${mappedFields.replace(/\n/g, ' ')}`
  );
});

test('records.map() includes emp_id field', () => {
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  assert.ok(mapMatch, 'Could not find records.map() in syncService.js');
  
  const mappedFields = mapMatch[1];
  assert.ok(
    mappedFields.includes('emp_id'),
    `emp_id field missing from records.map().\n` +
    `         Current mapped fields: ${mappedFields.replace(/\n/g, ' ')}`
  );
});

test('records.map() includes date field', () => {
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  assert.ok(mapMatch, 'Could not find records.map() in syncService.js');
  
  const mappedFields = mapMatch[1];
  assert.ok(
    mappedFields.includes('date'),
    `date field missing from records.map().\n` +
    `         Current mapped fields: ${mappedFields.replace(/\n/g, ' ')}`
  );
});

test('records.map() includes time field', () => {
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  assert.ok(mapMatch, 'Could not find records.map() in syncService.js');
  
  const mappedFields = mapMatch[1];
  assert.ok(
    mappedFields.includes('time'),
    `time field missing from records.map().\n` +
    `         Current mapped fields: ${mappedFields.replace(/\n/g, ' ')}`
  );
});

test('records.map() includes latitude field', () => {
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  assert.ok(mapMatch, 'Could not find records.map() in syncService.js');
  
  const mappedFields = mapMatch[1];
  assert.ok(
    mappedFields.includes('latitude'),
    `latitude field missing from records.map().\n` +
    `         Current mapped fields: ${mappedFields.replace(/\n/g, ' ')}`
  );
});

test('records.map() includes longitude field', () => {
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  assert.ok(mapMatch, 'Could not find records.map() in syncService.js');
  
  const mappedFields = mapMatch[1];
  assert.ok(
    mappedFields.includes('longitude'),
    `longitude field missing from records.map().\n` +
    `         Current mapped fields: ${mappedFields.replace(/\n/g, ' ')}`
  );
});

test('records.map() includes photo field', () => {
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  assert.ok(mapMatch, 'Could not find records.map() in syncService.js');
  
  const mappedFields = mapMatch[1];
  assert.ok(
    mappedFields.includes('photo'),
    `photo field missing from records.map().\n` +
    `         Current mapped fields: ${mappedFields.replace(/\n/g, ' ')}`
  );
});

// ── P2: Retry logic constants must remain unchanged ─────────────────────────
//
// Requirement 3.4: WHEN sync successful THEN the system SHALL CONTINUE TO
// update record status PENDING → SYNCED and retry logic SHALL work unchanged.
//
// Observed baseline: MAX_SYNC_RETRIES=3, RETRY_BASE_DELAY_MS=1200
// These constants control the retry behavior and must not be modified by the fix.

test('MAX_SYNC_RETRIES constant is 3', () => {
  const match = syncServiceSource.match(/const MAX_SYNC_RETRIES\s*=\s*(\d+)/);
  assert.ok(match, 'MAX_SYNC_RETRIES constant not found in syncService.js');
  
  const value = parseInt(match[1], 10);
  assert.strictEqual(
    value,
    3,
    `MAX_SYNC_RETRIES value mismatch. Expected 3, got ${value}`
  );
});

test('RETRY_BASE_DELAY_MS constant is 1200', () => {
  const match = syncServiceSource.match(/const RETRY_BASE_DELAY_MS\s*=\s*(\d+)/);
  assert.ok(match, 'RETRY_BASE_DELAY_MS constant not found in syncService.js');
  
  const value = parseInt(match[1], 10);
  assert.strictEqual(
    value,
    1200,
    `RETRY_BASE_DELAY_MS value mismatch. Expected 1200, got ${value}`
  );
});

// ── P3: syncWithRetry function must use exponential backoff ─────────────────
//
// Requirement 3.4: Retry logic must continue working unchanged.
//
// Observed baseline: syncWithRetry uses exponential backoff formula:
//   delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
// This formula must remain present in the function.

test('syncWithRetry function exists', () => {
  const match = syncServiceSource.match(/async function syncWithRetry\(/);
  assert.ok(
    match,
    'syncWithRetry function not found in syncService.js'
  );
});

test('syncWithRetry uses exponential backoff (Math.pow(2, attempt - 1))', () => {
  // Check for the exponential backoff formula
  const hasExponentialBackoff = syncServiceSource.includes('Math.pow(2, attempt - 1)');
  assert.ok(
    hasExponentialBackoff,
    'Exponential backoff formula "Math.pow(2, attempt - 1)" not found in syncWithRetry.\n' +
    '         Expected: delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)'
  );
});

test('syncWithRetry uses MAX_SYNC_RETRIES in while loop condition', () => {
  // Check that the retry loop uses MAX_SYNC_RETRIES
  const hasRetryLoop = syncServiceSource.match(/while\s*\(\s*attempt\s*<\s*MAX_SYNC_RETRIES\s*\)/);
  assert.ok(
    hasRetryLoop,
    'Retry loop "while (attempt < MAX_SYNC_RETRIES)" not found in syncWithRetry'
  );
});

test('syncWithRetry calls sleep() with calculated delay', () => {
  // Check that sleep is called with the delay
  const hasSleep = syncServiceSource.includes('await sleep(delay)');
  assert.ok(
    hasSleep,
    'sleep(delay) call not found in syncWithRetry retry logic'
  );
});

// ── P4: Record status update logic (PENDING → SYNCED) must be present ──────
//
// Requirement 3.4: WHEN sync successful THEN the system SHALL CONTINUE TO
// update record status PENDING → SYNCED.
//
// Observed baseline: syncPendingAttendance() calls attendanceDB.updateStatus()
// for each successfully synced record.

test('syncPendingAttendance calls attendanceDB.updateStatus for synced records', () => {
  // Check for the status update call
  const hasStatusUpdate = syncServiceSource.includes("await attendanceDB.updateStatus(result.local_id, 'SYNCED')");
  assert.ok(
    hasStatusUpdate,
    'attendanceDB.updateStatus(result.local_id, "SYNCED") call not found in syncPendingAttendance.\n' +
    '         Expected: Status update for successfully synced records'
  );
});

test('syncPendingAttendance handles duplicate status (also updates to SYNCED)', () => {
  // Check that duplicate records are also marked as SYNCED
  const hasDuplicateHandling = syncServiceSource.match(/else if \(result\.status === 'duplicate'\)\s*{[^}]*await attendanceDB\.updateStatus\(result\.local_id, 'SYNCED'\)/s);
  assert.ok(
    hasDuplicateHandling,
    'Duplicate record handling (status update to SYNCED) not found in syncPendingAttendance'
  );
});

test('syncPendingAttendance processes results array from backend response', () => {
  // Check that the function processes the results array
  const hasResultsProcessing = syncServiceSource.includes('for (const result of results)');
  assert.ok(
    hasResultsProcessing,
    'Results array processing loop "for (const result of results)" not found in syncPendingAttendance'
  );
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n─── Results ───────────────────────────────────────────');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failures.length > 0) {
  console.log('\n─── Failures ───────────────────────────────────────────');
  failures.forEach((f, i) => {
    console.log(`\n  [${i + 1}] Test: "${f.test}"`);
    console.log(`      Reason: ${f.reason}`);
  });
}

console.log('\n─── Interpretation ─────────────────────────────────────');
if (failed === 0) {
  console.log('  ✓ ALL PRESERVATION TESTS PASS on unfixed code.');
  console.log('  ✓ Baseline behaviors confirmed:');
  console.log('      - All 7 existing fields (local_id, emp_id, date, time, latitude, longitude, photo) present in records.map()');
  console.log('      - Retry logic constants: MAX_SYNC_RETRIES=3, RETRY_BASE_DELAY_MS=1200');
  console.log('      - syncWithRetry uses exponential backoff: delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)');
  console.log('      - Record status update (PENDING → SYNCED) logic present for synced and duplicate records');
  console.log('  ✓ Re-run these tests after the fix (task 6.3) to confirm no regressions.');
  process.exit(0);
} else {
  console.log('  ✗ UNEXPECTED: Some preservation tests FAILED on unfixed code.');
  console.log('  ✗ This means the baseline is not what was expected — investigate before applying the fix.');
  process.exit(1);
}
