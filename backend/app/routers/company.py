from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Any, Dict
from app.database import get_db
from app.models.company import Company
from app.models.user import User
from app.utils.deps import get_current_user

router = APIRouter()

@router.get("/")
async def get_company_details(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get the default company details."""
    result = await db.execute(select(Company))
    company = result.scalars().first()
    
    if not company:
        # Create a default company entry if none exists
        company = Company(name="Your Company Name")
        db.add(company)
        await db.commit()
        await db.refresh(company)
    
    return {
        "id": company.id,
        "name": company.name,
        "logo_url": company.logo_url,
        "tagline": company.tagline,
        "address": company.address,
        "phone": company.phone,
        "email": company.email,
        "website": company.website,
        "registration_no": company.registration_no,
        "gst_no": company.gst_no,
        "pan_no": company.pan_no,
        "pf_code": company.pf_code,
        "esi_code": company.esi_code,
        "tan_no": company.tan_no,
        "professional_tax_no": company.professional_tax_no,
        "bank_name": company.bank_name,
        "account_no": company.account_no,
        "ifsc_code": company.ifsc_code,
        "branch_name": company.branch_name,
        "account_type": company.account_type
    }

@router.put("/")
async def update_company_details(
    data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update company details."""
    result = await db.execute(select(Company))
    company = result.scalars().first()
    
    if not company:
        company = Company(name=data.get("name", "New Company"))
        db.add(company)
    
    for key, value in data.items():
        if hasattr(company, key):
            setattr(company, key, value)
            
    await db.commit()
    return {"message": "Company details updated successfully"}
