# Testing Guide - License Integration

## Overview

License integration test करण्यासाठी complete guide.

---

## 1. Quick Test (Browser)

### License Server Live आहे का?

Browser मध्ये open करा:
```
https://license.vrushaliinfotech.com/health
```

**Expected Response:**
```json
{ "status": "ok" }
```

### API Docs
```
https://license.vrushaliinfotech.com/docs
```
Swagger UI मध्ये directly API test करता येते.

---

## 2. API Testing (curl)

### License Validate करा

```bash
curl -X POST https://license.vrushaliinfotech.com/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key": "your-license-key-here"}'
```

**Expected Response:**
```json
{
  "valid": true,
  "plan": "premium",
  "features": ["attendance_face", "salary_full"],
  "expires_at": "2026-06-01T00:00:00Z",
  "days_remaining": 25
}
```

### Feature Check करा

```bash
curl -X POST https://license.vrushaliinfotech.com/api/license/check-feature \
  -H "Content-Type: application/json" \
  -d '{"license_key": "your-license-key-here", "feature_name": "attendance_face"}'
```

**Expected Response:**
```json
{
  "available": true,
  "feature_name": "attendance_face",
  "plan": "premium"
}
```

### Customer Login करा

```bash
curl -X POST https://license.vrushaliinfotech.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"license_key": "your-license-key-here"}'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "plan": "premium"
}
```

### Analytics Track करा

```bash
# First get token
TOKEN=$(curl -s -X POST https://license.vrushaliinfotech.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"license_key": "your-license-key-here"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Then track
curl -X POST https://license.vrushaliinfotech.com/api/analytics/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"feature_name": "attendance_mark", "metadata": {"employee_id": "EMP001"}}'
```

---

## 3. Python Unit Tests

```python
# tests/test_license_integration.py
import pytest
from unittest.mock import patch, MagicMock
from services.license_service import LicenseService

class TestLicenseService:
    
    def setup_method(self):
        """Setup test instance"""
        self.service = LicenseService()
        self.service.license_key = "test-license-key"
        self.service.server_url = "https://license.vrushaliinfotech.com"
    
    # ── Validate Tests ─────────────────────────────────────
    
    @patch('requests.post')
    def test_validate_success(self, mock_post):
        """Valid license returns correct data"""
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {
                "valid": True,
                "plan": "premium",
                "features": ["attendance_face", "salary_full"],
                "days_remaining": 25
            }
        )
        
        result = self.service.validate()
        
        assert result['valid'] == True
        assert result['plan'] == 'premium'
        assert 'attendance_face' in result['features']
    
    @patch('requests.post')
    def test_validate_expired(self, mock_post):
        """Expired license returns valid=false"""
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {
                "valid": False,
                "reason": "expired",
                "message": "License expired"
            }
        )
        
        result = self.service.validate()
        
        assert result['valid'] == False
        assert result['reason'] == 'expired'
    
    @patch('requests.post')
    def test_validate_network_error(self, mock_post):
        """Network error returns valid=false"""
        mock_post.side_effect = Exception("Connection refused")
        
        result = self.service.validate()
        
        assert result['valid'] == False
        assert 'error' in result
    
    @patch('requests.post')
    def test_validate_timeout(self, mock_post):
        """Timeout returns valid=false"""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout()
        
        result = self.service.validate()
        
        assert result['valid'] == False
    
    # ── Feature Check Tests ────────────────────────────────
    
    @patch('requests.post')
    def test_has_feature_available(self, mock_post):
        """Feature available returns True"""
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"available": True, "feature_name": "attendance_face"}
        )
        
        result = self.service.has_feature("attendance_face")
        
        assert result == True
    
    @patch('requests.post')
    def test_has_feature_not_available(self, mock_post):
        """Feature not available returns False"""
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"available": False, "feature_name": "attendance_face"}
        )
        
        result = self.service.has_feature("attendance_face")
        
        assert result == False
    
    @patch('requests.post')
    def test_has_feature_error_returns_false(self, mock_post):
        """Error on feature check returns False (deny by default)"""
        mock_post.side_effect = Exception("Network error")
        
        result = self.service.has_feature("attendance_face")
        
        assert result == False
    
    # ── Cache Tests ────────────────────────────────────────
    
    @patch('requests.post')
    def test_validate_uses_cache(self, mock_post):
        """Second call uses cache, not API"""
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"valid": True, "plan": "basic"}
        )
        
        # First call
        self.service.validate()
        
        # Second call (should use cache)
        self.service.validate()
        
        # API should be called only once
        assert mock_post.call_count == 1
    
    def test_cache_expires(self):
        """Cache expires after TTL"""
        import time
        
        # Set cache with old timestamp
        self.service._cache['validation'] = {"valid": True}
        self.service._cache_time['validation'] = time.time() - 400  # 400 seconds ago
        
        # Cache should be expired (TTL = 300)
        assert self.service._is_cached('validation', ttl=300) == False


class TestFeatureGateDecorator:
    
    @patch('services.license_service.license_service.has_feature')
    def test_decorator_allows_access(self, mock_has_feature):
        """Decorator allows access when feature available"""
        mock_has_feature.return_value = True
        
        from decorators.license import require_feature
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        
        app = FastAPI()
        
        @app.post("/test")
        @require_feature("test_feature")
        async def test_endpoint():
            return {"success": True}
        
        client = TestClient(app)
        response = client.post("/test")
        
        assert response.status_code == 200
    
    @patch('services.license_service.license_service.has_feature')
    def test_decorator_blocks_access(self, mock_has_feature):
        """Decorator blocks access when feature not available"""
        mock_has_feature.return_value = False
        
        from decorators.license import require_feature
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        
        app = FastAPI()
        
        @app.post("/test")
        @require_feature("test_feature")
        async def test_endpoint():
            return {"success": True}
        
        client = TestClient(app)
        response = client.post("/test")
        
        assert response.status_code == 403
```

---

## 4. Integration Test (Live Server)

```python
# tests/test_live_integration.py
"""
Live server integration tests
Run: pytest tests/test_live_integration.py -v
"""
import pytest
import requests
import os

BASE_URL = os.getenv('LICENSE_SERVER_URL', 'https://license.vrushaliinfotech.com')
LICENSE_KEY = os.getenv('TEST_LICENSE_KEY')

@pytest.mark.skipif(not LICENSE_KEY, reason="TEST_LICENSE_KEY not set")
class TestLiveIntegration:
    
    def test_health_check(self):
        """Server health check"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        assert response.json()['status'] == 'ok'
    
    def test_validate_license(self):
        """Validate real license key"""
        response = requests.post(
            f"{BASE_URL}/api/license/validate",
            json={"license_key": LICENSE_KEY}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'valid' in data
        
        if data['valid']:
            assert 'plan' in data
            assert 'features' in data
            assert 'days_remaining' in data
    
    def test_check_feature(self):
        """Check feature availability"""
        response = requests.post(
            f"{BASE_URL}/api/license/check-feature",
            json={
                "license_key": LICENSE_KEY,
                "feature_name": "attendance_basic"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'available' in data
    
    def test_customer_login(self):
        """Customer login with license key"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"license_key": LICENSE_KEY}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'access_token' in data
    
    def test_analytics_track(self):
        """Track analytics"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"license_key": LICENSE_KEY}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        token = login_response.json()['access_token']
        
        # Track usage
        response = requests.post(
            f"{BASE_URL}/api/analytics/track",
            json={
                "feature_name": "test_feature",
                "metadata": {"test": True}
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        assert response.json()['success'] == True
```

**Run करण्यासाठी:**
```bash
TEST_LICENSE_KEY=your-license-key pytest tests/test_live_integration.py -v
```

---

## 5. Troubleshooting

### Problem: `valid: false` येतो

```bash
# License key correct आहे का?
curl -X POST https://license.vrushaliinfotech.com/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key": "your-key"}'

# Response बघा:
# - "not_found" → Key चुकीची आहे
# - "expired" → License expire झाली
# - "blocked" → Admin ने block केली
```

### Problem: Feature check always `false`

```bash
# License valid आहे का?
# Features list मध्ये feature आहे का?
curl -X POST https://license.vrushaliinfotech.com/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key": "your-key"}' | python3 -m json.tool
```

### Problem: Analytics track होत नाही

```bash
# Token valid आहे का?
curl -X POST https://license.vrushaliinfotech.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"license_key": "your-key"}'

# Token मिळाला का? Authorization header correct आहे का?
```

### Problem: Connection timeout

```bash
# Server reachable आहे का?
ping license.vrushaliinfotech.com

# HTTPS working आहे का?
curl -I https://license.vrushaliinfotech.com/health
```

---

## 6. Test Checklist

Integration complete झाल्यावर हे verify करा:

- [ ] License validation startup वर होते
- [ ] Invalid license वर application start होत नाही
- [ ] Feature gate काम करतो (403 येतो)
- [ ] Feature available असेल तर access मिळतो
- [ ] Analytics track होतो
- [ ] Cache काम करतो (repeated calls fast आहेत)
- [ ] Network error gracefully handle होतो
- [ ] Offline grace period काम करतो

---

## Support

**API Docs:** https://license.vrushaliinfotech.com/docs  
**Support:** support@vrushaliinfotech.com
