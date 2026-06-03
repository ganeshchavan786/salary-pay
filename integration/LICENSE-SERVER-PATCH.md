# License Server Patch - Machine ID Lock Security

This document outlines the database changes and Python FastAPI route modifications required on the **License Server** (`license.vrushaliinfotech.com`) to restrict duplicate registrations on the same machine/VPS.

---

## 1. Database Schema Update (PostgreSQL)

To enforce that a physical computer/VPS cannot be registered under multiple customer accounts, run the following SQL migration on the License Server database:

```sql
-- Add a unique constraint on the machine_id column in the customers table
ALTER TABLE customers ADD CONSTRAINT unique_machine_id UNIQUE (machine_id);
```

---

## 2. API Router Update (FastAPI - `auth.py`)

Modify the registration endpoint (`POST /auth/register` or `/api/auth/register`) to check for existing machine IDs before creating a customer record.

### Path: `license-server/app/routers/auth.py`

Replace or update your registration endpoint with the logic below:

```python
from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.customer import Customer  # Or your corresponding model
from app.schemas.customer import CustomerRegisterSchema  # Or your schema

# ... (Existing imports and router setup)

@router.post("/register")
async def register_customer(payload: CustomerRegisterSchema, db: AsyncSession):
    # ── SECURITY CHECK: Machine ID Lock ──
    # Check if a customer with the same machine_id has already registered
    existing_machine = await db.execute(
        select(Customer).where(Customer.machine_id == payload.machine_id)
    )
    if existing_machine.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This computer/VPS is already registered under another account. Please contact support or login to your existing account."
        )

    # ── SECURITY CHECK: Email Check ──
    existing_email = await db.execute(
        select(Customer).where(Customer.email == payload.email)
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already registered."
        )

    # ── Proceed with new customer registration ──
    # ... (Your existing registration key generation logic)
    
    new_customer = Customer(
        business_name=payload.business_name,
        owner_name=payload.owner_name,
        email=payload.email,
        phone=payload.phone,
        machine_id=payload.machine_id,
        # ... other fields
    )
    # ... save and generate JWT license_key
    
    return {
        "status": "success",
        "customer_id": new_customer.id,
        "license_key": generated_license_key
    }
```

---

## 3. Client Side Compatibility Check

When a client attempts to register an already-registered machine, the License Server returns `400 Bad Request` with:
`{"detail": "This computer/VPS is already registered under another account. Please contact support."}`

The client landing page (`landing.html`) catches this error automatically and alerts:
`⚠️ Registration failed: This computer/VPS is already registered under another account. Please contact support.`

No modifications are required on the client side, ensuring zero risks of breaking customer deployments.
