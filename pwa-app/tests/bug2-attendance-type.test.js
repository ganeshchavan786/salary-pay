/**
 * Bug Condition Exploration Test — Bug 2: Attendance Type Not Sent
 *
 * Validates: Requirements 1.3, 1.4
 *
 * PURPOSE: This test MUST FAIL on unfixed code.
 * Failure confirms the bug exists — do NOT fix the code to make this pass.
 *
 * Bug Condition (isBugCondition_AttendanceType):
 *   NOT HAS_FIELD(sync_payload_record, "attendance_type")
 *
 * Expected counterexamples:
 *   1. IndexedDB record has attendance_type: "CHECK_OUT"
 *   2. Captured sync payload omits attendance_type field
 *   3. Backend would receive CHECK_IN default for a CHECK_OUT record
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYNC_SERVICE_PATH = resolve(__dirname, '../src/services/syncService.js');

console.log('\n=== Bug 2 — Attendance Type: Bug Condition Exploration Test ===\n');

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

// ── Test: attendance_type field must be present in sync payload ──
test('syncPendingAttendance() includes attendance_type in sync payload', () => {
  // Read the syncService.js source code
  const syncServiceSource = readFileSync(SYNC_SERVICE_PATH, 'utf-8');
  
  // Extract the records.map() logic
  // Pattern: const records = pendingRecords.map(record => ({ ... }))
  const mapMatch = syncServiceSource.match(/const records = pendingRecords\.map\(record => \({([^}]+)\}\)\)/s);
  
  if (!mapMatch) {
    throw new Error('Could not find records.map() in syncService.js');
  }
  
  const mappedFields = mapMatch[1];
  
  // Check if attendance_type is in the mapped fields
  const hasAttendanceType = mappedFields.includes('attendance_type');
  
  if (!hasAttendanceType) {
    // Simulate what the mapping would produce
    const mockSourceRecord = {
      id: 'local-001',
      emp_id: 'E001',
      date: '2024-01-15',
      time: '17:00:00',
      latitude: 0,
      longitude: 0,
      photo: null,
      attendance_type: 'CHECK_OUT',
      sync_status: 'PENDING'
    };
    
    // Show what fields ARE mapped
    const mappedFieldsList = mappedFields
      .split(',')
      .map(f => f.trim().split(':')[0])
      .filter(f => f);
    
    // Simulate the mapped output (what would be sent to backend)
    const simulatedPayload = {
      local_id: mockSourceRecord.id,
      emp_id: mockSourceRecord.emp_id,
      date: mockSourceRecord.date,
      time: mockSourceRecord.time,
      latitude: mockSourceRecord.latitude,
      longitude: mockSourceRecord.longitude,
      photo: mockSourceRecord.photo
      // attendance_type is MISSING
    };
    
    throw new Error(
      `attendance_type field is MISSING from records.map() output.\n` +
      `         \n` +
      `         Source IndexedDB record:\n` +
      `           { id: "local-001", emp_id: "E001", date: "2024-01-15", time: "17:00:00",\n` +
      `             latitude: 0, longitude: 0, photo: null, attendance_type: "CHECK_OUT" }\n` +
      `         \n` +
      `         Mapped fields in syncService.js: [${mappedFieldsList.join(', ')}]\n` +
      `         \n` +
      `         Simulated sync payload sent to backend:\n` +
      `           ${JSON.stringify(simulatedPayload, null, 2).replace(/\n/g, '\n         ')}\n` +
      `         \n` +
      `         Result: Backend receives no attendance_type → defaults to CHECK_IN\n` +
      `         Bug confirmed: CHECK_OUT records are incorrectly saved as CHECK_IN`
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
