from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Any, Dict, List

from app.database import get_db
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod
from app.models.employee import Employee
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.insights_engine import insights_engine

router = APIRouter(tags=["Smart Insights"])


async def _get_period_or_404(period_id: str, db: AsyncSession) -> PayrollPeriod:
    result = await db.execute(select(PayrollPeriod).where(PayrollPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")
    return period


async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


@router.get("/period/{period_id}", response_model=List[Dict[str, Any]])
async def get_period_insights(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Generate smart insights for all employees in a payroll period."""
    await _get_period_or_404(period_id, db)

    result = await db.execute(
        select(SalaryCalculation, Employee)
        .join(Employee, SalaryCalculation.employee_id == Employee.id)
        .where(
            and_(
                SalaryCalculation.period_id == period_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
            )
        )
    )
    rows = result.all()

    if not rows:
        return []

    salary_data = [
        {
            "employee_id": emp.id,
            "employee_name": emp.name,
            "gross_salary": float(calc.gross_salary or 0),
            "overtime_amount": float(calc.overtime_amount or 0),
            "absent_days": calc.absent_days or 0,
        }
        for calc, emp in rows
    ]

    return insights_engine.generate_period_insights(salary_data)


@router.get("/employee/{employee_id}", response_model=List[Dict[str, Any]])
async def get_employee_insights(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get smart insights for a specific employee across all periods."""
    employee = await _get_employee_or_404(employee_id, db)

    result = await db.execute(
        select(SalaryCalculation, PayrollPeriod)
        .join(PayrollPeriod, SalaryCalculation.period_id == PayrollPeriod.id)
        .where(
            and_(
                SalaryCalculation.employee_id == employee_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
            )
        )
        .order_by(PayrollPeriod.start_date.desc())
    )
    rows = result.all()

    if not rows:
        return []

    all_insights: List[Dict[str, Any]] = []

    for calc, period in rows:
        period_data = [
            {
                "employee_id": employee_id,
                "employee_name": employee.name,
                "gross_salary": float(calc.gross_salary or 0),
                "overtime_amount": float(calc.overtime_amount or 0),
                "absent_days": calc.absent_days or 0,
            }
        ]
        period_insights = insights_engine.generate_period_insights(period_data)
        for insight_record in period_insights:
            all_insights.append({
                "period_id": period.id,
                "period_name": period.period_name,
                **insight_record,
            })

    return all_insights
