from sqlalchemy import Column, String, DateTime, Integer, Numeric, ForeignKey, JSON, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class SalaryCalculationStatus(str, enum.Enum):
    DRAFT = "draft"
    CALCULATED = "calculated"
    APPROVED = "approved"
    PAID = "paid"
    CANCELLED = "cancelled"

class SalaryCalculation(Base):
    __tablename__ = "salary_calculations"
    __table_args__ = (
        UniqueConstraint("employee_id", "period_id", "calculation_version", name="uq_salary_calc_emp_period_ver"),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    period_id = Column(String(36), ForeignKey("payroll_periods.id"), nullable=False)
    calculation_version = Column(Integer, default=1)
    # Attendance
    total_days = Column(Integer, default=0)
    working_days = Column(Integer, default=0)
    present_days = Column(Integer, default=0)
    absent_days = Column(Integer, default=0)
    leave_days = Column(Integer, default=0)
    overtime_hours = Column(Numeric(5, 2), default=0)
    # Earnings
    basic_salary = Column(Numeric(12, 2), default=0)
    hra = Column(Numeric(12, 2), default=0)
    special_allowance = Column(Numeric(12, 2), default=0)
    travel_allowance = Column(Numeric(12, 2), default=0)
    medical_allowance = Column(Numeric(12, 2), default=0)
    overtime_amount = Column(Numeric(12, 2), default=0)
    arrears_amount = Column(Numeric(12, 2), default=0)
    other_earnings = Column(Numeric(12, 2), default=0)
    gross_salary = Column(Numeric(12, 2), default=0)
    # Deductions
    pf_employee = Column(Numeric(12, 2), default=0)
    pf_employer = Column(Numeric(12, 2), default=0)
    esi_employee = Column(Numeric(12, 2), default=0)
    esi_employer = Column(Numeric(12, 2), default=0)
    professional_tax = Column(Numeric(12, 2), default=0)
    income_tax = Column(Numeric(12, 2), default=0)
    loan_deductions = Column(Numeric(12, 2), default=0)
    advance_deductions = Column(Numeric(12, 2), default=0)
    fine_deductions = Column(Numeric(12, 2), default=0)
    lop_deduction = Column(Numeric(12, 2), default=0)
    other_deductions = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), default=0)
    net_salary = Column(Numeric(12, 2), default=0)
    # Status
    status = Column(SQLEnum(SalaryCalculationStatus), default=SalaryCalculationStatus.DRAFT)
    calculation_errors = Column(JSON, default=list)
    calculation_details = Column(JSON, default=dict)
    calculated_at = Column(DateTime, default=datetime.utcnow)
    calculated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    employee = relationship("Employee", foreign_keys=[employee_id])
    period = relationship("PayrollPeriod", foreign_keys=[period_id])
