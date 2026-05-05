from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os

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
    from app.license_check import is_license_valid, get_machine_id, CACHE_FILE
    import httpx
    
    LICENSE_FILE = "license.json"
    if not os.path.exists(LICENSE_FILE):
        return {"active": False, "message": "No license found"}
        
    try:
        with open(LICENSE_FILE, 'r') as f:
            data = json.load(f)
            license_key = data.get("license_key")
            
        from app.license_check import LICENSE_SERVER_URL
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{LICENSE_SERVER_URL}/license/validate",
                    json={"machine_id": get_machine_id(), "license_key": license_key},
                    timeout=2.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "active": result.get("valid"),
                        "plan": result.get("plan"),
                        "days_remaining": result.get("days_remaining"),
                        "valid_till": result.get("valid_till"),
                        "mode": "online",
                        "license_key": license_key[:4] + "****" + license_key[-4:]
                    }
            except (httpx.ConnectError, httpx.TimeoutException):
                # इंटरनेट नाही, कॅशमधून माहिती घ्या
                if os.path.exists(CACHE_FILE):
                    with open(CACHE_FILE, 'r') as f:
                        cache = json.load(f)
                    return {
                        "active": True,
                        "plan": cache.get("plan"),
                        "mode": "offline",
                        "message": "Running in offline mode",
                        "license_key": license_key[:4] + "****" + license_key[-4:]
                    }
    except Exception as e:
        return {"active": False, "error": str(e)}
    
    return {"active": False}
