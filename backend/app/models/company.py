from sqlalchemy import Column, String, Text, DateTime
from app.database import Base
from datetime import datetime
import uuid

class Company(Base):
    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Basic Info
    name = Column(String(255), nullable=False)
    logo_url = Column(Text, nullable=True)
    tagline = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)

    # Legal & Statutory
    registration_no = Column(String(100), nullable=True) # CIN/Registration
    gst_no = Column(String(20), nullable=True)
    pan_no = Column(String(20), nullable=True)
    pf_code = Column(String(50), nullable=True)
    esi_code = Column(String(50), nullable=True)
    tan_no = Column(String(20), nullable=True)
    professional_tax_no = Column(String(50), nullable=True)

    # Bank Details
    bank_name = Column(String(255), nullable=True)
    account_no = Column(String(50), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    branch_name = Column(String(255), nullable=True)
    account_type = Column(String(50), nullable=True, default="Current") # Current/Savings

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
