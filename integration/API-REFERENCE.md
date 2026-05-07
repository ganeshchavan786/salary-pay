# License Server API Reference - Integration

## Base URL

```
Production: https://license.vrushaliinfotech.com
```

---

## Authentication

### Customer Login (License Key)

```http
POST /api/auth/login
Content-Type: application/json

{
  "license_key": "your-license-key-here"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "customer_id": "uuid",
  "customer_name": "Company Name",
  "plan": "premium"
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Invalid license key"
}
```

---

## License Validation

### Validate License

```http
POST /api/license/validate
Content-Type: application/json

{
  "license_key": "your-license-key-here"
}
```

**Response (200 OK - Valid):**
```json
{
  "valid": true,
  "plan": "premium",
  "features": [
    "attendance_face",
    "attendance_basic",
    "employees_unlimited",
    "salary_full",
    "reports_advanced",
    "payroll_auto",
    "leave_advanced",
    "performance_reviews"
  ],
  "expires_at": "2026-06-01T00:00:00Z",
  "days_remaining": 25,
  "is_trial": false,
  "is_active": true,
  "customer_id": "uuid",
  "customer_name": "Company Name",
  "customer_email": "contact@company.com"
}
```

**Response (200 OK - Invalid):**
```json
{
  "valid": false,
  "reason": "expired",
  "message": "License expired on 2026-04-01",
  "expired_at": "2026-04-01T00:00:00Z"
}
```

**Response (200 OK - Blocked):**
```json
{
  "valid": false,
  "reason": "blocked",
  "message": "License has been blocked by administrator"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "License key not found"
}
```

---

### Check Feature Availability

```http
POST /api/license/check-feature
Content-Type: application/json

{
  "license_key": "your-license-key-here",
  "feature_name": "attendance_face"
}
```

**Response (200 OK - Available):**
```json
{
  "available": true,
  "feature_name": "attendance_face",
  "plan": "premium",
  "message": "Feature available in your plan"
}
```

**Response (200 OK - Not Available):**
```json
{
  "available": false,
  "feature_name": "attendance_face",
  "plan": "basic",
  "message": "Feature not available in Basic plan. Upgrade to Premium.",
  "required_plan": "premium"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "License key not found"
}
```

---

## Feature List by Plan

### Trial Plan (7 days)
```json
[
  "attendance_face",
  "attendance_basic",
  "employees_unlimited",
  "salary_full",
  "reports_advanced",
  "payroll_auto",
  "leave_advanced",
  "performance_reviews"
]
```

### Free Plan
```json
[
  "attendance_basic",
  "employees_5",
  "salary_basic",
  "reports_basic"
]
```

### Basic Plan (₹499/month)
```json
[
  "attendance_face",
  "attendance_basic",
  "employees_25",
  "salary_full",
  "reports_basic",
  "leave_basic"
]
```

### Premium Plan (₹999/month)
```json
[
  "attendance_face",
  "attendance_basic",
  "employees_unlimited",
  "salary_full",
  "reports_advanced",
  "payroll_auto",
  "leave_advanced",
  "performance_reviews",
  "custom_fields",
  "api_access",
  "priority_support"
]
```

---

## Analytics Tracking

### Track Feature Usage

```http
POST /api/analytics/track
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "feature_name": "attendance_mark",
  "metadata": {
    "employee_id": "EMP001",
    "method": "face_recognition"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Usage tracked successfully"
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Not authenticated"
}
```

---

### Get Analytics Dashboard

```http
GET /api/analytics/dashboard?days=30
Authorization: Bearer <customer_token>
```

**Response (200 OK):**
```json
{
  "total_usage": 1250,
  "feature_breakdown": {
    "attendance_mark": 500,
    "salary_processing": 50,
    "reports_generate": 200,
    "leave_apply": 300,
    "employee_add": 200
  },
  "daily_usage": {
    "2026-05-01": 45,
    "2026-05-02": 52,
    "2026-05-03": 38
  },
  "period_days": 30,
  "start_date": "2026-04-07T00:00:00Z",
  "end_date": "2026-05-07T00:00:00Z"
}
```

---

## Error Codes

| Status | Code | Meaning |
|--------|------|---------|
| 200 | - | Success |
| 400 | `invalid_request` | Invalid request body |
| 401 | `unauthorized` | Missing or invalid token |
| 403 | `forbidden` | License expired/blocked |
| 404 | `not_found` | License key not found |
| 422 | `validation_error` | Request validation failed |
| 429 | `rate_limit` | Too many requests |
| 500 | `server_error` | Internal server error |
| 503 | `service_unavailable` | Server maintenance |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/license/validate` | 100 requests | per minute |
| `/api/license/check-feature` | 200 requests | per minute |
| `/api/analytics/track` | 500 requests | per minute |
| `/api/analytics/dashboard` | 20 requests | per minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

---

## Webhooks (Future)

License server events साठी webhooks (planned feature):

### Events
- `license.expired` - License expired
- `license.renewed` - License renewed
- `license.upgraded` - Plan upgraded
- `license.blocked` - License blocked by admin

### Webhook Payload
```json
{
  "event": "license.expired",
  "timestamp": "2026-05-07T10:00:00Z",
  "data": {
    "license_key": "xxxx-xxxx-xxxx-xxxx",
    "customer_id": "uuid",
    "customer_name": "Company Name",
    "plan": "basic",
    "expired_at": "2026-05-07T00:00:00Z"
  }
}
```

---

## Best Practices

### 1. Cache Responses
License validation responses cache करा (5-10 minutes) — server load कमी होईल.

```python
# Good
cache_ttl = 300  # 5 minutes
```

### 2. Graceful Degradation
Network errors वर gracefully handle करा — offline grace period वापरा.

```python
# Good
if network_error:
    if within_grace_period:
        allow_access()
    else:
        deny_access()
```

### 3. Async Analytics
Analytics tracking async करा — user experience block होऊ नये.

```python
# Good
track_usage_async(feature_name)  # Fire and forget
```

### 4. Feature Check Caching
Feature checks cache करा — repeated calls टाळा.

```python
# Good
cache_feature_check(feature_name, ttl=300)
```

### 5. Error Logging
सर्व license errors log करा — debugging साठी.

```python
# Good
logger.error(f"License validation failed: {error}")
```

---

## Testing Endpoints

### Health Check
```http
GET /health
```
**Response:**
```json
{ "status": "ok" }
```

### API Documentation
```
GET /docs        → Swagger UI
GET /redoc       → ReDoc UI
GET /openapi.json → OpenAPI schema
```

---

## Support

**Production URL:** https://license.vrushaliinfotech.com  
**API Docs:** https://license.vrushaliinfotech.com/docs  
**Support Email:** support@vrushaliinfotech.com  
**Response Time:** 24 hours

---

## Changelog

### Version 1.0.0 (May 2026)
- Initial release
- License validation API
- Feature check API
- Analytics tracking API
- Customer authentication
