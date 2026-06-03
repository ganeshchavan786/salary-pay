from decimal import Decimal
from typing import Dict, Any
from datetime import datetime


class PayslipGenerator:
    """Generates payslip data structure for PDF rendering"""

    def generate_payslip_data(
        self,
        employee: Dict,
        salary_calc: Dict,
        company_info: Dict = None,
    ) -> Dict[str, Any]:
        """Generate structured payslip data"""
        earnings = [
            {"label": "Basic Salary", "amount": salary_calc.get("basic_salary", 0)},
            {"label": "HRA", "amount": salary_calc.get("hra", 0)},
            {"label": "Special Allowance", "amount": salary_calc.get("special_allowance", 0)},
            {"label": "Travel Allowance", "amount": salary_calc.get("travel_allowance", 0)},
            {"label": "Medical Allowance", "amount": salary_calc.get("medical_allowance", 0)},
            {"label": "Overtime", "amount": salary_calc.get("overtime_amount", 0)},
        ]
        if salary_calc.get("arrears_amount", 0) > 0:
            earnings.append({"label": "Arrears", "amount": salary_calc.get("arrears_amount", 0)})

        # Add custom payheads if available
        calc_details = salary_calc.get("calculation_details", {})
        custom_breakdown = calc_details.get("custom_payheads_breakdown", [])
        for ph in custom_breakdown:
            earnings.append({"label": ph.get("name"), "amount": Decimal(ph.get("amount", "0"))})

        deductions = [
            {"label": "PF (Employee)", "amount": salary_calc.get("pf_employee", 0)},
            {"label": "ESI (Employee)", "amount": salary_calc.get("esi_employee", 0)},
            {"label": "Professional Tax", "amount": salary_calc.get("professional_tax", 0)},
            {"label": "Income Tax (TDS)", "amount": salary_calc.get("income_tax", 0)},
            {"label": "LOP Deduction", "amount": salary_calc.get("lop_deduction", 0)},
        ]
        if salary_calc.get("loan_deductions", 0) > 0:
            deductions.append({"label": "Loan EMI", "amount": salary_calc.get("loan_deductions", 0)})
        if salary_calc.get("advance_deductions", 0) > 0:
            deductions.append({"label": "Advance Recovery", "amount": salary_calc.get("advance_deductions", 0)})

        # Filter zero amounts
        earnings = [e for e in earnings if e["amount"] > 0]
        deductions = [d for d in deductions if d["amount"] > 0]

        calc_details = salary_calc.get("calculation_details", {})
        
        # LOP Days: first try calculation_details, then fallback to absent_days, then 0.0
        lop_days = calc_details.get("lop_days")
        if lop_days is None:
            lop_days = salary_calc.get("absent_days", 0)
        try:
            lop_days = float(lop_days)
        except (ValueError, TypeError):
            lop_days = 0.0

        # Half days: first try calculation_details, then fallback to salary_calc or 0.0
        half_days = calc_details.get("halfday_count")
        if half_days is None:
            half_days = salary_calc.get("half_days") or salary_calc.get("halfday_count") or 0.0
        try:
            half_days = float(half_days)
        except (ValueError, TypeError):
            half_days = 0.0

        # Late Count: first try calculation_details, then fallback to salary_calc or 0
        late_count = calc_details.get("late_count")
        if late_count is None:
            late_count = salary_calc.get("late_count") or salary_calc.get("late_mark_count") or 0
        try:
            late_count = int(late_count)
        except (ValueError, TypeError):
            late_count = 0

        return {
            "company": company_info or {"name": "Company Name", "address": "Company Address"},
            "employee": {
                "name": employee.get("name", ""),
                "emp_code": employee.get("emp_code", ""),
                "department": employee.get("department", ""),
                "designation": employee.get("designation", ""),
                "joining_date": str(employee.get("joining_date", "-")),
                "aadhaar_no": employee.get("aadhaar_no", "-"),
                "pan_no": employee.get("pan_no", "-"),
                "bank_name": employee.get("bank_name", "-"),
                "account_no": employee.get("account_no", "-"),
                "ifsc_code": employee.get("ifsc_code", "-"),
                # Compliance fields
                "uan_no": employee.get("uan_no", "-"),
                "pf_no": employee.get("pf_no", "-"),
                "esi_no": employee.get("esi_no", "-"),
                "location": employee.get("location", "-"),
            },
            "period": salary_calc.get("period_name", ""),
            "earnings": earnings,
            "deductions": deductions,
            "gross_salary": salary_calc.get("gross_salary", 0),
            "total_deductions": salary_calc.get("total_deductions", 0),
            "net_salary": salary_calc.get("net_salary", 0),
            # Attendance info
            "working_days": salary_calc.get("working_days", 0),
            "present_days": salary_calc.get("present_days", 0),
            "absent_days": salary_calc.get("absent_days", 0),
            "leave_days": salary_calc.get("leave_days", 0),
            "total_days": salary_calc.get("total_days", 0),
            "weeklyoff_count": salary_calc.get("weeklyoff_count", 0),
            "holiday_count": salary_calc.get("holiday_count", 0),
            "lop_days": lop_days,
            "half_days": half_days,
            "late_count": late_count,
            "calculation_details": calc_details,
            "generated_at": datetime.utcnow().isoformat(),
        }


payslip_generator = PayslipGenerator()
