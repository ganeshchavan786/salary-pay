import asyncio
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.company import Company

async def test():
    print("--- TESTING COMPANY DATABASE CONNECTION ---")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Company))
            company = result.scalars().first()
            
            if company:
                print(f"SUCCESS: Found Company in Database.\n")
                # Filter out internal SQLAlchemy attributes
                data = {k: v for k, v in vars(company).items() if not k.startswith('_')}
                for key, value in data.items():
                    print(f"{key.upper()}: {value}")
            else:
                print("INFO: Database connection works, but no company data found yet.")
                print("Please save details from the Admin Panel first.")
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test())
