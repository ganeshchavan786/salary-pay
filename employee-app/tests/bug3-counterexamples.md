# Bug 3 — Token Refresh: Counterexamples Documentation

## Test Execution Date
Run on unfixed code (exploration phase)

## Bug Condition
`isBugCondition_TokenExpiry(X)` where:
- `X.response.status = 401`
- `token_is_expired(X.localStorage["access_token"])`
- `X.localStorage["refresh_token"] IS NOT NULL`
- Interceptor does NOT call `/api/auth/refresh`

## Counterexamples Found

### 1. PWA Interceptor Behavior
**Test**: PWA api.js response interceptor does NOT call /auth/refresh on 401

**Counterexample**: 
```
PWA interceptor on 401: calls localStorage.removeItem('access_token') 
and window.location.href = '/login' WITHOUT attempting POST /auth/refresh.
Bug confirmed: no token refresh attempt.
```

**Evidence**: 
- File: `Face-Recognition-Attendance-PWA/pwa-app/src/services/api.js`
- The 401 response interceptor contains:
  ```javascript
  if (error.response?.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }
  ```
- No call to `/auth/refresh` endpoint
- No queue mechanism for concurrent requests
- Immediate logout on any 401 response

### 2. Admin Panel Interceptor Behavior
**Test**: Admin api.js response interceptor does NOT call /auth/refresh on 401

**Counterexample**:
```
Admin interceptor on 401: calls localStorage.removeItem('admin_token') 
and window.location.href = '/login' WITHOUT attempting POST /auth/refresh.
Bug confirmed: no token refresh attempt.
```

**Evidence**:
- File: `Face-Recognition-Attendance-PWA/admin-panel/src/services/api.js`
- The 401 response interceptor contains:
  ```javascript
  if (error.response?.status === 401) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    window.location.href = '/login'
  }
  ```
- No call to `/auth/refresh` endpoint
- No queue mechanism for concurrent requests
- Immediate logout on any 401 response

### 3. Backend Refresh Endpoint Missing
**Test**: Backend auth.py does NOT have /refresh endpoint

**Counterexample**:
```
Backend auth.py has endpoints: /login, /me, /register, /change-password.
/api/auth/refresh endpoint MISSING — would return 404.
Bug confirmed: no refresh endpoint exists.
```

**Evidence**:
- File: `Face-Recognition-Attendance-PWA/backend/app/routers/auth.py`
- Existing endpoints:
  - `@router.post("/login")` ✓
  - `@router.get("/me")` ✓
  - `@router.post("/register")` ✓
  - `@router.post("/change-password")` ✓
  - `@router.post("/refresh")` ✗ MISSING
- Any attempt to call `POST /api/auth/refresh` would return HTTP 404

### 4. Backend Refresh Token Generation Missing
**Test**: Backend security.py does NOT have create_refresh_token function

**Counterexample**:
```
Backend security.py has create_access_token but NOT create_refresh_token.
Bug confirmed: no function to generate refresh tokens.
```

**Evidence**:
- File: `Face-Recognition-Attendance-PWA/backend/app/utils/security.py`
- Existing functions:
  - `create_access_token(user_id, username, role, expires_delta)` ✓
  - `verify_password(plain_password, hashed_password)` ✓
  - `hash_password(password)` ✓
  - `create_refresh_token(...)` ✗ MISSING
- No mechanism to generate long-lived refresh tokens

### 5. Token Schema Missing Refresh Token Field
**Test**: Backend Token schema does NOT have refresh_token field

**Counterexample**:
```
Token schema has fields: access_token, token_type, expires_in, user, must_change_password.
refresh_token field MISSING.
Bug confirmed: login response cannot return refresh token.
```

**Evidence**:
- File: `Face-Recognition-Attendance-PWA/backend/app/schemas/user.py`
- Token class fields:
  - `access_token: str` ✓
  - `token_type: str` ✓
  - `expires_in: int` ✓
  - `user: UserResponse` ✓
  - `must_change_password: bool` ✓
  - `refresh_token: Optional[str]` ✗ MISSING
- Login endpoint cannot return refresh token even if one were generated

## Impact Analysis

### User Experience Impact
1. **Abrupt Session Termination**: Users are immediately logged out when their access token expires, even if they have an active session
2. **Data Loss**: Any unsaved work (e.g., form data, pending attendance records) is lost on forced logout
3. **Poor UX**: No silent token refresh means frequent re-authentication interrupts workflow

### Technical Impact
1. **Race Conditions**: Multiple concurrent API calls during token expiry each trigger independent logout attempts
2. **No Recovery Path**: Valid refresh tokens (if they existed) cannot be used to recover the session
3. **Backend Incomplete**: Missing infrastructure (endpoint, function, schema field) prevents any frontend fix from working

### Security Impact
1. **Shorter Token Lifetimes Impractical**: Without refresh, access tokens must be long-lived, increasing security risk
2. **No Token Rotation**: Cannot implement refresh token rotation for enhanced security

## Root Cause Summary

The token refresh feature was never implemented. The system has:
- ✗ No backend endpoint to accept refresh tokens
- ✗ No backend function to generate refresh tokens
- ✗ No schema field to return refresh tokens
- ✗ No frontend logic to attempt refresh before logout
- ✗ No queue mechanism to handle concurrent requests during refresh

Both frontend apps implement the simplest possible 401 handler: immediate logout and redirect.

## Expected Behavior After Fix

1. **Frontend Interceptors**: On 401, attempt `POST /api/auth/refresh` with stored refresh token before logging out
2. **Backend Endpoint**: New `/api/auth/refresh` endpoint validates refresh token and returns new access token
3. **Backend Function**: New `create_refresh_token()` generates long-lived tokens (7 days)
4. **Token Schema**: Login response includes `refresh_token` field
5. **Queue Mechanism**: Concurrent requests during refresh are queued and retried with new token
6. **Graceful Degradation**: Only logout if refresh attempt fails (invalid/expired refresh token)

## Test Status
✓ All 5 tests FAILED as expected on unfixed code
✓ Counterexamples documented
✓ Bug condition confirmed
✗ DO NOT fix code yet — this is the exploration phase
