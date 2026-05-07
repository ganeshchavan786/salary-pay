# Quick Start Guide for AI Assistants (Antigravity AI)

## Overview

हा document AI assistants (Antigravity AI, Cursor, etc.) साठी आहे — HRMS application मध्ये SalaryPay License Server integrate करण्यासाठी.

---

## What You Need to Know

### License Server Details
- **Production URL:** `https://license.vrushaliinfotech.com`
- **API Docs:** `https://license.vrushaliinfotech.com/docs`
- **Authentication:** License key based (no username/password)

### Integration Points
1. **Startup Validation** - Application start होताना license validate करा
2. **Feature Gating** - Features protect करा (middleware/decorator)
3. **Usage Tracking** - Feature usage analytics track करा

---

## Step-by-Step Implementation

### Step 1: Environment Configuration

Add to `.env`:
```env
LICENSE_SERVER_URL=https://license.vrushaliinfotech.com
LICENSE_KEY=<customer-license-key>
```

### Step 2: License Service

Create `services/license_service.py` (Python example):

```python
import os
import requests
from typing import Dict

class LicenseService:
    def __init__(self):
        self.server_url = os.getenv('LICENSE_SERVER_URL')
        self.license_key = os.getenv('LICENSE_KEY')
    
    def validate(self) -> Dict:
        """Validate license - call on startup"""
        response = requests.post(
            f"{self.server_url}/api/license/validate",
            json={"license_key": self.license_key},
            timeout=10
        )
        return response.json() if response.status_code == 200 else {"valid": False}
    
    def has_feature(self, feature: str) -> bool:
        """Check if feature available"""
        response = requests.post(
            f"{self.server_url}/api/license/check-feature",
            json={"license_key": self.license_key, "feature_name": feature},
            timeout=5
        )
        return response.json().get('available', False) if response.status_code == 200 else False

license_service = LicenseService()
```

### Step 3: Startup Validation

Add to `main.py`:

```python
from services.license_service import license_service
import sys

@app.on_event("startup")
async def startup():
    result = license_service.validate()
    if not result.get('valid'):
        print(f"❌ License invalid: {result.get('message')}")
        sys.exit(1)
    print(f"✅ License valid - Plan: {result.get('plan')}")
```

### Step 4: Feature Gate

Create decorator `decorators/license.py`:

```python
from functools import wraps
from fastapi import HTTPException
from services.license_service import license_service

def require_feature(feature: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not license_service.has_feature(feature):
                raise HTTPException(status_code=403, detail=f"Feature '{feature}' not available")
            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

Use in routes:

```python
@app.post("/api/attendance/mark-face")
@require_feature("attendance_face")
async def mark_face_attendance(data: dict):
    # Implementation
    return {"success": True}
```

---

## API Endpoints

### 1. Validate License
```http
POST /api/license/validate
Content-Type: application/json

{
  "license_key": "your-license-key"
}
```

**Response:**
```json
{
  "valid": true,
  "plan": "premium",
  "features": ["attendance_face", "salary_full", "..."],
  "expires_at": "2026-06-01T00:00:00Z",
  "days_remaining": 25
}
```

### 2. Check Feature
```http
POST /api/license/check-feature
Content-Type: application/json

{
  "license_key": "your-license-key",
  "feature_name": "attendance_face"
}
```

**Response:**
```json
{
  "available": true,
  "feature_name": "attendance_face",
  "plan": "premium"
}
```

---

## Feature Names

Common features to check:

| Feature Name | Description | Plans |
|--------------|-------------|-------|
| `attendance_face` | Face recognition attendance | Premium |
| `attendance_basic` | Basic attendance | All |
| `employees_unlimited` | Unlimited employees | Premium, Trial |
| `employees_25` | Up to 25 employees | Basic |
| `employees_5` | Up to 5 employees | Free |
| `salary_full` | Full salary processing | Basic, Premium, Trial |
| `salary_basic` | Basic salary | Free |
| `reports_advanced` | Advanced reports | Premium, Trial |
| `reports_basic` | Basic reports | All |
| `payroll_auto` | Auto payroll | Premium, Trial |
| `leave_advanced` | Advanced leave | Premium, Trial |
| `leave_basic` | Basic leave | Basic |

---

## Testing

### Test with curl:
```bash
curl -X POST https://license.vrushaliinfotech.com/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key": "test-key"}'
```

### Test in code:
```python
from services.license_service import license_service

# Validate
result = license_service.validate()
print(f"Valid: {result['valid']}, Plan: {result.get('plan')}")

# Check feature
has_face = license_service.has_feature("attendance_face")
print(f"Face attendance: {has_face}")
```

---

## Error Handling

### Invalid License
```json
{
  "valid": false,
  "reason": "expired",
  "message": "License expired on 2026-04-01"
}
```

**Action:** Show error to user, block application.

### Network Error
```python
try:
    result = license_service.validate()
except Exception as e:
    # Handle offline mode with grace period
    pass
```

**Action:** Implement offline grace period (24 hours).

---

## Complete Examples

### Python (FastAPI)
See: `docs/integration/IMPLEMENTATION-EXAMPLES.md` → Section 1

### Node.js (Express)
See: `docs/integration/IMPLEMENTATION-EXAMPLES.md` → Section 2

### React (Frontend)
See: `docs/integration/IMPLEMENTATION-EXAMPLES.md` → Section 3

### .NET Core
See: `docs/integration/IMPLEMENTATION-EXAMPLES.md` → Section 4

### PHP (Laravel)
See: `docs/integration/IMPLEMENTATION-EXAMPLES.md` → Section 5

---

## Implementation Checklist

When implementing, ensure:

- [ ] Environment variable `LICENSE_KEY` configured
- [ ] License validation on application startup
- [ ] Application exits if license invalid
- [ ] Feature gates on protected routes
- [ ] HTTP 403 response when feature not available
- [ ] Cache responses (5 minutes recommended)
- [ ] Timeout handling (10s for validate, 5s for feature check)
- [ ] Error logging for debugging

---

## Common Patterns

### Pattern 1: Startup Validation
```python
# Validate on startup, exit if invalid
result = license_service.validate()
if not result['valid']:
    sys.exit(1)
```

### Pattern 2: Feature Gate Decorator
```python
@require_feature("feature_name")
async def protected_endpoint():
    pass
```

### Pattern 3: Feature Gate Middleware
```python
if path_requires_feature(request.path):
    if not has_feature(required_feature):
        return 403
```

### Pattern 4: Inline Check
```python
if not license_service.has_feature("attendance_face"):
    raise HTTPException(403, "Feature not available")
```

---

## Documentation Links

- **Complete Integration Guide:** `docs/integration/HRMS-INTEGRATION.md`
- **API Reference:** `docs/integration/API-REFERENCE.md`
- **Code Examples:** `docs/integration/IMPLEMENTATION-EXAMPLES.md`
- **Testing Guide:** `docs/integration/TESTING-GUIDE.md`

---

## Support

**License Server:** https://license.vrushaliinfotech.com  
**API Docs:** https://license.vrushaliinfotech.com/docs  
**Support Email:** support@vrushaliinfotech.com

---

## Summary for AI

**Task:** Integrate license validation in HRMS application

**Key Steps:**
1. Add `LICENSE_KEY` to environment
2. Create `LicenseService` class with `validate()` and `has_feature()` methods
3. Call `validate()` on startup, exit if invalid
4. Add `@require_feature()` decorator to protected routes
5. Return HTTP 403 when feature not available

**API Endpoints:**
- `POST /api/license/validate` - Validate license
- `POST /api/license/check-feature` - Check feature availability

**Error Handling:**
- Invalid license → Exit application
- Network error → Offline grace period (24h)
- Feature unavailable → HTTP 403

**Testing:**
- Use curl to test API endpoints
- Verify startup validation works
- Test feature gates return 403

Done! 🚀
