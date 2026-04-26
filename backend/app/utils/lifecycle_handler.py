from decimal import Decimal
from datetime import date, datetime
from typing import Dict, Optional
from dateutil.relativedelta import relativedelta


class LifecycleHandler:
    """Handles employee lifecycle events: joining, exit, FNF, gratuity"""

    GRATUITY_MAX = Decimal("2000000")  # ₹20,00,000 statutory cap
    GRATUITY_MIN_YEARS = 5

    def calculate_pro_rata(
        self, monthly_salary: Decimal, working_days: int, total_days: int
    ) -> Decimal:
        """Pro-rata = (Monthly Salary / Total Calendar Days) × Actual Working Days"""
        if total_days == 0:
            return Decimal("0")
        return (
            monthly_salary / Decimal(str(total_days)) * Decimal(str(working_days))
        ).quantize(Decimal("0.01"))

    def calculate_gratuity(
        self, last_basic_salary: Decimal, years_of_service: Decimal
    ) -> Decimal:
        """
        Gratuity = (Last Basic / 26) × 15 × Completed Years
        Max: ₹20,00,000. Eligible: min 5 years.
        """
        completed_years = int(years_of_service)
        if completed_years < self.GRATUITY_MIN_YEARS:
            return Decimal("0")
        gratuity = (last_basic_salary / 26 * 15 * completed_years).quantize(Decimal("1"))
        return min(gratuity, self.GRATUITY_MAX)

    def calculate_leave_encashment(
        self,
        basic_salary: Decimal,
        leave_days: int,
        working_days_per_month: int = 26,
    ) -> Decimal:
        """Leave Encashment = (Basic + DA) / 26 × Leave Days"""
        if leave_days <= 0:
            return Decimal("0")
        return (
            basic_salary / Decimal(str(working_days_per_month)) * Decimal(str(leave_days))
        ).quantize(Decimal("0.01"))

    def calculate_notice_period_shortfall(
        self, daily_salary: Decimal, days_short: int
    ) -> Decimal:
        """Deduction for notice period not served"""
        if days_short <= 0:
            return Decimal("0")
        return (daily_salary * Decimal(str(days_short))).quantize(Decimal("0.01"))

    def calculate_fnf(
        self,
        pending_salary: Decimal,
        leave_encashment: Decimal,
        gratuity: Decimal,
        bonus: Decimal,
        pending_loan_recovery: Decimal,
        notice_shortfall: Decimal,
        other_dues: Decimal,
    ) -> Dict:
        """
        FNF = Pending Salary + Leave Encashment + Bonus + Gratuity
              - Pending Loan Recovery - Notice Period Shortfall - Other Dues
        """
        total_earnings = pending_salary + leave_encashment + gratuity + bonus
        total_deductions = pending_loan_recovery + notice_shortfall + other_dues
        net_payable = total_earnings - total_deductions

        return {
            "pending_salary": pending_salary,
            "leave_encashment": leave_encashment,
            "gratuity": gratuity,
            "bonus": bonus,
            "total_earnings": total_earnings,
            "pending_loan_recovery": pending_loan_recovery,
            "notice_shortfall_deduction": notice_shortfall,
            "other_dues": other_dues,
            "total_deductions": total_deductions,
            "net_payable": net_payable,
        }

    def calculate_years_of_service(self, joining_date: date, exit_date: date) -> Decimal:
        """Calculate years of service as decimal"""
        delta = relativedelta(exit_date, joining_date)
        years = delta.years + delta.months / 12
        return Decimal(str(round(years, 2)))


lifecycle_handler = LifecycleHandler()
