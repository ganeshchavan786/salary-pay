from decimal import Decimal
from typing import Dict


class TaxCalculator:
    """Indian Income Tax calculator supporting Old and New regime (FY 2026-27)"""

    NEW_REGIME_SLABS = [
        (300000, Decimal("0")),
        (700000, Decimal("0.05")),
        (1000000, Decimal("0.10")),
        (1200000, Decimal("0.15")),
        (1500000, Decimal("0.20")),
        (float("inf"), Decimal("0.30")),
    ]

    OLD_REGIME_SLABS = [
        (250000, Decimal("0")),
        (500000, Decimal("0.05")),
        (1000000, Decimal("0.20")),
        (float("inf"), Decimal("0.30")),
    ]

    def calculate_income_tax(
        self,
        annual_income: Decimal,
        regime: str = "new",
        exemptions: Decimal = Decimal("0"),
    ) -> Dict:
        """Calculate income tax based on regime and exemptions."""
        taxable_income = max(Decimal("0"), annual_income - exemptions)
        slabs = self.NEW_REGIME_SLABS if regime == "new" else self.OLD_REGIME_SLABS

        tax = Decimal("0")
        prev_limit = Decimal("0")

        for limit, rate in slabs:
            if taxable_income <= prev_limit:
                break
            slab_income = min(Decimal(str(limit)), taxable_income) - prev_limit
            tax += slab_income * rate
            prev_limit = Decimal(str(limit))

        # Add 4% health and education cess
        cess = tax * Decimal("0.04")
        total_tax = tax + cess
        monthly_tds = (total_tax / 12).quantize(Decimal("0.01"))

        return {
            "annual_income": annual_income,
            "exemptions": exemptions,
            "taxable_income": taxable_income,
            "annual_tax": total_tax.quantize(Decimal("0.01")),
            "monthly_tds": monthly_tds,
        }

    def calculate_pf(self, basic_salary: Decimal, employee_rate: Decimal = Decimal("12")) -> Dict:
        """PF: employee_rate% of basic, capped at ₹15,000"""
        pf_wages = min(basic_salary, Decimal("15000"))
        rate = employee_rate / Decimal("100")
        employee_pf = (pf_wages * rate).quantize(Decimal("0.01"))
        employer_pf = (pf_wages * rate).quantize(Decimal("0.01"))
        # EPS: 8.33% of PF wages (part of employer contribution)
        eps = (pf_wages * Decimal("0.0833")).quantize(Decimal("0.01"))
        return {
            "pf_wages": pf_wages,
            "employee_pf": employee_pf,
            "employer_pf": employer_pf,
            "eps_contribution": eps,
        }

    def calculate_esi(self, gross_salary: Decimal, employee_rate: Decimal = Decimal("0.75")) -> Dict:
        """ESI: employee_rate%, employer 3.25% — only if gross <= ₹21,000"""
        if gross_salary > Decimal("21000"):
            return {
                "employee_esi": Decimal("0"),
                "employer_esi": Decimal("0"),
                "eligible": False,
            }
        emp_rate = employee_rate / Decimal("100")
        employee_esi = (gross_salary * emp_rate).quantize(Decimal("0.01"))
        employer_esi = (gross_salary * Decimal("0.0325")).quantize(Decimal("0.01"))
        return {
            "employee_esi": employee_esi,
            "employer_esi": employer_esi,
            "eligible": True,
        }

    def calculate_professional_tax(
        self, gross_salary: Decimal, state: str = "MH"
    ) -> Decimal:
        """Professional Tax — Maharashtra: ₹200 if gross >= ₹10,000"""
        if state == "MH":
            return Decimal("200") if gross_salary >= Decimal("10000") else Decimal("0")
        return Decimal("0")


tax_calculator = TaxCalculator()
