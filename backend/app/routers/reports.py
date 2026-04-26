"""
FastAPI router for the Advanced Reporting Module.
All 34+ report endpoints under /api/reports.
"""
from __future__ import annotations

import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils.deps import get_current_user, require_admin, require_supervisor
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _validate_date_range(start_date, end_date):
    today = date.today()
    if start_date is None:
        start_date = date(today.year, today.month, 1)
    if end_date is None:
        _, last_day = calendar.monthrange(today.year, today.month)
        end_date = date(today.year, today.month, last_day)
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be before or equal to end_date")
    return start_date, end_date


def _validate_month(month):
    if not (1 <= month <= 12):
        raise HTTPException(status_code=422, detail="month must be between 1 and 12")


@router.get("/dashboard/today")
async def dashboard_today(db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor)):
    return await report_service.get_dashboard_today(db)


@router.get("/insights")
async def auto_insights(db: AsyncSession = Depends(get_db), _user=Depends(require_admin)):
    return await report_service.get_auto_insights(db)


@router.get("/employee-attendance-summary")
async def employee_attendance_summary(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_employee_attendance_summary(db, start_date, end_date, emp_ids, departments)


@router.get("/employee-working-hours")
async def employee_working_hours(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    granularity: str = Query("daily"),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_employee_working_hours(db, start_date, end_date, emp_ids, departments, granularity)


@router.get("/employee-inout")
async def employee_inout(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_employee_inout(db, start_date, end_date, emp_ids, departments)


@router.get("/employee-late-marks")
async def employee_late_marks(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_employee_late_marks(db, start_date, end_date, emp_ids, departments)


@router.get("/employee-ot")
async def employee_ot(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_employee_ot(db, start_date, end_date, emp_ids, departments)


@router.get("/employee-halfday-absent")
async def employee_halfday_absent(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_employee_halfday_absent(db, start_date, end_date, emp_ids, departments)


@router.get("/daily-attendance-summary")
async def daily_attendance_summary(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_daily_attendance_summary(db, start_date, end_date, emp_ids, departments)


@router.get("/monthly-attendance-trend")
async def monthly_attendance_trend(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_monthly_attendance_trend(db, start_date, end_date, emp_ids, departments)


@router.get("/late-coming-analysis")
async def late_coming_analysis(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_late_coming_analysis(db, start_date, end_date, emp_ids, departments)


@router.get("/early-leaving-analysis")
async def early_leaving_analysis(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_early_leaving_analysis(db, start_date, end_date, emp_ids, departments)


@router.get("/shift-wise-attendance")
async def shift_wise_attendance(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_shift_wise_attendance(db, start_date, end_date, emp_ids, departments)


@router.get("/attendance-heatmap")
async def attendance_heatmap(
    month: Optional[int] = Query(None), year: Optional[int] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    today = date.today()
    if month is None:
        month = today.month
    if year is None:
        year = today.year
    _validate_month(month)
    return await report_service.get_attendance_heatmap(db, month, year, emp_ids, departments)


@router.get("/department-attendance")
async def department_attendance(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_department_attendance(db, start_date, end_date, emp_ids, departments)


@router.get("/department-ot")
async def department_ot(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_department_ot(db, start_date, end_date, emp_ids, departments)


@router.get("/monthly-ot-trend")
async def monthly_ot_trend(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_monthly_ot_trend(db, start_date, end_date)


@router.get("/ot-cost")
async def ot_cost(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_ot_cost(db, start_date, end_date, emp_ids, departments)


@router.get("/holiday-ot")
async def holiday_ot(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_holiday_ot(db, start_date, end_date, emp_ids, departments)


@router.get("/excess-ot-alert")
async def excess_ot_alert(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_excess_ot_alert(db, start_date, end_date, emp_ids, departments)


@router.get("/cost-per-employee")
async def cost_per_employee(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_cost_per_employee(db, start_date, end_date, emp_ids, departments)


@router.get("/high-absenteeism")
async def high_absenteeism(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_high_absenteeism(db, start_date, end_date, emp_ids, departments)


@router.get("/frequent-late-coming")
async def frequent_late_coming(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_frequent_late_coming(db, start_date, end_date, emp_ids, departments)


@router.get("/missed-punch")
async def missed_punch(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_missed_punch(db, start_date, end_date, emp_ids, departments)


@router.get("/half-day-frequent")
async def half_day_frequent(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_half_day_frequent(db, start_date, end_date, emp_ids, departments)


@router.get("/absent-cost-impact")
async def absent_cost_impact(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_absent_cost_impact(db, start_date, end_date, emp_ids, departments)


@router.get("/salary-vs-ot")
async def salary_vs_ot(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_admin),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_salary_vs_ot(db, start_date, end_date, emp_ids, departments)


@router.get("/leave-balance")
async def leave_balance(
    year: Optional[int] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    if year is None:
        year = date.today().year
    return await report_service.get_leave_balance(db, year, emp_ids, departments)


@router.get("/leave-usage-trend")
async def leave_usage_trend(
    start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    start_date, end_date = _validate_date_range(start_date, end_date)
    return await report_service.get_leave_usage_trend(db, start_date, end_date, emp_ids, departments)


@router.get("/compoff-balance")
async def compoff_balance(
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    return await report_service.get_compoff_balance(db, emp_ids, departments)


@router.get("/expiring-compoff")
async def expiring_compoff(
    emp_ids: Optional[list[str]] = Query(None), departments: Optional[list[str]] = Query(None),
    db: AsyncSession = Depends(get_db), _user=Depends(require_supervisor),
):
    return await report_service.get_expiring_compoff(db, emp_ids, departments)


# ─── Export Endpoints ─────────────────────────────────────────────────────────

@router.get("/{report_name}/export")
async def export_report(
    report_name: str,
    format: str = Query("csv"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    emp_ids: Optional[list[str]] = Query(None),
    departments: Optional[list[str]] = Query(None),
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    granularity: str = Query("daily"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_supervisor),
):
    """Export any report to CSV or Excel. Requirement 33."""
    if format not in ("csv", "xlsx"):
        raise HTTPException(status_code=422, detail="format must be csv or xlsx")

    today = date.today()
    if start_date is None:
        start_date = date(today.year, today.month, 1)
    if end_date is None:
        _, last_day = calendar.monthrange(today.year, today.month)
        end_date = date(today.year, today.month, last_day)
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be before or equal to end_date")

    filters = {
        "start_date": start_date,
        "end_date": end_date,
        "emp_ids": emp_ids,
        "departments": departments,
        "month": month or today.month,
        "year": year or today.year,
        "granularity": granularity,
    }

    try:
        data, filename = await report_service.export_report(db, report_name, filters, format)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    media_type = "text/csv" if format == "csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
