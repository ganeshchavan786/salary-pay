# VPS Deployment Guide - SalaryPay License System

जेव्हा तुम्ही लायसन्स सर्व्हर VPS वर आणि तुमच्या स्वतःच्या डोमेनवर होस्ट कराल, तेव्हा खालील बदल करा:

## १. HRMS Backend (Salary App)
**फाईल:** `backend/app/license_check.py`
खालील ओळ तुमच्या नवीन डोमेनसह अपडेट करा:
```python
LICENSE_SERVER_URL = "https://your-license-domain.com/api"
```

## २. HRMS Admin UI
**फाईल:** `admin-panel/src/components/Layout.jsx`
साइडबारमधील "Renew" बटणाची लिंक अपडेट करा:
```javascript
// 'Renew' बटन शोधून ही ओळ बदला:
window.open(`https://your-license-domain.com/checkout?key=${license.license_key}`, '_blank')
```
*बदल केल्यावर `npm run build` करणे विसरू नका.*

## ३. License Server Configuration
**फाईल:** `license-server/.env`
खालील गोष्टी अपडेट करा:
1. **CORS:** `ALLOWED_ORIGINS` मध्ये तुमच्या सॅलरी ॲपचा डोमेन टाका.
2. **Security:** `SECRET_KEY` आणि `LICENSE_ENCRYPTION_KEY` बदलून मजबूत पासवर्ड टाका.
3. **Database:** जर जास्त ट्रॅफिक असेल, तर SQLite ऐवजी PostgreSQL वापरणे चांगले (पर्यायी).

## ४. VPS वरील स्टेप्स (Linux/Ubuntu)
1. लायसन्स सर्व्हरच्या `frontend` फोल्डरमध्ये जाऊन `npm run build` करा.
2. बॅकएंड सुरू करण्यासाठी `Gunicorn` किंवा `Uvicorn` चा वापर करा.
3. डोमेन मॅनेजमेंटसाठी **Nginx** किंवा **Apache** कॉन्फिगर करा.
4. **SSL (HTTPS)** साठी `Certbot` वापरून मोफत सर्टिफिकेट मिळवा.

---
**टीप:** नेहमी `https://` चा वापर करा जेणेकरून डेटा ट्रान्सफर सुरक्षित राहील.
