# HRMS Integration Guide - SalaryPay License Server

## Overview

हा document HRMS application मध्ये SalaryPay License Server integrate करण्यासाठी complete step-by-step guide आहे.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HRMS Application                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         License Validation Middleware            │  │
│  │  (Startup + Periodic Check + Feature Gate)      │  │
│  └──────────────────────────────────────────────────┘  │
│                         ↓                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │              License Service Layer               │  │
│  │  - Validate License                              │  │
│  │  - Check Features                                │  │
│  │  - Track Usage                                   │  │
│  │  - Handle Errors                                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│         SalaryPay License Server API                    │
│         https://license.vrushaliinfotech.com            │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Configuration

### Environment Variables

HRMS च्या `.env` file मध्ये हे add करा:

```env
# License Server Configuration
LICENSE_SERVER_URL=https://license.vrushaliinfotech.com
LICENSE_KEY=your-license-key-here
LICENSE_CHECK_INTERVAL=3600  # seconds (1 hour)
LICENSE_CACHE_ENABLED=true
LICENSE_CACHE_TTL=300  # seconds (5 minutes)
```

### Configuration File (Optional)

```json
{
  "license": {
    "server_url": "https://license.vrushaliinfotech.com",
    "license_key": "your-license-key-here",
    "check_interval": 3600,
    "cache_enabled": true,
    "cache_ttl": 300,
    "retry_attempts": 3,
    "retry_delay": 5,
    "timeout": 10
  }
}
```

---

## Step 2: License Service Implementation

### Python Example (FastAPI/Flask)

```python
# services/license_service.py
import os
import time
import requests
from typing import Dict, Optional
from datetime import datetime, timedelta

class LicenseService:
    def __init__(self):
        self.server_url = os.getenv('LICENSE_SERVER_URL')
        self.license_key = os.getenv('LICENSE_KEY')
        self.cache_enabled = os.getenv('LICENSE_CACHE_ENABLED', 'true').lower() == 'true'
        self.cache_ttl = int(os.getenv('LICENSE_CACHE_TTL', 300))
        
        # Cache
        self._cache = {}
        self._cache_timestamp = {}
    
    def validate_license(self) -> Dict:
        """
        License validate करा - startup वेळी call करा
        
        Returns:
            {
                "valid": true/false,
                "plan": "basic/premium/trial",
                "features": ["feature1", "feature2"],
                "expires_at": "2026-06-01T00:00:00Z",
                "days_remaining": 25,
                "is_trial": false,
                "customer_name": "Company Name"
            }
        """
        cache_key = 'license_validation'
        
        # Check cache
        if self.cache_enabled and self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        try:
            response = requests.post(
                f"{self.server_url}/api/license/validate",
                json={"license_key": self.license_key},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Cache result
                if self.cache_enabled:
                    self._cache[cache_key] = data
                    self._cache_timestamp[cache_key] = time.time()
                
                return data
            else:
                return {
                    "valid": False,
                    "error": f"HTTP {response.status_code}",
                    "message": response.text
                }
        
        except requests.exceptions.Timeout:
            return {
                "valid": False,
                "error": "timeout",
                "message": "License server timeout"
            }
        except requests.exceptions.ConnectionError:
            return {
                "valid": False,
                "error": "connection_error",
                "message": "Cannot connect to license server"
            }
        except Exception as e:
            return {
                "valid": False,
                "error": "unknown",
                "message": str(e)
            }
    
    def check_feature(self, feature_name: str) -> bool:
        """
        Feature available आहे का check करा
        
        Args:
            feature_name: Feature name (e.g., "attendance_face", "salary_full")
        
        Returns:
            True if feature available, False otherwise
        """
        cache_key = f'feature_{feature_name}'
        
        # Check cache
        if self.cache_enabled and self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        try:
            response = requests.post(
                f"{self.server_url}/api/license/check-feature",
                json={
                    "license_key": self.license_key,
                    "feature_name": feature_name
                },
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                available = data.get('available', False)
                
                # Cache result
                if self.cache_enabled:
                    self._cache[cache_key] = available
                    self._cache_timestamp[cache_key] = time.time()
                
                return available
            else:
                # Default: deny access on error
                return False
        
        except Exception:
            # Default: deny access on error
            return False
    
    def track_usage(self, feature_name: str, metadata: Optional[Dict] = None):
        """
        Feature usage track करा (async - fire and forget)
        
        Args:
            feature_name: Feature name
            metadata: Optional metadata (e.g., {"employee_count": 50})
        """
        try:
            # Get customer token first
            token = self._get_customer_token()
            if not token:
                return
            
            requests.post(
                f"{self.server_url}/api/analytics/track",
                json={
                    "feature_name": feature_name,
                    "metadata": metadata or {}
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
        except Exception:
            # Silent fail - analytics shouldn't block app
            pass
    
    def _get_customer_token(self) -> Optional[str]:
        """
        Customer token मिळवा (license key वापरून login)
        """
        cache_key = 'customer_token'
        
        # Check cache (token 1 hour valid)
        if self._is_cache_valid(cache_key, ttl=3600):
            return self._cache[cache_key]
        
        try:
            # License key वापरून login करा
            response = requests.post(
                f"{self.server_url}/api/auth/login",
                json={"license_key": self.license_key},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get('access_token')
                
                # Cache token
                self._cache[cache_key] = token
                self._cache_timestamp[cache_key] = time.time()
                
                return token
        except Exception:
            pass
        
        return None
    
    def _is_cache_valid(self, key: str, ttl: Optional[int] = None) -> bool:
        """Check if cache entry is valid"""
        if key not in self._cache or key not in self._cache_timestamp:
            return False
        
        ttl = ttl or self.cache_ttl
        age = time.time() - self._cache_timestamp[key]
        return age < ttl
    
    def clear_cache(self):
        """Clear all cache"""
        self._cache.clear()
        self._cache_timestamp.clear()


# Singleton instance
license_service = LicenseService()
```

---

## Step 3: Startup Validation

### Application Startup

HRMS application start होताना license validate करा:

```python
# main.py (FastAPI example)
from fastapi import FastAPI
from services.license_service import license_service
import sys

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    """Application startup - license validate करा"""
    print("🔐 Validating license...")
    
    result = license_service.validate_license()
    
    if not result.get('valid'):
        print(f"❌ License validation failed: {result.get('message')}")
        print("⚠️  Application will not start without valid license")
        sys.exit(1)
    
    print(f"✅ License valid")
    print(f"   Plan: {result.get('plan')}")
    print(f"   Expires: {result.get('expires_at')}")
    print(f"   Days remaining: {result.get('days_remaining')}")
    
    if result.get('is_trial'):
        print(f"⚠️  Trial license - {result.get('days_remaining')} days remaining")
```

---

## Step 4: Feature Gating

### Decorator Pattern (Python)

```python
# decorators/license_decorator.py
from functools import wraps
from fastapi import HTTPException
from services.license_service import license_service

def require_feature(feature_name: str):
    """
    Feature gate decorator - feature available नसेल तर 403 error
    
    Usage:
        @require_feature("attendance_face")
        async def mark_attendance_with_face():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not license_service.check_feature(feature_name):
                raise HTTPException(
                    status_code=403,
                    detail=f"Feature '{feature_name}' not available in your plan. Please upgrade."
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# Usage in routes
from decorators.license_decorator import require_feature

@app.post("/api/attendance/mark-face")
@require_feature("attendance_face")
async def mark_attendance_with_face(data: dict):
    """Face recognition attendance - Premium plan only"""
    # Implementation
    return {"success": True}

@app.post("/api/salary/process")
@require_feature("salary_full")
async def process_salary(data: dict):
    """Full salary processing - Basic/Premium plans"""
    # Implementation
    return {"success": True}
```

### Middleware Pattern (Python)

```python
# middleware/license_middleware.py
from fastapi import Request, HTTPException
from services.license_service import license_service

# Feature mapping - route → required feature
FEATURE_MAP = {
    "/api/attendance/mark-face": "attendance_face",
    "/api/salary/process": "salary_full",
    "/api/reports/advanced": "reports_advanced",
    "/api/employees/bulk-import": "employees_unlimited",
}

@app.middleware("http")
async def license_check_middleware(request: Request, call_next):
    """
    Global license check middleware
    """
    path = request.url.path
    
    # Check if route requires feature
    if path in FEATURE_MAP:
        feature = FEATURE_MAP[path]
        
        if not license_service.check_feature(feature):
            raise HTTPException(
                status_code=403,
                detail=f"Feature not available in your plan. Please upgrade."
            )
    
    response = await call_next(request)
    return response
```

---

## Step 5: Usage Analytics Tracking

### Track Feature Usage

```python
# routes/attendance.py
from services.license_service import license_service

@app.post("/api/attendance/mark")
async def mark_attendance(data: dict):
    """Mark attendance"""
    
    # Business logic
    result = process_attendance(data)
    
    # Track usage (async - won't block response)
    license_service.track_usage(
        feature_name="attendance_mark",
        metadata={
            "employee_id": data.get('employee_id'),
            "method": "manual"
        }
    )
    
    return result

@app.post("/api/salary/process")
async def process_salary(data: dict):
    """Process salary"""
    
    # Business logic
    result = calculate_salary(data)
    
    # Track usage
    license_service.track_usage(
        feature_name="salary_processing",
        metadata={
            "employee_count": len(data.get('employees', [])),
            "month": data.get('month')
        }
    )
    
    return result
```

---

## Step 6: Periodic License Check

### Background Task (APScheduler)

```python
# tasks/license_tasks.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.license_service import license_service
import sys

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', hours=1)
def periodic_license_check():
    """
    हर 1 घंटे license check करा
    Invalid झाला तर application stop करा
    """
    print("🔐 Periodic license check...")
    
    result = license_service.validate_license()
    
    if not result.get('valid'):
        print(f"❌ License invalid: {result.get('message')}")
        print("⚠️  Shutting down application")
        sys.exit(1)
    
    days_remaining = result.get('days_remaining', 0)
    
    if days_remaining <= 7:
        print(f"⚠️  License expiring soon: {days_remaining} days remaining")
    else:
        print(f"✅ License valid: {days_remaining} days remaining")

# Start scheduler
scheduler.start()
```

---

## Step 7: Error Handling

### Graceful Degradation

```python
# services/license_service.py (enhanced)

class LicenseService:
    def __init__(self):
        # ... existing code ...
        self.offline_mode = False
        self.offline_grace_period = 24 * 3600  # 24 hours
        self.last_successful_check = None
    
    def validate_license(self) -> Dict:
        """License validate करा with offline grace period"""
        try:
            result = self._validate_online()
            
            if result.get('valid'):
                self.offline_mode = False
                self.last_successful_check = time.time()
                return result
            else:
                return self._handle_invalid_license(result)
        
        except Exception as e:
            # Network error - check offline grace period
            return self._handle_offline_mode(e)
    
    def _handle_offline_mode(self, error: Exception) -> Dict:
        """
        License server unreachable - offline grace period check करा
        """
        if self.last_successful_check is None:
            # First time - must connect
            return {
                "valid": False,
                "error": "connection_required",
                "message": "Cannot validate license - server unreachable"
            }
        
        offline_duration = time.time() - self.last_successful_check
        
        if offline_duration < self.offline_grace_period:
            # Within grace period - allow
            self.offline_mode = True
            remaining = self.offline_grace_period - offline_duration
            
            print(f"⚠️  Offline mode: {remaining/3600:.1f} hours remaining")
            
            return {
                "valid": True,
                "offline_mode": True,
                "offline_remaining": remaining,
                "message": "Running in offline mode"
            }
        else:
            # Grace period expired
            return {
                "valid": False,
                "error": "offline_grace_expired",
                "message": "Offline grace period expired - cannot validate license"
            }
```

---

## Step 8: Frontend Integration (React)

### License Context

```javascript
// context/LicenseContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const LicenseContext = createContext();

export const LicenseProvider = ({ children }) => {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validateLicense();
  }, []);

  const validateLicense = async () => {
    try {
      const response = await axios.get('/api/license/status');
      setLicense(response.data);
    } catch (error) {
      console.error('License validation failed:', error);
      setLicense({ valid: false });
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (featureName) => {
    if (!license || !license.valid) return false;
    return license.features?.includes(featureName) || false;
  };

  return (
    <LicenseContext.Provider value={{ license, loading, hasFeature }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => useContext(LicenseContext);
```

### Feature Gate Component

```javascript
// components/FeatureGate.jsx
import React from 'react';
import { useLicense } from '../context/LicenseContext';
import { Alert } from './Alert';

export const FeatureGate = ({ feature, children, fallback }) => {
  const { hasFeature, license } = useLicense();

  if (!hasFeature(feature)) {
    return fallback || (
      <Alert type="warning">
        This feature is not available in your {license?.plan} plan.
        <a href="/upgrade">Upgrade now</a>
      </Alert>
    );
  }

  return children;
};

// Usage
<FeatureGate feature="attendance_face">
  <FaceRecognitionAttendance />
</FeatureGate>
```

---

## Step 9: Testing

### Test License Keys

Development/testing साठी test license keys:

```
Trial (7 days):   TEST-TRIAL-XXXX-XXXX-XXXX
Basic (30 days):  TEST-BASIC-XXXX-XXXX-XXXX
Premium (30 days): TEST-PREMIUM-XXXX-XXXX-XXXX
```

### Mock Responses

```python
# tests/test_license.py
import pytest
from unittest.mock import patch, MagicMock

@pytest.fixture
def mock_license_valid():
    return {
        "valid": True,
        "plan": "premium",
        "features": ["attendance_face", "salary_full", "reports_advanced"],
        "expires_at": "2026-06-01T00:00:00Z",
        "days_remaining": 25,
        "is_trial": False
    }

@patch('requests.post')
def test_license_validation(mock_post, mock_license_valid):
    mock_post.return_value = MagicMock(
        status_code=200,
        json=lambda: mock_license_valid
    )
    
    from services.license_service import license_service
    result = license_service.validate_license()
    
    assert result['valid'] == True
    assert result['plan'] == 'premium'
```

---

## Step 10: Deployment Checklist

### Production Deployment

- [ ] `.env` मध्ये production license key set केली
- [ ] `LICENSE_SERVER_URL` production URL आहे
- [ ] Cache enabled आहे (performance साठी)
- [ ] Periodic license check enabled आहे
- [ ] Error logging configured आहे
- [ ] Offline grace period configured आहे
- [ ] Feature gates सर्व routes वर applied आहेत
- [ ] Analytics tracking implemented आहे

---

## Troubleshooting

### License Validation Fails

**Problem:** `validate_license()` returns `valid: false`

**Solutions:**
1. License key correct आहे का check करा
2. License expired तर नाही check करा
3. Network connectivity check करा
4. License server URL correct आहे का verify करा

### Feature Check Always Returns False

**Problem:** `check_feature()` always returns `False`

**Solutions:**
1. License valid आहे का check करा
2. Feature name correct आहे का verify करा (case-sensitive)
3. Plan मध्ये feature included आहे का check करा
4. Cache clear करून retry करा

### Analytics Not Tracking

**Problem:** Usage analytics dashboard मध्ये data नाही

**Solutions:**
1. Customer token valid आहे का check करा
2. Network errors check करा (silent fail होतो)
3. Feature name consistent आहे का verify करा
4. License server logs check करा

---

## Support

**License Server:** https://license.vrushaliinfotech.com  
**API Docs:** https://license.vrushaliinfotech.com/docs  
**Support Email:** support@vrushaliinfotech.com

---

## Next Steps

1. [API Reference](./API-REFERENCE.md) - Complete API documentation
2. [Implementation Examples](./IMPLEMENTATION-EXAMPLES.md) - More code examples
3. [Testing Guide](./TESTING-GUIDE.md) - Testing strategies
