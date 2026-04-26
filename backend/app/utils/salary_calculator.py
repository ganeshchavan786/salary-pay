import logging
import uuid
from decimal import Decimal
from typing import Dict, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.services import attendance_service
from app.models.salary_config import SalaryConfig
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod, PayrollPeriodState
from app.models.deduction import Deduction, DeductionStatus
from app.models.arrear import Arrear
from app.models.statutory_rate_config import StatutoryRateConfig, DeductionRateType
from app.models.installment_record import InstallmentRecord
from app.utils.tax_calculator import tax_calculator
from app.utils.deduction_engine import deduction_engine
from app.utils.formula_engine import formula_engine

logger = logging.getLogger(__name__)

# Regulatory defaults (used when no active DB config exists)
_DEFAULT_RATES = {
    DeductionRateType.PF_EMPLOYEE: Decimal("12"),
    DeductionRateType.ESI_EMPLOYEE: Decimal("0.75"),
}


class SalaryCalculator:
    """Main salary calculation orchestrator"""

    async def _get_active_rate(
        self, deduction_type: DeductionRateType, db: AsyncSession
    ) -> Optional[Decimal]:
        """Return the active rate_value for a deduction type, or None if not configured."""
        result = await db.execute(
            select(StatutoryRateConfig).where(
                StatutoryRateConfig.deduction_type == deduction_type,
                StatutoryRateConfig.is_active == True,
            )
        )
        record = result.scalar_one_or_none()
        if record and record.rate_value is not None:
            return Decimal(str(record.rate_value))
        return None

    async def _resolve_rate(
        self, deduction_type: DeductionRateType, db: AsyncSession
    ) -> Decimal:
        """Return active rate or fall back to regulatory default with a warning."""
        rate = await self._get_active_rate(deduction_type, db)
        if rate is None:
            default = _DEFAULT_RATES.get(deduction_type, Decimal("0"))
            logger.warning(
                "No active statutory rate for %s, using default %s",
                deduction_type.value,
                default,
            )
            return default
        return rate

    async def calculate_employee_salary(
        self,
        employee_id: str,
        period_id: str,
        db: AsyncSession,
        calculated_by: str = None,
        attendance_data: Dict = None,
    ) -> SalaryCalculation:
        """
        Calculate salary for one employee for a given period.
        attendance_data: {"present_days": int, "absent_days": int, "leave_days": int,
                          "overtime_hours": float, "total_days": int, "working_days": int}
        """
        # Check for existing calculation (idempotency)
        existing = await self._get_existing_calculation(employee_id, period_id, db)

        # Get salary config
        config = await self._get_salary_config(employee_id, db)
        if not config:
            raise ValueError(f"No active salary config found for employee {employee_id}")

        # Get period
        period_result = await db.execute(select(PayrollPeriod).where(PayrollPeriod.id == period_id))
        period = period_result.scalar_one_or_none()
        if not period:
            raise ValueError(f"Payroll period {period_id} not found")

        if period.state != PayrollPeriodState.OPEN:
            raise ValueError(
                f"Salary calculation only allowed for OPEN periods. "
                f"Current state: {period.state.value}"
            )

        # Fetch or use provided attendance data
        is_manual_override = False
        if not attendance_data:
            # Fetch real attendance data from Attendance Service
            attendance_data = await attendance_service.get_employee_attendance_summary(
                db=db,
                employee_id=employee_id,
                start_date=period.start_date.date(),
                end_date=period.end_date.date()
            )
            logger.debug(f"Fetched attendance for employee {employee_id}: {attendance_data}")
        else:
            # Manual override provided
            is_manual_override = True
            logger.info(f"Using manual attendance override for employee {employee_id}")
        
        # Validate attendance_data keys
        if "present_days" not in attendance_data or "working_days" not in attendance_data:
            logger.warning(
                f"Invalid attendance_data for employee {employee_id}: missing required keys. Using defaults."
            )
            attendance_data = {
                "total_days": 30, "working_days": 26, "present_days": 0,
                "absent_days": 26, "leave_days": 0, "overtime_hours": 0,
            }

        basic = Decimal(str(config.basic_salary))
        hra_pct = Decimal(str(config.hra_percentage))

        # Get attendance values
        present_days = attendance_data.get("present_days", 0)
        working_days = attendance_data.get("working_days", 26)
        
        # Ensure working_days is positive to avoid division by zero
        if working_days <= 0:
            working_days = 26
            logger.warning(f"Invalid working_days for employee {employee_id}, using default 26")

        # Calculate earnings using formula engine
        # IMPORTANT: For zero attendance (present_days=0), calculate FULL gross salary
        # For partial attendance (present_days>0), apply pro-rata
        # This ensures gross_salary is always calculated, and LOP handles the deduction
        
        if present_days == 0:
            # Zero attendance: calculate full gross components, LOP will deduct
            context = {
                "BASIC": float(basic),
                "FULL_BASIC": float(basic),
                "HRA_PERCENT": float(hra_pct),
                "GROSS": 0,  # Will be updated
                "OT_HOURS": float(attendance_data.get("overtime_hours", 0)),
                "SHIFT_HOURS": float(attendance_data.get("shift_hours", 8.0)),
                "OT_MULTIPLIER": float(attendance_data.get("ot_multiplier", 2.0)),
            }
            formula_results = formula_engine.calculate_all(context)

            basic_earned = basic.quantize(Decimal("0.01"))
            hra_earned = formula_results.get("HRA", Decimal("0"))
            special_allowance = Decimal(str(config.special_allowance)).quantize(Decimal("0.01"))
            travel_allowance = Decimal(str(config.travel_allowance)).quantize(Decimal("0.01"))
            medical_allowance = Decimal(str(config.medical_allowance)).quantize(Decimal("0.01"))
            ot_amount = formula_results.get("OT_AMOUNT", Decimal("0"))
        else:
            # Partial or full attendance: apply pro-rata
            pro_rata_factor = Decimal(str(present_days)) / Decimal(str(working_days))
            
            context = {
                "BASIC": float(basic * pro_rata_factor),
                "FULL_BASIC": float(basic),
                "HRA_PERCENT": float(hra_pct),
                "GROSS": 0,  # Will be updated
                "OT_HOURS": float(attendance_data.get("overtime_hours", 0)),
                "SHIFT_HOURS": float(attendance_data.get("shift_hours", 8.0)),
                "OT_MULTIPLIER": float(attendance_data.get("ot_multiplier", 2.0)),
            }
            formula_results = formula_engine.calculate_all(context)

            basic_earned = (basic * pro_rata_factor).quantize(Decimal("0.01"))
            hra_earned = formula_results.get("HRA", Decimal("0"))
            special_allowance = (Decimal(str(config.special_allowance)) * pro_rata_factor).quantize(Decimal("0.01"))
            travel_allowance = (Decimal(str(config.travel_allowance)) * pro_rata_factor).quantize(Decimal("0.01"))
            medical_allowance = (Decimal(str(config.medical_allowance)) * pro_rata_factor).quantize(Decimal("0.01"))
            ot_amount = formula_results.get("OT_AMOUNT", Decimal("0"))

        # --- Custom payheads ---
        custom_payheads_total = Decimal("0")
        custom_payheads_breakdown = []
        for ph in (config.custom_payheads or []):
            if isinstance(ph, dict):
                name = ph.get("name", "Custom Payhead")
                amount = Decimal(str(ph.get("amount", 0)))
                is_pct = ph.get("is_percentage_of_basic", False)
            else:
                name = ph.name
                amount = Decimal(str(ph.amount))
                is_pct = ph.is_percentage_of_basic
                
            if is_pct:
                calculated_amt = (basic_earned * amount / Decimal("100")).quantize(Decimal("0.01"))
            else:
                calculated_amt = amount.quantize(Decimal("0.01"))
                
            if calculated_amt > 0:
                custom_payheads_total += calculated_amt
                custom_payheads_breakdown.append({"name": name, "amount": str(calculated_amt)})

        # Get arrears for this period
        arrears_result = await db.execute(
            select(Arrear).where(
                and_(Arrear.employee_id == employee_id, Arrear.period_id == period_id)
            )
        )
        arrears = arrears_result.scalars().all()
        arrears_amount = sum(Decimal(str(a.arrear_amount)) for a in arrears)

        gross_salary = (
            basic_earned + hra_earned + special_allowance
            + travel_allowance + medical_allowance + ot_amount
            + custom_payheads_total + arrears_amount
        )

        # --- Dynamic statutory rates ---
        pf_rate = await self._resolve_rate(DeductionRateType.PF_EMPLOYEE, db)
        esi_rate = await self._resolve_rate(DeductionRateType.ESI_EMPLOYEE, db)

        pf_data = tax_calculator.calculate_pf(basic_earned, employee_rate=pf_rate) if config.pf_applicable else {}
        esi_data = tax_calculator.calculate_esi(gross_salary, employee_rate=esi_rate) if config.esi_applicable else {}
        pt = tax_calculator.calculate_professional_tax(gross_salary) if config.pt_applicable else Decimal("0")

        # LOP deduction - use absent_days + half of halfday_count from attendance_data
        # Formula: LOP = absent_days + (halfday_count × 0.5)
        # Example: 2 absent + 1 halfday = 2 + 0.5 = 2.5 LOP days
        absent_days_count = attendance_data.get("absent_days", 0)
        halfday_count = attendance_data.get("halfday_count", 0)
        lop_days = Decimal(str(absent_days_count)) + (Decimal(str(halfday_count)) * Decimal("0.5"))
        
        lop_deduction = (
            (basic / Decimal(str(working_days)) * lop_days).quantize(Decimal("0.01"))
            if lop_days > 0
            else Decimal("0")
        )

        statutory = {
            "pf_employee": pf_data.get("employee_pf", Decimal("0")),
            "esi_employee": esi_data.get("employee_esi", Decimal("0")),
            "professional_tax": pt,
            "income_tax": Decimal("0"),  # TDS calculated separately
        }

        # Get active voluntary deductions (ACTIVE only — skip PAUSED and COMPLETED)
        deductions_result = await db.execute(
            select(Deduction).where(
                and_(
                    Deduction.employee_id == employee_id,
                    Deduction.status == DeductionStatus.ACTIVE,
                )
            )
        )
        active_deductions = deductions_result.scalars().all()

        voluntary_deductions = []
        for ded in active_deductions:
            amount = min(
                Decimal(str(ded.emi_amount)) if ded.emi_amount else Decimal(str(ded.remaining)),
                Decimal(str(ded.remaining)),
            )
            voluntary_deductions.append({
                "id": ded.id,
                "type": ded.deduction_type.value,
                "amount": float(amount),
            })

        deduction_result = deduction_engine.apply_deductions(gross_salary, statutory, voluntary_deductions)

        # --- Installment tracking: update deduction balances and create records ---
        for ded in active_deductions:
            emi = Decimal(str(ded.emi_amount)) if ded.emi_amount else Decimal(str(ded.remaining))
            amount_to_deduct = min(emi, Decimal(str(ded.remaining)))
            if amount_to_deduct <= 0:
                continue

            new_remaining = Decimal(str(ded.remaining)) - amount_to_deduct
            new_recovered = Decimal(str(ded.recovered)) + amount_to_deduct

            ded.remaining = new_remaining
            ded.recovered = new_recovered
            ded.updated_at = datetime.utcnow()

            if new_remaining <= 0:
                ded.status = DeductionStatus.COMPLETED

            installment = InstallmentRecord(
                id=str(uuid.uuid4()),
                deduction_id=ded.id,
                period_id=period_id,
                amount_deducted=amount_to_deduct,
                remaining_after=max(new_remaining, Decimal("0")),
                applied_at=datetime.utcnow(),
            )
            db.add(installment)

        # Determine version
        version = 1
        if existing:
            version = existing.calculation_version + 1
            existing.status = SalaryCalculationStatus.CANCELLED

        calc = SalaryCalculation(
            employee_id=employee_id,
            period_id=period_id,
            calculation_version=version,
            total_days=attendance_data.get("total_days", 30),
            working_days=working_days,
            present_days=present_days,
            absent_days=attendance_data.get("absent_days", 0),
            leave_days=attendance_data.get("leave_days", 0),
            overtime_hours=Decimal(str(attendance_data.get("overtime_hours", 0))),
            basic_salary=basic_earned,
            hra=hra_earned,
            special_allowance=special_allowance,
            travel_allowance=travel_allowance,
            medical_allowance=medical_allowance,
            overtime_amount=ot_amount,
            arrears_amount=arrears_amount,
            gross_salary=gross_salary,
            pf_employee=pf_data.get("employee_pf", Decimal("0")),
            pf_employer=pf_data.get("employer_pf", Decimal("0")),
            esi_employee=esi_data.get("employee_esi", Decimal("0")),
            esi_employer=esi_data.get("employer_esi", Decimal("0")),
            professional_tax=pt,
            income_tax=Decimal("0"),
            loan_deductions=sum(
                Decimal(str(d["applied_amount"])) for d in deduction_result["applied_deductions"]
                if d["type"] == "LOAN"
            ),
            advance_deductions=sum(
                Decimal(str(d["applied_amount"])) for d in deduction_result["applied_deductions"]
                if d["type"] == "ADVANCE"
            ),
            fine_deductions=sum(
                Decimal(str(d["applied_amount"])) for d in deduction_result["applied_deductions"]
                if d["type"] in ("FINE", "CUSTOM")
            ),
            lop_deduction=lop_deduction,
            total_deductions=deduction_result["total_deductions"] + lop_deduction,
            net_salary=deduction_result["net_salary"] - lop_deduction,
            status=SalaryCalculationStatus.CALCULATED,
            calculated_by=calculated_by,
            calculation_details={
                "custom_payheads_total": str(custom_payheads_total),
                "custom_payheads_breakdown": custom_payheads_breakdown,
                "pf_rate_used": str(pf_rate),
                "esi_rate_used": str(esi_rate),
                "lop_days": str(lop_days),  # Updated to use calculated lop_days (includes halfday)
                "absent_days": str(attendance_data.get("absent_days", 0)),
                "halfday_count": str(attendance_data.get("halfday_count", 0)),
                "carry_forward": [
                    {k: str(v) if isinstance(v, Decimal) else v for k, v in d.items()}
                    for d in deduction_result["carry_forward_deductions"]
                ],
                # Store attendance_data if manual override was used
                **({"attendance_override": attendance_data} if is_manual_override else {}),
            },
        )

        db.add(calc)
        await db.commit()
        await db.refresh(calc)
        return calc

    async def _get_existing_calculation(
        self, employee_id: str, period_id: str, db: AsyncSession
    ) -> Optional[SalaryCalculation]:
        result = await db.execute(
            select(SalaryCalculation).where(
                and_(
                    SalaryCalculation.employee_id == employee_id,
                    SalaryCalculation.period_id == period_id,
                    SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
                )
            ).order_by(SalaryCalculation.calculation_version.desc())
        )
        return result.scalar_one_or_none()

    async def _get_salary_config(self, employee_id: str, db: AsyncSession) -> Optional[SalaryConfig]:
        result = await db.execute(
            select(SalaryConfig).where(
                and_(SalaryConfig.employee_id == employee_id, SalaryConfig.status == "active")
            ).order_by(SalaryConfig.effective_date.desc())
        )
        return result.scalar_one_or_none()


salary_calculator = SalaryCalculator()
