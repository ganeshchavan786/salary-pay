# SalaryPay HRMS - License Integration Report

हे डॉक्युमेंट SalaryPay HRMS मध्ये केलेल्या लायसन्स सिस्टिम एकत्रीकरणाची (Integration) सविस्तर माहिती देते.

## १. उद्देश (Objective)
सॉफ्टवेअरची सुरक्षितता वाढवणे आणि "Zero-Touch" ऑटोमॅटिक ॲक्टिव्हेशन सिस्टिम लागू करणे. यामध्ये ७ दिवसांचा ट्रायल आणि ऑनलाईन रिन्यूअलची सोय करण्यात आली आहे.

---

## २. बॅकएंडमधील बदल (Backend Changes)

### अ. `main.py` (Middleware)
*   **काय बदलले:** एक नवीन HTTP Middleware जोडले आहे.
*   **का:** सर्व API विनंत्या तपासून पाहण्यासाठी की लायसन्स व्हॅलिड आहे का. जर नसेल, तर हे Middleware `402 Payment Required` एरर देते, ज्यामुळे ॲप ब्लॉक होते.

### ब. `app/license_check.py` (Core Logic)
*   **काय बदलले:** लायसन्स व्हॅलिडेशन आणि 'Offline Support' लॉजिक जोडले.
*   **का:** 
    *   `machine_id` वापरून सॉफ्टवेअरला विशिष्ट कॉम्प्युटरशी लॉक केले.
    *   `Offline Grace Period`: जर युजरचे इंटरनेट बंद असेल, तर ॲप पुढचे ५ दिवस विना-इंटरनेट सुरू राहील (कॅश फाईल `license_cache.json` द्वारे).

### क. `app/routers/license.py`
*   **काय बदलले:** `/api/v1/license/info` हा नवीन एंडपॉईंट जोडला.
*   **का:** ऍडमिन पॅनलला लायसन्सचे स्टेटस (Trial, Expiry, Days left) दाखवण्यासाठी.

---

## ३. फ्रंटएंडमधील बदल (Frontend Changes)

### अ. `landing.html` (Auto-Activation)
*   **काय बदलले:** लायसन्स ॲक्टिव्हेशन मोडल (Popup) जोडले.
*   **का:** नवीन युजरने "Get Started" वर क्लिक केल्यावर त्याचे मशीन आयडी आपोआप घेऊन त्याला ७ दिवसांचा ट्रायल देण्यासाठी.

### ब. `admin-panel/src/components/Layout.jsx` (Status Badge)
*   **काय बदलले:** साइडबारमध्ये 'License Status' कार्ड जोडले.
*   **का:** युजरला त्याचे किती दिवस शिल्लक आहेत हे कळावे आणि संपत आल्यावर "Renew Now" बटण दाखवण्यासाठी.

### क. `admin-panel/src/services/api.js` (Auto-Redirect)
*   **काय बदलले:** Axios Interceptor मध्ये ४०२ एरर हँडलिंग जोडले.
*   **का:** जर ॲप वापरताना लायसन्स संपले, तर युजरला आपोआप लँडिंग पेजवर रिडायरेक्ट करण्यासाठी.

---

## ४. लायसन्स सर्व्हर (License Server)
*   **Port:** `8661`
*   **Features:**
    *   **Registration API:** नवीन युजरची नोंदणी आणि ट्रायल देणे.
    *   **Validation API:** लायसन्सची तारीख आणि मशीन आयडी तपासणे.
    *   **Razorpay Integration:** `/checkout` पेजद्वारे युजरला १ वर्षाचे सबस्क्रिप्शन विकत घेण्याची सोय.

---

## ५. महत्त्वाच्या फाईल्स (New Files Created)
1. `backend/license.json`: युजरची लायसन्स की सेव्ह करण्यासाठी.
2. `backend/license_cache.json`: ऑफलाईन वापरासाठी निकालाची प्रत (Cache) ठेवण्यासाठी.
