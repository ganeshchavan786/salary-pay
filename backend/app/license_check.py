import os
import json
import uuid
import httpx
from datetime import datetime, timedelta

# तुमच्या लायसन्स सर्व्हरचा पत्ता
LICENSE_SERVER_URL = "http://localhost:8661/api"
LICENSE_FILE = "license.json"
CACHE_FILE = "license_cache.json"
GRACE_PERIOD_DAYS = 5  # इंटरनेट नसल्यास किती दिवस ॲप चालेल

def get_machine_id():
    """तुमच्या कॉम्प्युटरचा एक युनिक आयडी काढतो"""
    return str(uuid.getnode())

# WHY: This function is the core engine for license enforcement.
# WHERE: Called by license_check_middleware in main.py for every restricted API call.
# WHAT: 1. It attempts to validate the license online with the License Server.
#       2. If successful, it updates a local encrypted cache (CACHE_FILE).
#       3. If offline, it allows the app to run for a 5-day grace period using the cache.
#       4. It ensures the license is tied to the unique hardware ID (machine_id).
def is_license_valid():
    machine_id = get_machine_id()
    
    if not os.path.exists(LICENSE_FILE):
        return False, "License file not found"
        
    license_key = None
    try:
        with open(LICENSE_FILE, 'r') as f:
            data = json.load(f)
            license_key = data.get("license_key")
    except:
        return False, "Error reading license file"

    # १. आधी ऑनलाईन चेक करण्याचा प्रयत्न करा
    try:
        response = httpx.post(
            f"{LICENSE_SERVER_URL}/license/validate",
            json={"machine_id": machine_id, "license_key": license_key},
            timeout=3.0 # लवकर टाईमआऊट द्या जेणेकरून ऑफलाईन युजरला जास्त वेळ वाट पाहावी लागणार नाही
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("valid"):
                # ऑनलाईन चेक यशस्वी! आता कॅश अपडेट करा.
                save_license_cache(result)
                return True, "Valid (Online)"
            else:
                return False, result.get("reason", "Invalid license")
                
    except (httpx.ConnectError, httpx.TimeoutException):
        # २. जर इंटरनेट नसेल, तर ऑफलाईन कॅश तपासा
        return check_offline_cache()
    except Exception as e:
        return False, f"System Error: {str(e)}"
    
    return False, "License validation failed"

def save_license_cache(result):
    """ऑनलाईन निकाल लोकल फाईलमध्ये सेव्ह करतो"""
    cache_data = {
        "last_check": datetime.now().isoformat(),
        "valid_till": result.get("valid_till"),
        "plan": result.get("plan")
    }
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache_data, f)

def check_offline_cache():
    """इंटरनेट नसताना लोकल कॅशवरून परमिशन देतो"""
    if not os.path.exists(CACHE_FILE):
        return False, "Internet required for first-time activation"
        
    try:
        with open(CACHE_FILE, 'r') as f:
            cache = json.load(f)
            
        last_check = datetime.fromisoformat(cache["last_check"])
        grace_expiry = last_check + timedelta(days=GRACE_PERIOD_DAYS)
        
        if datetime.now() < grace_expiry:
            # ५ दिवसांच्या आत आहे, म्हणून परवानगी द्या
            days_left = (grace_expiry - datetime.now()).days
            print(f"⚠️ App running in OFFLINE mode. {days_left} days left before internet is required.")
            return True, f"Offline Mode ({days_left} days left)"
        else:
            return False, "Grace period expired. Please connect to internet."
            
    except:
        return False, "License cache corrupted. Connect to internet."
