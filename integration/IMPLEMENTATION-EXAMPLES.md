# Implementation Examples - Multiple Tech Stacks

## Overview

Different tech stacks साठी ready-to-use license integration code examples.

---

## 1. Python (FastAPI)

### Complete Implementation

```python
# services/license_service.py
import os
import time
import requests
from typing import Dict, Optional, List
from functools import lru_cache

class LicenseService:
    def __init__(self):
        self.server_url = os.getenv('LICENSE_SERVER_URL', 'https://license.vrushaliinfotech.com')
        self.license_key = os.getenv('LICENSE_KEY')
        self.timeout = 10
        
        # Cache
        self._cache = {}
        self._cache_time = {}
    
    def validate(self) -> Dict:
        """Validate license"""
        if self._is_cached('validation', ttl=300):
            return self._cache['validation']
        
        try:
            response = requests.post(
                f"{self.server_url}/api/license/validate",
                json={"license_key": self.license_key},
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                self._set_cache('validation', data)
                return data
            
            return {"valid": False, "error": response.text}
        
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    def has_feature(self, feature: str) -> bool:
        """Check if feature available"""
        cache_key = f'feature_{feature}'
        
        if self._is_cached(cache_key, ttl=300):
            return self._cache[cache_key]
        
        try:
            response = requests.post(
                f"{self.server_url}/api/license/check-feature",
                json={
                    "license_key": self.license_key,
                    "feature_name": feature
                },
                timeout=5
            )
            
            if response.status_code == 200:
                available = response.json().get('available', False)
                self._set_cache(cache_key, available)
                return available
        
        except Exception:
            pass
        
        return False
    
    def track(self, feature: str, metadata: Optional[Dict] = None):
        """Track usage (async)"""
        try:
            token = self._get_token()
            if not token:
                return
            
            requests.post(
                f"{self.server_url}/api/analytics/track",
                json={"feature_name": feature, "metadata": metadata or {}},
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
        except Exception:
            pass
    
    def _get_token(self) -> Optional[str]:
        """Get customer token"""
        if self._is_cached('token', ttl=3600):
            return self._cache['token']
        
        try:
            response = requests.post(
                f"{self.server_url}/api/auth/login",
                json={"license_key": self.license_key},
                timeout=5
            )
            
            if response.status_code == 200:
                token = response.json().get('access_token')
                self._set_cache('token', token)
                return token
        except Exception:
            pass
        
        return None
    
    def _is_cached(self, key: str, ttl: int) -> bool:
        if key not in self._cache:
            return False
        age = time.time() - self._cache_time.get(key, 0)
        return age < ttl
    
    def _set_cache(self, key: str, value):
        self._cache[key] = value
        self._cache_time[key] = time.time()

# Singleton
license_service = LicenseService()


# decorators/license.py
from functools import wraps
from fastapi import HTTPException
from services.license_service import license_service

def require_feature(feature: str):
    """Feature gate decorator"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not license_service.has_feature(feature):
                raise HTTPException(
                    status_code=403,
                    detail=f"Feature '{feature}' not available. Please upgrade."
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# main.py
from fastapi import FastAPI
from services.license_service import license_service
from decorators.license import require_feature
import sys

app = FastAPI()

@app.on_event("startup")
async def startup():
    """Validate license on startup"""
    result = license_service.validate()
    
    if not result.get('valid'):
        print(f"❌ License invalid: {result.get('error')}")
        sys.exit(1)
    
    print(f"✅ License valid - Plan: {result.get('plan')}")

@app.post("/api/attendance/mark-face")
@require_feature("attendance_face")
async def mark_face_attendance(data: dict):
    """Face recognition attendance"""
    # Business logic
    result = process_attendance(data)
    
    # Track usage
    license_service.track("attendance_face", {"employee_id": data.get('employee_id')})
    
    return result
```

---

## 2. Node.js (Express)

### Complete Implementation

```javascript
// services/licenseService.js
const axios = require('axios');

class LicenseService {
  constructor() {
    this.serverUrl = process.env.LICENSE_SERVER_URL || 'https://license.vrushaliinfotech.com';
    this.licenseKey = process.env.LICENSE_KEY;
    this.cache = new Map();
    this.cacheTime = new Map();
  }

  async validate() {
    const cacheKey = 'validation';
    
    if (this._isCached(cacheKey, 300)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await axios.post(
        `${this.serverUrl}/api/license/validate`,
        { license_key: this.licenseKey },
        { timeout: 10000 }
      );

      const data = response.data;
      this._setCache(cacheKey, data);
      return data;
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async hasFeature(feature) {
    const cacheKey = `feature_${feature}`;
    
    if (this._isCached(cacheKey, 300)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await axios.post(
        `${this.serverUrl}/api/license/check-feature`,
        {
          license_key: this.licenseKey,
          feature_name: feature
        },
        { timeout: 5000 }
      );

      const available = response.data.available || false;
      this._setCache(cacheKey, available);
      return available;
    } catch (error) {
      return false;
    }
  }

  async track(feature, metadata = {}) {
    try {
      const token = await this._getToken();
      if (!token) return;

      await axios.post(
        `${this.serverUrl}/api/analytics/track`,
        {
          feature_name: feature,
          metadata: metadata
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        }
      );
    } catch (error) {
      // Silent fail
    }
  }

  async _getToken() {
    const cacheKey = 'token';
    
    if (this._isCached(cacheKey, 3600)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await axios.post(
        `${this.serverUrl}/api/auth/login`,
        { license_key: this.licenseKey },
        { timeout: 5000 }
      );

      const token = response.data.access_token;
      this._setCache(cacheKey, token);
      return token;
    } catch (error) {
      return null;
    }
  }

  _isCached(key, ttl) {
    if (!this.cache.has(key)) return false;
    const age = (Date.now() - this.cacheTime.get(key)) / 1000;
    return age < ttl;
  }

  _setCache(key, value) {
    this.cache.set(key, value);
    this.cacheTime.set(key, Date.now());
  }
}

module.exports = new LicenseService();


// middleware/licenseMiddleware.js
const licenseService = require('../services/licenseService');

const requireFeature = (feature) => {
  return async (req, res, next) => {
    const hasFeature = await licenseService.hasFeature(feature);
    
    if (!hasFeature) {
      return res.status(403).json({
        error: `Feature '${feature}' not available. Please upgrade.`
      });
    }
    
    next();
  };
};

module.exports = { requireFeature };


// app.js
const express = require('express');
const licenseService = require('./services/licenseService');
const { requireFeature } = require('./middleware/licenseMiddleware');

const app = express();

// Startup validation
app.listen(3000, async () => {
  console.log('🔐 Validating license...');
  
  const result = await licenseService.validate();
  
  if (!result.valid) {
    console.error(`❌ License invalid: ${result.error}`);
    process.exit(1);
  }
  
  console.log(`✅ License valid - Plan: ${result.plan}`);
  console.log('Server running on port 3000');
});

// Protected route
app.post('/api/attendance/mark-face', requireFeature('attendance_face'), async (req, res) => {
  // Business logic
  const result = await processAttendance(req.body);
  
  // Track usage
  licenseService.track('attendance_face', {
    employee_id: req.body.employee_id
  });
  
  res.json(result);
});
```

---

## 3. React (Frontend)

### Complete Implementation

```javascript
// services/licenseApi.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const licenseApi = {
  async getStatus() {
    const response = await axios.get(`${API_URL}/api/license/status`);
    return response.data;
  },

  async hasFeature(feature) {
    const response = await axios.post(`${API_URL}/api/license/check-feature`, {
      feature_name: feature
    });
    return response.data.available;
  }
};


// context/LicenseContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { licenseApi } from '../services/licenseApi';

const LicenseContext = createContext();

export const LicenseProvider = ({ children }) => {
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLicense();
  }, []);

  const loadLicense = async () => {
    try {
      const data = await licenseApi.getStatus();
      setLicense(data);
    } catch (error) {
      console.error('License load failed:', error);
      setLicense({ valid: false });
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (feature) => {
    if (!license || !license.valid) return false;
    return license.features?.includes(feature) || false;
  };

  return (
    <LicenseContext.Provider value={{ license, loading, hasFeature }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => useContext(LicenseContext);


// components/FeatureGate.jsx
import React from 'react';
import { useLicense } from '../context/LicenseContext';
import { Alert, Button } from '@mui/material';

export const FeatureGate = ({ feature, children, fallback }) => {
  const { hasFeature, license } = useLicense();

  if (!hasFeature(feature)) {
    return fallback || (
      <Alert severity="warning">
        This feature is not available in your {license?.plan} plan.
        <Button href="/upgrade" variant="contained" sx={{ ml: 2 }}>
          Upgrade Now
        </Button>
      </Alert>
    );
  }

  return children;
};


// App.jsx
import React from 'react';
import { LicenseProvider } from './context/LicenseContext';
import { FeatureGate } from './components/FeatureGate';
import FaceAttendance from './pages/FaceAttendance';

function App() {
  return (
    <LicenseProvider>
      <div className="App">
        <FeatureGate feature="attendance_face">
          <FaceAttendance />
        </FeatureGate>
      </div>
    </LicenseProvider>
  );
}

export default App;
```

---

## 4. .NET Core (C#)

### Complete Implementation

```csharp
// Services/LicenseService.cs
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;

public class LicenseService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly IMemoryCache _cache;
    private readonly string _serverUrl;
    private readonly string _licenseKey;

    public LicenseService(HttpClient httpClient, IConfiguration config, IMemoryCache cache)
    {
        _httpClient = httpClient;
        _config = config;
        _cache = cache;
        _serverUrl = _config["License:ServerUrl"];
        _licenseKey = _config["License:Key"];
    }

    public async Task<LicenseValidationResult> ValidateAsync()
    {
        var cacheKey = "license_validation";
        
        if (_cache.TryGetValue(cacheKey, out LicenseValidationResult cached))
        {
            return cached;
        }

        try
        {
            var request = new { license_key = _licenseKey };
            var content = new StringContent(
                JsonSerializer.Serialize(request),
                Encoding.UTF8,
                "application/json"
            );

            var response = await _httpClient.PostAsync(
                $"{_serverUrl}/api/license/validate",
                content
            );

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<LicenseValidationResult>(json);
                
                _cache.Set(cacheKey, result, TimeSpan.FromMinutes(5));
                return result;
            }

            return new LicenseValidationResult { Valid = false };
        }
        catch (Exception ex)
        {
            return new LicenseValidationResult { Valid = false, Error = ex.Message };
        }
    }

    public async Task<bool> HasFeatureAsync(string feature)
    {
        var cacheKey = $"feature_{feature}";
        
        if (_cache.TryGetValue(cacheKey, out bool cached))
        {
            return cached;
        }

        try
        {
            var request = new { license_key = _licenseKey, feature_name = feature };
            var content = new StringContent(
                JsonSerializer.Serialize(request),
                Encoding.UTF8,
                "application/json"
            );

            var response = await _httpClient.PostAsync(
                $"{_serverUrl}/api/license/check-feature",
                content
            );

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<FeatureCheckResult>(json);
                var available = result.Available;
                
                _cache.Set(cacheKey, available, TimeSpan.FromMinutes(5));
                return available;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }
}

public class LicenseValidationResult
{
    public bool Valid { get; set; }
    public string Plan { get; set; }
    public List<string> Features { get; set; }
    public string Error { get; set; }
}

public class FeatureCheckResult
{
    public bool Available { get; set; }
}


// Middleware/LicenseMiddleware.cs
using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

public class LicenseMiddleware
{
    private readonly RequestDelegate _next;

    public LicenseMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, LicenseService licenseService)
    {
        var path = context.Request.Path.Value;
        
        // Feature mapping
        var featureMap = new Dictionary<string, string>
        {
            { "/api/attendance/mark-face", "attendance_face" },
            { "/api/salary/process", "salary_full" }
        };

        if (featureMap.ContainsKey(path))
        {
            var feature = featureMap[path];
            var hasFeature = await licenseService.HasFeatureAsync(feature);
            
            if (!hasFeature)
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = $"Feature '{feature}' not available. Please upgrade."
                });
                return;
            }
        }

        await _next(context);
    }
}


// Startup.cs
public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddHttpClient<LicenseService>();
        services.AddMemoryCache();
        services.AddControllers();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        // Validate license on startup
        var licenseService = app.ApplicationServices.GetRequiredService<LicenseService>();
        var result = licenseService.ValidateAsync().Result;
        
        if (!result.Valid)
        {
            throw new Exception($"License invalid: {result.Error}");
        }

        app.UseMiddleware<LicenseMiddleware>();
        app.UseRouting();
        app.UseEndpoints(endpoints => endpoints.MapControllers());
    }
}


// appsettings.json
{
  "License": {
    "ServerUrl": "https://license.vrushaliinfotech.com",
    "Key": "your-license-key-here"
  }
}
```

---

## 5. PHP (Laravel)

### Complete Implementation

```php
<?php
// app/Services/LicenseService.php
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class LicenseService
{
    private $serverUrl;
    private $licenseKey;

    public function __construct()
    {
        $this->serverUrl = config('license.server_url');
        $this->licenseKey = config('license.key');
    }

    public function validate(): array
    {
        $cacheKey = 'license_validation';
        
        return Cache::remember($cacheKey, 300, function () {
            try {
                $response = Http::timeout(10)->post(
                    "{$this->serverUrl}/api/license/validate",
                    ['license_key' => $this->licenseKey]
                );

                if ($response->successful()) {
                    return $response->json();
                }

                return ['valid' => false, 'error' => $response->body()];
            } catch (\Exception $e) {
                return ['valid' => false, 'error' => $e->getMessage()];
            }
        });
    }

    public function hasFeature(string $feature): bool
    {
        $cacheKey = "feature_{$feature}";
        
        return Cache::remember($cacheKey, 300, function () use ($feature) {
            try {
                $response = Http::timeout(5)->post(
                    "{$this->serverUrl}/api/license/check-feature",
                    [
                        'license_key' => $this->licenseKey,
                        'feature_name' => $feature
                    ]
                );

                if ($response->successful()) {
                    return $response->json()['available'] ?? false;
                }

                return false;
            } catch (\Exception $e) {
                return false;
            }
        });
    }

    public function track(string $feature, array $metadata = []): void
    {
        try {
            $token = $this->getToken();
            if (!$token) return;

            Http::timeout(5)
                ->withToken($token)
                ->post("{$this->serverUrl}/api/analytics/track", [
                    'feature_name' => $feature,
                    'metadata' => $metadata
                ]);
        } catch (\Exception $e) {
            // Silent fail
        }
    }

    private function getToken(): ?string
    {
        return Cache::remember('license_token', 3600, function () {
            try {
                $response = Http::timeout(5)->post(
                    "{$this->serverUrl}/api/auth/login",
                    ['license_key' => $this->licenseKey]
                );

                if ($response->successful()) {
                    return $response->json()['access_token'] ?? null;
                }

                return null;
            } catch (\Exception $e) {
                return null;
            }
        });
    }
}


// app/Http/Middleware/RequireFeature.php
namespace App\Http\Middleware;

use Closure;
use App\Services\LicenseService;

class RequireFeature
{
    private $licenseService;

    public function __construct(LicenseService $licenseService)
    {
        $this->licenseService = $licenseService;
    }

    public function handle($request, Closure $next, string $feature)
    {
        if (!$this->licenseService->hasFeature($feature)) {
            return response()->json([
                'error' => "Feature '{$feature}' not available. Please upgrade."
            ], 403);
        }

        return $next($request);
    }
}


// app/Providers/AppServiceProvider.php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\LicenseService;

class AppServiceProvider extends ServiceProvider
{
    public function boot()
    {
        // Validate license on startup
        $licenseService = app(LicenseService::class);
        $result = $licenseService->validate();

        if (!$result['valid']) {
            throw new \Exception("License invalid: " . ($result['error'] ?? 'Unknown'));
        }

        echo "✅ License valid - Plan: {$result['plan']}\n";
    }
}


// routes/api.php
use App\Http\Middleware\RequireFeature;

Route::post('/attendance/mark-face', function () {
    // Business logic
    return response()->json(['success' => true]);
})->middleware(RequireFeature::class . ':attendance_face');


// config/license.php
return [
    'server_url' => env('LICENSE_SERVER_URL', 'https://license.vrushaliinfotech.com'),
    'key' => env('LICENSE_KEY'),
];


// .env
LICENSE_SERVER_URL=https://license.vrushaliinfotech.com
LICENSE_KEY=your-license-key-here
```

---

## Summary

सर्व implementations मध्ये common pattern:

1. **Startup Validation** - Application start होताना license validate करा
2. **Feature Gating** - Middleware/decorator ने features protect करा
3. **Caching** - Responses cache करा (5-10 minutes)
4. **Error Handling** - Network errors gracefully handle करा
5. **Analytics** - Usage tracking async करा

Choose your tech stack आणि copy-paste करा! 🚀
