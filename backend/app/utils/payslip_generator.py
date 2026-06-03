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
            "total_days": salary_calc.get("total_days", 0),
            "generated_at": datetime.utcnow().isoformat(),
        }


payslip_generator = PayslipGenerator()
