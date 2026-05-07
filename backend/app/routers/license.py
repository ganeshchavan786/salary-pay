from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
from datetime import datetime

router = APIRouter(tags=["License Activation"])

class ActivateRequest(BaseModel):
    license_key: str

# WHY: To handle the final step of the activation process from the UI.
# WHERE: Called by landing.html (Auto-Activation) when a trial key is received.
# WHAT: It saves the license key locally into 'license.json' so the backend can use it for validation.
@router.post("/activate")
async def activate_license(req: ActivateRequest):
    try:
        # बॅकएंडच्या रूट फोल्डरमध्ये फाईल सेव्ह होईल
        LICENSE_FILE = "license.json"
        
        license_data = {
            "license_key": req.license_key,
            "status": "activated"
        }
        
        # फाईल राईट करा
        with open(LICENSE_FILE, "w") as f:
            json.dump(license_data, f, indent=4)
            
        return {
            "status": "success", 
            "message": "License key saved automatically. Please restart the application."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to activate license: {str(e)}")

@router.get("/machine-id")
async def get_machine_id_api():
    """फ्रंटएंडला मशीन आयडी दाखवण्यासाठी"""
    import uuid
    return {"machine_id": str(uuid.getnode())}

# WHY: Provides real-time license status to the Admin Panel.
# WHERE: Called by Admin Panel Sidebar to display "Days Remaining" and "Plan Type".
# WHAT: It cross-checks the local license with the server and provides plan details, 
# ensuring the admin knows when to renew.
@router.get("/info")
async def get_license_info():
    from app.license_check import (
        is_license_valid, get_machine_id, get_cache_paths, 
        STATE_NORMAL, STATE_READ_ONLY, STATE_BLOCKED
    )
    import httpx
    
    # 1. Get current status
    status, reason = is_license_valid()
    
    # 2. Get license key from file
    LICENSE_FILE = "license.json"
    license_key = "NOT_FOUND"
    if os.path.exists(LICENSE_FILE):
        try:
            with open(LICENSE_FILE, 'r') as f:
                data = json.load(f)
                license_key = data.get("license_key", "NOT_FOUND")
        except:
            pass

    # 3. Try to get details from cache
    plan = "unknown"
    customer_id = None
    days_remaining = 0
    mode = "offline" if status == STATE_NORMAL and "Offline" in reason else "online"
    
    for path in get_cache_paths():
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    cache = json.load(f)
                    plan = cache.get("plan", plan)
                    customer_id = cache.get("customer_id")
                    # Simple calculation for days remaining if valid_till exists
                    if cache.get("valid_till"):
                        vt = datetime.fromisoformat(cache["valid_till"].replace("Z", "+00:00"))
                        days_remaining = (vt - datetime.now(vt.tzinfo)).days
                    break
            except:
                continue

    return {
        "status": status,
        "reason": reason,
        "plan": plan,
        "customer_id": customer_id,
        "days_remaining": days_remaining,
        "mode": mode,
        "machine_id": get_machine_id(),
        "license_key_masked": license_key[:4] + "****" + license_key[-4:] if len(license_key) > 8 else "****"
    }
