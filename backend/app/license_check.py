import os
import json
import uuid
import httpx
from datetime import datetime, timedelta
from pathlib import Path

# LICENSE CONFIG
LICENSE_SERVER_URL = "https://license.vrushaliinfotech.com/api"
LICENSE_FILE = "license.json"

# CACHE PATHS (Windows paths as requested)
def get_cache_paths():
    app_data_roaming = os.getenv('APPDATA') # AppData/Roaming
    app_data_local = os.getenv('LOCALAPPDATA') # AppData/Local
    
    paths = []
    if app_data_roaming:
        p = Path(app_data_roaming) / "SalaryPay" / "license_cache.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        paths.append(str(p))
    if app_data_local:
        p = Path(app_data_local) / "SalaryPay" / "license_cache.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        paths.append(str(p))
        
    # Fallback to current dir if environment variables fail
    if not paths:
        paths.append("license_cache.json")
    return paths

def get_machine_id():
    """Uniquely identifies this machine"""
    return str(uuid.getnode())

# STATES
STATE_NORMAL = "NORMAL"
STATE_READ_ONLY = "READ_ONLY"
STATE_BLOCKED = "BLOCKED"

def is_license_valid():
    """
    Core Logic:
    1. Online Check -> Valid? NORMAL. Invalid? BLOCKED.
    2. Unreachable? -> Check Cache.
       - No Cache? READ_ONLY.
       - Valid Cache? NORMAL.
       - Expired Cache? READ_ONLY.
    """
    machine_id = get_machine_id()
    
    # 0. Check if license key exists
    if not os.path.exists(LICENSE_FILE):
        return STATE_READ_ONLY, "License key not found. Please activate."
        
    license_key = None
    try:
        with open(LICENSE_FILE, 'r') as f:
            data = json.load(f)
            license_key = data.get("license_key")
    except:
        return STATE_READ_ONLY, "Error reading license file."

    # 1. Try Online Validation
    try:
        # Use a short timeout to not block app startup too long
        response = httpx.post(
            f"{LICENSE_SERVER_URL}/license/validate",
            json={"machine_id": machine_id, "license_key": license_key},
            timeout=5.0
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("valid"):
                # SERVER SAYS VALID -> Update Cache and return NORMAL
                save_license_cache(result, license_key)
                return STATE_NORMAL, "Validated Online"
            else:
                # SERVER SAYS EXPLICITLY INVALID -> BLOCKED
                return STATE_BLOCKED, result.get("message", "License expired or blocked.")
        
    except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPError):
        # SERVER UNREACHABLE (No Internet) -> Fallback to Cache
        return check_cache_fallback()
    except Exception as e:
        print(f"License Error: {str(e)}")
        return STATE_READ_ONLY, "System Error. Running in Read-Only mode."
    
    return STATE_READ_ONLY, "Unknown connection status."

def save_license_cache(result, license_key):
    """Saves encrypted cache provided by server to 2 locations"""
    cache_data = {
        "license_key": license_key,
        "customer_id": result.get("customer_id"),
        "plan": result.get("plan"),
        "features": result.get("features", []),
        "valid_till": result.get("valid_till"),
        "grace_period_days": result.get("grace_period_days", 5),
        "last_online": datetime.now().isoformat(),
        "encrypted_cache": result.get("encrypted_cache") # Server provided encrypted string
    }
    
    for path in get_cache_paths():
        try:
            with open(path, 'w') as f:
                json.dump(cache_data, f, indent=4)
        except Exception as e:
            print(f"Failed to save cache to {path}: {e}")

def check_cache_fallback():
    """Fallback logic when internet is missing"""
    cache = None
    
    # Try reading from any available cache path
    for path in get_cache_paths():
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    cache = json.load(f)
                break # Use the first successful read
            except:
                continue
                
    if not cache:
        return STATE_READ_ONLY, "No internet and no cache found."

    try:
        last_online = datetime.fromisoformat(cache["last_online"])
        grace_days = cache.get("grace_period_days", 5)
        grace_expiry = last_online + timedelta(days=grace_days)
        
        if datetime.now() < grace_expiry:
            # Within Grace Period -> NORMAL (but with a warning in logs)
            days_left = (grace_expiry - datetime.now()).days
            print(f"OFFLINE: License valid via cache. {days_left} days remaining in grace period.")
            return STATE_NORMAL, f"Offline Mode ({days_left} days left)"
        else:
            # Grace Period Expired -> READ_ONLY
            return STATE_READ_ONLY, "Grace period expired. Internet connection required."
            
    except Exception as e:
        print(f"Cache check error: {e}")
        return STATE_READ_ONLY, "Cache corrupted. Internet connection required."
