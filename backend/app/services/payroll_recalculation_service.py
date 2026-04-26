"""
Payroll recalculation service — async wrapper for recalculating existing payroll records.
Triggered when attendance records are modified for dates within a processed payroll period.
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
import calendar

from app.models.payroll import Payroll, PayrollStatus
from app.models.attendance_daily import AttendanceDaily
from app.models.leave import LeaveBalance
from app.models.holiday import Holiday
from app.models.employee import Employee
from app.services.payroll_service import recalculate_payroll_for_month
from app.services.policy_service import get_policy


async def recalculate_payroll_record(db: AsyncSession, payroll_id: str) -> Optional[Payroll]:
    """
    Async wrapper to recalculate an existing payroll record based on current attendance data.
    
    This function:
    1. Fetches the payroll record by ID
    2. Validates status is not "PAID" (early return if paid to preserve immutability)
    3. Fetches current attendance records for the payroll period (emp_id, month, year)
    4. Fetches holidays, leave balance, employee salary, and policy
    5. Calls pure `recalculate_payroll_for_month` function
    6. Updates payroll record with returned values
    7. Commits transaction
    
    Args:
        db: AsyncSession - Database session
        payroll_id: str - ID of the payroll record to recalculate
    
    Returns:
        Payroll object if recalculated, None if payroll is PAID or not found
    
    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2
    """
    # Fetch payroll record by ID
    result = await db.execute(
        select(Payroll).where(Payroll.id == payroll_id)
    )
    payroll = result.scalar_one_or_none()
    
    if not payroll:
        return None
    
    # Validate status is not "PAID" (early return if paid to preserve immutability)
    if payroll.status == PayrollStatus.PAID:
        return None
    
    # Extract emp_id, month, year from payroll record
    emp_id = payroll.emp_id
    month = payroll.month
    year = payroll.year
    
    # Fetch current attendance records for the payroll period
    from_date = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    to_date = date(year, month, last_day)
    
    att_result = await db.execute(
        select(AttendanceDaily).where(
            and_(
                AttendanceDaily.emp_id == emp_id,
                AttendanceDaily.date >= from_date,
                AttendanceDaily.date <= to_date,
            )
        )
    )
    attendance_records = att_result.scalars().all()
    
    # Fetch holidays for the year
    hol_result = await db.execute(
        select(Holiday.date).where(
            and_(Holiday.year == year, Holiday.is_active == True)
        )
    )
    holiday_dates = [row[0] for row in hol_result.all()]
    
    # Fetch leave balance for the employee and year
    bal_result = await db.execute(
        select(LeaveBalance).where(
            and_(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year)
        )
    )
    leave_balance = bal_result.scalar_one_or_none()
    
    # Fetch employee salary
    emp_result = await db.execute(
        select(Employee).where(Employee.id == emp_id)
    )
    employee = emp_result.scalar_one_or_none()
    
    if not employee or not employee.salary:
        return None
    
    employee_salary = Decimal(str(employee.salary))
    
    # Fetch policy
    policy = await get_policy(db)
    
    # Call pure recalculate_payroll_for_month function
    updated_values = recalculate_payroll_for_month(
        emp_id=emp_id,
        month=month,
        year=year,
        attendance_records=attendance_records,
        holidays=holiday_dates,
        leave_balance=leave_balance,
        employee_salary=employee_salary,
        policy=policy,
    )
    
    # Update payroll record with returned values
    payroll.working_days = updated_values["working_days"]
    payroll.present_days = updated_values["present_days"]
    payroll.half_days = updated_values["half_days"]
    payroll.lop_days = updated_values["lop_days"]
    payroll.ot_hours = updated_values["ot_hours"]
    payroll.gross_salary = updated_values["gross_salary"]
    payroll.basic_salary = updated_values["basic_salary"]
    payroll.hra = updated_values["hra"]
    payroll.travel_allowance = updated_values["travel_allowance"]
    payroll.special_allowance = updated_values["special_allowance"]
    payroll.pt_deduction = updated_values["pt_deduction"]
    payroll.pf_deduction = updated_values["pf_deduction"]
    payroll.lop_deduction = updated_values["lop_deduction"]
    payroll.late_mark_deduction = updated_values["late_mark_deduction"]
    payroll.total_deductions = updated_values["total_deductions"]
    payroll.net_pay = updated_values["net_pay"]
    payroll.updated_at = datetime.utcnow()
    
    # Commit transaction
    await db.commit()
    await db.refresh(payroll)
    
    return payroll
