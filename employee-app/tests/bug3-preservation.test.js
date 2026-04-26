/**
 * Preservation Property Tests — Bug 3: Token Refresh
 *
 * Validates: Requirements 3.6, 3.7, 3.8, 3.9
 *
 * PURPOSE: These tests MUST PASS on unfixed code.
 * They document baseline behaviors that must be preserved after the fix.
 *
 * Preservation Requirements:
 *   - Non-401 responses (200, 500, 403, 404) pass through interceptor unchanged
 *   - Request interceptor attaches Authorization header when token present
 *   - Existing endpoints (/login, /me, /register, /change-password) return current shapes
 *   - Manual logout clears tokens and redirects
 *
 * These behaviors must remain identical after implementing token refresh.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ FAIL: ${name}`);
    console.log(`         Error: ${err.message}`);
    failed++;
  }
}

console.log('\n=== Bug 3 — Token Refresh: Preservation Property Tests ===\n');

// ── Property 1: Non-401 responses pass through unchanged ──
test('PWA api.js: Non-401 responses pass through interceptor unchanged', () => {
  const pwaApiPath = resolve(__dirname, '../src/services/api.js');
  const apiCode = readFileSync(pwaApiPath, 'utf-8');

  // Verify response interceptor exists
  const hasResponseInterceptor = apiCode.includes('api.interceptors.response.use');
  assert(hasResponseInterceptor, 'Response interceptor should exist');

  // Verify success handler passes response through
  const hasSuccessPassthrough = apiCode.includes('(response) => response');
  assert(hasSuccessPassthrough, 'Success handler should pass response through unchanged');

  // Verify 401 check is specific (doesn't affect other status codes)
  const has401Check = apiCode.includes('error.response?.status === 401') || 
                      apiCode.includes('error.response?.status !== 401');
  assert(has401Check, '401 check should be specific to status 401');

  // Verify error handler rejects non-401 errors
  const hasErrorReject = apiCode.includes('Promise.reject(error)');
  assert(hasErrorReject, 'Error handler should reject non-401 errors');

  console.log('         Baseline: 200, 500, 403, 404 responses pass through without modification');
});

test('Admin api.js: Non-401 responses pass through interceptor unchanged', () => {
  const adminApiPath = resolve(__dirname, '../../admin-panel/src/services/api.js');
  const apiCode = readFileSync(adminApiPath, 'utf-8');

  // Verify response interceptor exists
  const hasResponseInterceptor = apiCode.includes('api.interceptors.response.use');
  assert(hasResponseInterceptor, 'Response interceptor should exist');

  // Verify success handler passes response through
  const hasSuccessPassthrough = apiCode.includes('(response) => response');
  assert(hasSuccessPassthrough, 'Success handler should pass response through unchanged');

  // Verify 401 check is specific
  const has401Check = apiCode.includes('error.response?.status === 401') || 
                      apiCode.includes('error.response?.status !== 401');
  assert(has401Check, '401 check should be specific to status 401');

  // Verify error handler rejects non-401 errors
  const hasErrorReject = apiCode.includes('Promise.reject(error)');
  assert(hasErrorReject, 'Error handler should reject non-401 errors');

  console.log('         Baseline: 200, 500, 403, 404 responses pass through without modification');
});

// ── Property 2: Request interceptor attaches Authorization header when token present ──
test('PWA api.js: Request interceptor attaches Authorization header when token present', () => {
  const pwaApiPath = resolve(__dirname, '../src/services/api.js');
  const apiCode = readFileSync(pwaApiPath, 'utf-8');

  // Verify request interceptor exists
  const hasRequestInterceptor = apiCode.includes('api.interceptors.request.use');
  assert(hasRequestInterceptor, 'Request interceptor should exist');

  // Verify token is read from localStorage
  const readsAccessToken = apiCode.includes("localStorage.getItem('access_token')");
  assert(readsAccessToken, 'Request interceptor should read access_token from localStorage');

  // Verify Authorization header is set when token exists
  const setsAuthHeader = apiCode.includes('config.headers.Authorization') && 
                         apiCode.includes('Bearer');
  assert(setsAuthHeader, 'Request interceptor should set Authorization: Bearer <token> header');

  // Verify config is returned
  const returnsConfig = apiCode.includes('return config');
  assert(returnsConfig, 'Request interceptor should return config');

  console.log('         Baseline: Authorization header attached when access_token present in localStorage');
});

test('Admin api.js: Request interceptor attaches Authorization header when token present', () => {
  const adminApiPath = resolve(__dirname, '../../admin-panel/src/services/api.js');
  const apiCode = readFileSync(adminApiPath, 'utf-8');

  // Verify request interceptor exists
  const hasRequestInterceptor = apiCode.includes('api.interceptors.request.use');
  assert(hasRequestInterceptor, 'Request interceptor should exist');

  // Verify token is read from localStorage (admin uses 'admin_token')
  const readsAdminToken = apiCode.includes("localStorage.getItem('admin_token')");
  assert(readsAdminToken, 'Request interceptor should read admin_token from localStorage');

  // Verify Authorization header is set when token exists
  const setsAuthHeader = apiCode.includes('config.headers.Authorization') && 
                         apiCode.includes('Bearer');
  assert(setsAuthHeader, 'Request interceptor should set Authorization: Bearer <token> header');

  // Verify config is returned
  const returnsConfig = apiCode.includes('return config');
  assert(returnsConfig, 'Request interceptor should return config');

  console.log('         Baseline: Authorization header attached when admin_token present in localStorage');
});

// ── Property 3: Existing endpoints return current response shapes ──
test('Backend auth.py: Existing endpoints present and unchanged', () => {
  const authRouterPath = resolve(__dirname, '../../backend/app/routers/auth.py');
  const authCode = readFileSync(authRouterPath, 'utf-8');

  // Verify /login endpoint exists (check for @router.post and "/login" separately)
  const hasRouterPost = authCode.includes('@router.post');
  const hasLoginPath = authCode.includes('"/login"') || authCode.includes("'/login'");
  const hasLoginEndpoint = hasRouterPost && hasLoginPath;
  assert(hasLoginEndpoint, '/login endpoint should exist');

  // Verify /me endpoint exists
  const hasMePath = authCode.includes('"/me"') || authCode.includes("'/me'");
  const hasRouterGet = authCode.includes('@router.get');
  const hasMeEndpoint = hasRouterGet && hasMePath;
  assert(hasMeEndpoint, '/me endpoint should exist');

  // Verify /register endpoint exists
  const hasRegisterPath = authCode.includes('"/register"') || authCode.includes("'/register'");
  const hasRegisterEndpoint = hasRouterPost && hasRegisterPath;
  assert(hasRegisterEndpoint, '/register endpoint should exist');

  // Verify /change-password endpoint exists
  const hasChangePasswordPath = authCode.includes('"/change-password"') || authCode.includes("'/change-password'");
  const hasChangePasswordEndpoint = hasRouterPost && hasChangePasswordPath;
  assert(hasChangePasswordEndpoint, '/change-password endpoint should exist');

  // Verify Token response model is used for /login
  const loginReturnsToken = authCode.includes('response_model=Token');
  assert(loginReturnsToken, '/login should return Token response model');

  console.log('         Baseline: /login, /me, /register, /change-password endpoints exist with current signatures');
});

test('Backend Token schema: Current fields documented', () => {
  const schemaPath = resolve(__dirname, '../../backend/app/schemas/user.py');
  const schemaCode = readFileSync(schemaPath, 'utf-8');

  // Verify Token class exists
  const hasTokenClass = schemaCode.includes('class Token');
  assert(hasTokenClass, 'Token class should exist in user.py schema');

  // Extract Token class definition
  const tokenClassMatch = schemaCode.match(/class Token[^:]*:[\s\S]*?(?=\nclass |\n\n[a-zA-Z]|$)/);
  assert(tokenClassMatch, 'Should be able to parse Token class definition');

  const tokenClassDef = tokenClassMatch[0];

  // Verify current fields exist
  const hasAccessToken = tokenClassDef.includes('access_token');
  const hasTokenType = tokenClassDef.includes('token_type');
  const hasExpiresIn = tokenClassDef.includes('expires_in');
  const hasUser = tokenClassDef.includes('user');

  assert(hasAccessToken, 'Token should have access_token field');
  assert(hasTokenType, 'Token should have token_type field');
  assert(hasExpiresIn, 'Token should have expires_in field');
  assert(hasUser, 'Token should have user field');

  console.log('         Baseline: Token schema has access_token, token_type, expires_in, user fields');
  console.log('         Note: refresh_token will be added as Optional field (additive, non-breaking)');
});

// ── Property 4: Manual logout clears tokens and redirects ──
test('PWA api.js: 401 handler clears access_token from localStorage', () => {
  const pwaApiPath = resolve(__dirname, '../src/services/api.js');
  const apiCode = readFileSync(pwaApiPath, 'utf-8');

  // Verify 401 handler removes access_token
  const removesAccessToken = apiCode.includes("localStorage.removeItem('access_token')");
  assert(removesAccessToken, '401 handler should remove access_token from localStorage');

  // Verify 401 handler removes user
  const removesUser = apiCode.includes("localStorage.removeItem('user')");
  assert(removesUser, '401 handler should remove user from localStorage');

  // Verify 401 handler redirects to /login
  const redirectsToLogin = apiCode.includes("window.location.href = '/login'");
  assert(redirectsToLogin, '401 handler should redirect to /login');

  console.log('         Baseline: 401 clears access_token, user from localStorage and redirects to /login');
  console.log('         Note: After fix, this will only happen if refresh fails');
});

test('Admin api.js: 401 handler clears admin_token from localStorage', () => {
  const adminApiPath = resolve(__dirname, '../../admin-panel/src/services/api.js');
  const apiCode = readFileSync(adminApiPath, 'utf-8');

  // Verify 401 handler removes admin_token
  const removesAdminToken = apiCode.includes("localStorage.removeItem('admin_token')");
  assert(removesAdminToken, '401 handler should remove admin_token from localStorage');

  // Verify 401 handler removes admin_user
  const removesAdminUser = apiCode.includes("localStorage.removeItem('admin_user')");
  assert(removesAdminUser, '401 handler should remove admin_user from localStorage');

  // Verify 401 handler redirects to /login
  const redirectsToLogin = apiCode.includes("window.location.href = '/login'");
  assert(redirectsToLogin, '401 handler should redirect to /login');

  console.log('         Baseline: 401 clears admin_token, admin_user from localStorage and redirects to /login');
  console.log('         Note: After fix, this will only happen if refresh fails');
});

// ── Property 5: localStorage key namespaces are separate ──
test('PWA and Admin use separate localStorage key namespaces', () => {
  const pwaApiPath = resolve(__dirname, '../src/services/api.js');
  const adminApiPath = resolve(__dirname, '../../admin-panel/src/services/api.js');
  
  const pwaApiCode = readFileSync(pwaApiPath, 'utf-8');
  const adminApiCode = readFileSync(adminApiPath, 'utf-8');

  // PWA uses 'access_token' and 'user'
  const pwaUsesAccessToken = pwaApiCode.includes("'access_token'");
  const pwaUsesUser = pwaApiCode.includes("'user'");
  assert(pwaUsesAccessToken, 'PWA should use access_token key');
  assert(pwaUsesUser, 'PWA should use user key');

  // Admin uses 'admin_token' and 'admin_user'
  const adminUsesAdminToken = adminApiCode.includes("'admin_token'");
  const adminUsesAdminUser = adminApiCode.includes("'admin_user'");
  assert(adminUsesAdminToken, 'Admin should use admin_token key');
  assert(adminUsesAdminUser, 'Admin should use admin_user key');

  // Verify no collision
  const pwaUsesAdminKeys = pwaApiCode.includes("'admin_token'") || pwaApiCode.includes("'admin_user'");
  const adminUsesPwaKeys = adminApiCode.includes("'access_token'") && !adminApiCode.includes("'admin_token'");
  
  assert(!pwaUsesAdminKeys, 'PWA should not use admin localStorage keys');
  assert(!adminUsesPwaKeys, 'Admin should not use PWA localStorage keys (except in comments)');

  console.log('         Baseline: PWA uses access_token/user; Admin uses admin_token/admin_user');
  console.log('         Note: After fix, PWA will add refresh_token; Admin will add admin_refresh_token');
});

// ── Property 6: Valid token requests have zero overhead ──
test('PWA api.js: Request interceptor has no async operations (zero overhead)', () => {
  const pwaApiPath = resolve(__dirname, '../src/services/api.js');
  const apiCode = readFileSync(pwaApiPath, 'utf-8');

  // Extract request interceptor
  const requestInterceptorMatch = apiCode.match(/api\.interceptors\.request\.use\(([\s\S]*?)\)/);
  assert(requestInterceptorMatch, 'Should find request interceptor');

  const requestInterceptorCode = requestInterceptorMatch[1];

  // Verify no async/await in request interceptor
  const hasAsync = requestInterceptorCode.includes('async') || requestInterceptorCode.includes('await');
  assert(!hasAsync, 'Request interceptor should be synchronous (no async/await)');

  // Verify no Promise chains
  const hasPromiseChain = requestInterceptorCode.includes('.then(') || requestInterceptorCode.includes('.catch(');
  assert(!hasPromiseChain, 'Request interceptor should not have Promise chains');

  console.log('         Baseline: Request interceptor is synchronous — zero overhead for valid tokens');
});

test('Admin api.js: Request interceptor has no async operations (zero overhead)', () => {
  const adminApiPath = resolve(__dirname, '../../admin-panel/src/services/api.js');
  const apiCode = readFileSync(adminApiPath, 'utf-8');

  // Extract request interceptor
  const requestInterceptorMatch = apiCode.match(/api\.interceptors\.request\.use\(([\s\S]*?)\)/);
  assert(requestInterceptorMatch, 'Should find request interceptor');

  const requestInterceptorCode = requestInterceptorMatch[1];

  // Verify no async/await in request interceptor
  const hasAsync = requestInterceptorCode.includes('async') || requestInterceptorCode.includes('await');
  assert(!hasAsync, 'Request interceptor should be synchronous (no async/await)');

  // Verify no Promise chains
  const hasPromiseChain = requestInterceptorCode.includes('.then(') || requestInterceptorCode.includes('.catch(');
  assert(!hasPromiseChain, 'Request interceptor should not have Promise chains');

  console.log('         Baseline: Request interceptor is synchronous — zero overhead for valid tokens');
});

// ── Summary ──
console.log('\n─── Results ───────────────────────────────────────────');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

console.log('\n─── Interpretation ─────────────────────────────────────');
if (failed === 0) {
  console.log('  ✓ ALL PRESERVATION TESTS PASSED on unfixed code.');
  console.log('  ✓ Baseline behaviors documented:');
  console.log('    - Non-401 responses pass through unchanged');
  console.log('    - Request interceptor attaches Authorization header when token present');
  console.log('    - Existing endpoints (/login, /me, /register, /change-password) present');
  console.log('    - Manual logout clears tokens and redirects');
  console.log('    - PWA and Admin use separate localStorage namespaces');
  console.log('    - Request interceptors are synchronous (zero overhead)');
  console.log('  ✓ These behaviors MUST remain unchanged after implementing token refresh.');
  console.log('  ✓ Ready to proceed with Bug 3 fix implementation.');
  process.exit(0);
} else {
  console.log('  ✗ UNEXPECTED: Some preservation tests failed on unfixed code.');
  console.log('  ✗ This indicates the baseline behavior is different than expected.');
  console.log('  ✗ Review failures above before proceeding with fix.');
  process.exit(1);
}
