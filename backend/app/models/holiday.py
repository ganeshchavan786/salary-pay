from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, Enum as SQLEnum, UniqueConstraint
from datetime import datetime
import uuid
import enum
from app.database import Base

class HolidayType(str, enum.Enum):
    NATIONAL = "national"
    STATE = "state"
    FESTIVAL = "festival"
    OPTIONAL = "optional"

class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    name_marathi = Column(String(100), nullable=True)
    date = Column(Date, nullable=False, unique=True)
    holiday_type = Column(SQLEnum(HolidayType), default=HolidayType.FESTIVAL)
    year = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
