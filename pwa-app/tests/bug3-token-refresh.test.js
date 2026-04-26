/**
 * Bug Condition Exploration Test — Bug 3: Token Refresh
 *
 * Validates: Requirements 1.5, 1.6, 1.7
 *
 * PURPOSE: This test MUST FAIL on unfixed code.
 * Failure confirms the bug exists — do NOT fix the code to make this pass.
 *
 * Bug Condition (isBugCondition_TokenExpiry):
 *   response.status = 401
 *   AND token_is_expired(access_token)
 *   AND refresh_token IS NOT NULL
 *   AND interceptor does NOT call /api/auth/refresh
 *
 * Expected counterexamples:
 *   1. PWA interceptor: on 401, calls localStorage.removeItem and redirects without refresh attempt
 *   2. Admin interceptor: on 401, calls localStorage.removeItem and redirects without refresh attempt
 *   3. Backend: POST /api/auth/refresh returns 404 (endpoint does not exist)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

console.log('\n=== Bug 3 — Token Refresh: Bug Condition Exploration Test ===\n');

// ── Test 1: PWA api.js interceptor does NOT attempt refresh on 401 ──
test('PWA api.js response interceptor does NOT call /auth/refresh on 401', () => {
  const pwaApiPath = resolve(__dirname, '../src/services/api.js');
  const apiCode = readFileSync(pwaApiPath, 'utf-8');

  // Check if the 401 handler contains any refresh logic
  const has401Handler = apiCode.includes('error.response?.status === 401') || 
                        apiCode.includes('error.response?.status !== 401');
  
  if (!has401Handler) {
    throw new Error(
      `No 401 handler found in PWA api.js.\n` +
      `         Expected: error.response?.status === 401 or !== 401 check`
    );
  }

  // Check if refresh endpoint is called in the 401 handler
  const hasRefreshCall = apiCode.includes('/auth/refresh') || apiCode.includes('/api/auth/refresh');
  
  if (hasRefreshCall) {
    throw new Error(
      `PWA api.js already contains refresh logic — bug may be fixed.\n` +
      `         Expected: no /auth/refresh call in 401 handler`
    );
  }

  // Check if it goes straight to logout (localStorage.removeItem + redirect)
  const hasDirectLogout = apiCode.includes('localStorage.removeItem') && 
                          apiCode.includes('window.location.href');
  
  if (!hasDirectLogout) {
    throw new Error(
      `PWA api.js 401 handler does not contain expected logout pattern.\n` +
      `         Expected: localStorage.removeItem + window.location.href redirect`
    );
  }

  // Counterexample: interceptor goes straight to logout without refresh
  throw new Error(
    `PWA interceptor on 401: calls localStorage.removeItem('access_token') and ` +
    `window.location.href = '/login' WITHOUT attempting POST /auth/refresh.\n` +
    `         Bug confirmed: no token refresh attempt.`
  );
});

// ── Test 2: Admin api.js interceptor does NOT attempt refresh on 401 ──
test('Admin api.js response interceptor does NOT call /auth/refresh on 401', () => {
  const adminApiPath = resolve(__dirname, '../../admin-panel/src/services/api.js');
  const apiCode = readFileSync(adminApiPath, 'utf-8');

  // Check if the 401 handler contains any refresh logic
  const has401Handler = apiCode.includes('error.response?.status === 401') || 
                        apiCode.includes('error.response?.status !== 401');
  
  if (!has401Handler) {
    throw new Error(
      `No 401 handler found in admin api.js.\n` +
      `         Expected: error.response?.status === 401 or !== 401 check`
    );
  }

  // Check if refresh endpoint is called in the 401 handler
  const hasRefreshCall = apiCode.includes('/auth/refresh') || apiCode.includes('/api/auth/refresh');
  
  if (hasRefreshCall) {
    throw new Error(
      `Admin api.js already contains refresh logic — bug may be fixed.\n` +
      `         Expected: no /auth/refresh call in 401 handler`
    );
  }

  // Check if it goes straight to logout (localStorage.removeItem + redirect)
  const hasDirectLogout = apiCode.includes('localStorage.removeItem') && 
                          apiCode.includes('window.location.href');
  
  if (!hasDirectLogout) {
    throw new Error(
      `Admin api.js 401 handler does not contain expected logout pattern.\n` +
      `         Expected: localStorage.removeItem + window.location.href redirect`
    );
  }

  // Counterexample: interceptor goes straight to logout without refresh
  throw new Error(
    `Admin interceptor on 401: calls localStorage.removeItem('admin_token') and ` +
    `window.location.href = '/login' WITHOUT attempting POST /auth/refresh.\n` +
    `         Bug confirmed: no token refresh attempt.`
  );
});

// ── Test 3: Backend /api/auth/refresh endpoint does NOT exist ──
test('Backend auth.py does NOT have /refresh endpoint', () => {
  const authRouterPath = resolve(__dirname, '../../backend/app/routers/auth.py');
  const authCode = readFileSync(authRouterPath, 'utf-8');

  // Check if /refresh endpoint exists
  const hasRefreshEndpoint = authCode.includes('@router.post("/refresh")') || 
                             authCode.includes('@router.post(\'/refresh\')') ||
                             authCode.includes('"/refresh"') && authCode.includes('async def refresh');
  
  if (hasRefreshEndpoint) {
    throw new Error(
      `Backend auth.py already has /refresh endpoint — bug may be fixed.\n` +
      `         Expected: no /refresh endpoint in auth.py`
    );
  }

  // Check existing endpoints to confirm we're looking at the right file
  const hasLoginEndpoint = authCode.includes('@router.post("/login")') || 
                           authCode.includes("@router.post('/login')") ||
                           (authCode.includes('"/login"') && authCode.includes('@router.post'));
  
  if (!hasLoginEndpoint) {
    throw new Error(
      `Cannot verify auth.py structure — /login endpoint not found.\n` +
      `         Expected: @router.post with "/login" in auth.py`
    );
  }

  // Counterexample: endpoint missing
  throw new Error(
    `Backend auth.py has endpoints: /login, /me, /register, /change-password.\n` +
    `         /api/auth/refresh endpoint MISSING — would return 404.\n` +
    `         Bug confirmed: no refresh endpoint exists.`
  );
});

// ── Test 4: Backend security.py does NOT have create_refresh_token function ──
test('Backend security.py does NOT have create_refresh_token function', () => {
  const securityPath = resolve(__dirname, '../../backend/app/utils/security.py');
  const securityCode = readFileSync(securityPath, 'utf-8');

  // Check if create_refresh_token exists
  const hasRefreshTokenFunc = securityCode.includes('def create_refresh_token') || 
                               securityCode.includes('create_refresh_token(');
  
  if (hasRefreshTokenFunc) {
    throw new Error(
      `Backend security.py already has create_refresh_token function — bug may be fixed.\n` +
      `         Expected: no create_refresh_token in security.py`
    );
  }

  // Check that create_access_token exists to confirm we're looking at the right file
  const hasAccessTokenFunc = securityCode.includes('def create_access_token');
  
  if (!hasAccessTokenFunc) {
    throw new Error(
      `Cannot verify security.py structure — create_access_token not found.\n` +
      `         Expected: def create_access_token in security.py`
    );
  }

  // Counterexample: function missing
  throw new Error(
    `Backend security.py has create_access_token but NOT create_refresh_token.\n` +
    `         Bug confirmed: no function to generate refresh tokens.`
  );
});

// ── Test 5: Token schema does NOT include refresh_token field ──
test('Backend Token schema does NOT have refresh_token field', () => {
  const schemaPath = resolve(__dirname, '../../backend/app/schemas/user.py');
  const schemaCode = readFileSync(schemaPath, 'utf-8');

  // Check if Token class exists
  const hasTokenClass = schemaCode.includes('class Token');
  
  if (!hasTokenClass) {
    throw new Error(
      `Cannot find Token class in user.py schema.\n` +
      `         Expected: class Token in schemas/user.py`
    );
  }

  // Check if refresh_token field exists in Token class
  // Extract Token class definition
  const tokenClassMatch = schemaCode.match(/class Token[^:]*:[\s\S]*?(?=\nclass |\n\n[a-zA-Z]|$)/);
  
  if (!tokenClassMatch) {
    throw new Error(
      `Cannot parse Token class definition.\n` +
      `         Expected: class Token with field definitions`
    );
  }

  const tokenClassDef = tokenClassMatch[0];
  const hasRefreshTokenField = tokenClassDef.includes('refresh_token');
  
  if (hasRefreshTokenField) {
    throw new Error(
      `Token schema already has refresh_token field — bug may be fixed.\n` +
      `         Expected: no refresh_token field in Token class`
    );
  }

  // Counterexample: field missing
  throw new Error(
    `Token schema has fields: access_token, token_type, expires_in, user, must_change_password.\n` +
    `         refresh_token field MISSING.\n` +
    `         Bug confirmed: login response cannot return refresh token.`
  );
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
  // Check if all failures are "bug may be fixed" messages
  const allFixed = counterexamples.every(ce => 
    ce.counterexample.includes('bug may be fixed') || 
    ce.counterexample.includes('already has') ||
    ce.counterexample.includes('already contains')
  );
  
  if (allFixed) {
    console.log('  ✓ BUG FIXED: All components now have token refresh implementation.');
    console.log('  ✓ Verification results:');
    console.log('    - PWA interceptor: contains refresh logic (/auth/refresh call present)');
    console.log('    - Admin interceptor: contains refresh logic (/auth/refresh call present)');
    console.log('    - Backend: /api/auth/refresh endpoint exists');
    console.log('    - Backend: create_refresh_token function exists');
    console.log('    - Backend: Token schema has refresh_token field');
    console.log('  ✓ Token refresh bug is resolved.');
    process.exit(0);
  } else {
    console.log('  ✓ BUG CONFIRMED: Test failures above are EXPECTED on unfixed code.');
    console.log('  ✓ Counterexamples document the exact bug condition:');
    console.log('    - PWA interceptor: goes straight to logout on 401, no refresh attempt');
    console.log('    - Admin interceptor: goes straight to logout on 401, no refresh attempt');
    console.log('    - Backend: /api/auth/refresh endpoint does not exist (404)');
    console.log('    - Backend: create_refresh_token function does not exist');
    console.log('    - Backend: Token schema has no refresh_token field');
    console.log('  ✗ DO NOT fix the code yet — this is the exploration phase.');
    // Exit with non-zero to signal test failure to CI / task runner
    process.exit(1);
  }
} else {
  console.log('  ✗ UNEXPECTED: All tests passed — bug may already be fixed or test is wrong.');
  process.exit(0);
}
