from sqlalchemy import Column, String, DateTime
from datetime import datetime
from app.database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    key = Column(String(50), primary_key=True)
    value = Column(String(500), nullable=True)
    category = Column(String(50), default="general") # e.g. "smtp", "general"
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
