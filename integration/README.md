# SalaryPay License Server - Integration Guide

## Overview

हा folder HRMS किंवा इतर applications मध्ये SalaryPay License Server integrate करण्यासाठी complete documentation आहे.

---

## Documents

### 1. [HRMS-INTEGRATION.md](./HRMS-INTEGRATION.md)
HRMS application मध्ये license validation integrate करण्यासाठी step-by-step guide.

**Covers:**
- License validation API
- Feature gating
- Trial/expiry handling
- Usage analytics tracking
- Error handling

### 2. [API-REFERENCE.md](./API-REFERENCE.md)
Integration साठी लागणारे API endpoints चा complete reference.

**Covers:**
- Authentication
- License validation
- Feature check
- Analytics tracking
- Error codes

### 3. [IMPLEMENTATION-EXAMPLES.md](./IMPLEMENTATION-EXAMPLES.md)
Different tech stacks साठी ready-to-use code examples.

**Covers:**
- Python (FastAPI/Flask)
- Node.js (Express)
- React (Frontend)
- .NET Core
- PHP (Laravel)

### 4. [TESTING-GUIDE.md](./TESTING-GUIDE.md)
Integration test करण्यासाठी guide.

**Covers:**
- Test license keys
- Mock responses
- Integration testing
- Troubleshooting

---

## Quick Start

### Step 1: Get License Key
Admin dashboard वरून customer साठी license generate करा.

### Step 2: Validate License
HRMS startup वेळी license validate करा:
```
POST https://license.vrushaliinfotech.com/api/license/validate
```

### Step 3: Check Features
User action वेळी feature check करा:
```
POST https://license.vrushaliinfotech.com/api/license/check-feature
```

### Step 4: Track Usage
Feature usage track करा:
```
POST https://license.vrushaliinfotech.com/api/analytics/track
```

---

## Architecture

```
HRMS Application
       ↓
License Validation Middleware
       ↓
SalaryPay License Server API
       ↓
Response: Valid/Invalid + Features
```

---

## Support

**License Server URL:** https://license.vrushaliinfotech.com  
**API Docs:** https://license.vrushaliinfotech.com/docs  
**Support Email:** support@vrushaliinfotech.com

---

## Version

**Current Version:** 1.0.0  
**Last Updated:** May 7, 2026
