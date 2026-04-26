from decimal import Decimal
from typing import List, Dict, Any
from datetime import datetime


class ComplianceReportGenerator:
    """Generates Indian statutory compliance reports"""

    def generate_pf_ecr(self, salary_data: List[Dict]) -> Dict:
        """Generate PF ECR (Electronic Challan cum Return) data"""
        records = []
        total_epf = Decimal("0")
        total_eps = Decimal("0")

        for emp in salary_data:
            pf_wages = min(Decimal(str(emp.get("basic_salary", 0))), Decimal("15000"))
            epf_contribution = (pf_wages * Decimal("0.12")).quantize(Decimal("0.01"))
            eps_contribution = (pf_wages * Decimal("0.0833")).quantize(Decimal("0.01"))
            epf_eps_diff = epf_contribution - eps_contribution

            records.append({
                "uan": emp.get("uan", ""),
                "member_name": emp.get("employee_name", ""),
                "gross_wages": emp.get("gross_salary", 0),
                "epf_wages": float(pf_wages),
                "eps_wages": float(pf_wages),
                "edli_wages": float(min(Decimal(str(emp.get("gross_salary", 0))), Decimal("15000"))),
                "epf_contribution": float(epf_contribution),
                "eps_contribution": float(eps_contribution),
                "epf_eps_diff": float(epf_eps_diff),
                "ncp_days": emp.get("absent_days", 0),
                "refund_advance": 0,
            })
            total_epf += epf_contribution
            total_eps += eps_contribution

        return {
            "report_type": "PF_ECR",
            "total_employees": len(records),
            "total_epf_contribution": float(total_epf),
            "total_eps_contribution": float(total_eps),
            "records": records,
        }

    def generate_esi_report(self, salary_data: List[Dict]) -> Dict:
        """Generate ESI contribution report"""
        records = []
        total_employee_esi = Decimal("0")
        total_employer_esi = Decimal("0")

        for emp in salary_data:
            gross = Decimal(str(emp.get("gross_salary", 0)))
            if gross <= Decimal("21000"):
                emp_esi = (gross * Decimal("0.0075")).quantize(Decimal("0.01"))
                er_esi = (gross * Decimal("0.0325")).quantize(Decimal("0.01"))
                records.append({
                    "employee_name": emp.get("employee_name", ""),
                    "esi_number": emp.get("esi_number", ""),
                    "gross_wages": float(gross),
                    "employee_contribution": float(emp_esi),
                    "employer_contribution": float(er_esi),
                    "total_contribution": float(emp_esi + er_esi),
                })
                total_employee_esi += emp_esi
                total_employer_esi += er_esi

        return {
            "report_type": "ESI",
            "total_employees": len(records),
            "total_employee_contribution": float(total_employee_esi),
            "total_employer_contribution": float(total_employer_esi),
            "records": records,
        }

    def generate_professional_tax_report(self, salary_data: List[Dict], state: str = "MH") -> Dict:
        """Generate Professional Tax report"""
        records = []
        total_pt = Decimal("0")

        for emp in salary_data:
            gross = Decimal(str(emp.get("gross_salary", 0)))
            pt = Decimal("200") if gross >= Decimal("10000") else Decimal("0")
            if pt > 0:
                records.append({
                    "employee_name": emp.get("employee_name", ""),
                    "gross_salary": float(gross),
                    "professional_tax": float(pt),
                })
                total_pt += pt

        return {
            "report_type": "PROFESSIONAL_TAX",
            "state": state,
            "total_employees": len(records),
            "total_professional_tax": float(total_pt),
            "records": records,
        }

    def generate_form16_data(
        self,
        employee: Dict,
        salary_data: List[Dict],
        financial_year: str,
    ) -> Dict:
        """Generate Form 16 Part A and Part B data structure"""
        total_gross = sum(Decimal(str(s.get("gross_salary", 0))) for s in salary_data)
        total_tds = sum(Decimal(str(s.get("income_tax", 0))) for s in salary_data)
        total_pf = sum(Decimal(str(s.get("pf_employee", 0))) for s in salary_data)

        return {
            "report_type": "FORM_16",
            "financial_year": financial_year,
            "employee": {
                "name": employee.get("name", ""),
                "emp_code": employee.get("emp_code", ""),
                "pan": employee.get("pan", ""),
                "designation": employee.get("designation", ""),
            },
            "part_a": {
                "total_tds_deducted": float(total_tds),
                "total_tds_deposited": float(total_tds),
                "quarters": [],
            },
            "part_b": {
                "gross_salary": float(total_gross),
                "pf_deduction": float(total_pf),
                "taxable_income": float(total_gross - total_pf),
                "tax_payable": float(total_tds),
                "monthly_breakdown": [
                    {
                        "month": s.get("period_name", ""),
                        "gross": s.get("gross_salary", 0),
                        "tds": s.get("income_tax", 0),
                    }
                    for s in salary_data
                ],
            },
            "generated_at": datetime.utcnow().isoformat(),
        }


compliance_report_generator = ComplianceReportGenerator()
