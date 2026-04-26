from decimal import Decimal
from typing import List, Dict


class DeductionEngine:
    """Advanced deduction engine with priority ordering and net salary floor"""

    MAX_DEDUCTION_PERCENTAGE = Decimal("0.50")  # 50% of gross (Payment of Wages Act)

    def calculate_loan_emi(
        self,
        principal: Decimal,
        annual_rate: Decimal,
        tenure_months: int,
    ) -> Dict:
        """Calculate EMI using standard formula: P*r*(1+r)^n / ((1+r)^n - 1)"""
        if annual_rate == 0:
            emi = (principal / tenure_months).quantize(Decimal("0.01"))
            return {
                "emi": emi,
                "total_interest": Decimal("0"),
                "total_payment": principal,
            }

        monthly_rate = annual_rate / 100 / 12
        factor = (1 + monthly_rate) ** tenure_months
        emi = (principal * monthly_rate * factor / (factor - 1)).quantize(Decimal("0.01"))
        total_payment = emi * tenure_months
        total_interest = total_payment - principal
        return {
            "emi": emi,
            "total_interest": total_interest.quantize(Decimal("0.01")),
            "total_payment": total_payment.quantize(Decimal("0.01")),
        }

    def apply_deductions(
        self,
        gross_salary: Decimal,
        statutory: Dict,
        deductions: List[Dict],
    ) -> Dict:
        """
        Apply deductions in priority order:
        Statutory (PF/ESI/PT/TDS) → Loan → Advance → Fine → Custom
        Net salary floor = ₹0
        """
        max_allowed = gross_salary * self.MAX_DEDUCTION_PERCENTAGE

        total_statutory = (
            statutory.get("pf_employee", Decimal("0"))
            + statutory.get("esi_employee", Decimal("0"))
            + statutory.get("professional_tax", Decimal("0"))
            + statutory.get("income_tax", Decimal("0"))
        )

        remaining_capacity = max(Decimal("0"), max_allowed - total_statutory)

        applied: List[Dict] = []
        carry_forward: List[Dict] = []
        total_voluntary = Decimal("0")

        # Sort by priority: LOAN=1, ADVANCE=2, FINE=3, CUSTOM=4
        priority = {"LOAN": 1, "ADVANCE": 2, "FINE": 3, "CUSTOM": 4}
        sorted_deductions = sorted(
            deductions, key=lambda d: priority.get(d["type"], 99)
        )

        for ded in sorted_deductions:
            amount = Decimal(str(ded["amount"]))
            if total_voluntary + amount <= remaining_capacity:
                applied.append(
                    {**ded, "applied_amount": amount, "carry_forward": Decimal("0")}
                )
                total_voluntary += amount
            else:
                # Partial recovery
                can_apply = remaining_capacity - total_voluntary
                if can_apply > 0:
                    applied.append(
                        {
                            **ded,
                            "applied_amount": can_apply,
                            "carry_forward": amount - can_apply,
                        }
                    )
                    total_voluntary += can_apply
                else:
                    carry_forward.append(
                        {
                            **ded,
                            "applied_amount": Decimal("0"),
                            "carry_forward": amount,
                        }
                    )

        total_deductions = total_statutory + total_voluntary
        net_salary = max(Decimal("0"), gross_salary - total_deductions)

        return {
            "gross_salary": gross_salary,
            "statutory_deductions": total_statutory,
            "voluntary_deductions": total_voluntary,
            "total_deductions": total_deductions,
            "net_salary": net_salary,
            "applied_deductions": applied,
            "carry_forward_deductions": carry_forward,
        }


deduction_engine = DeductionEngine()
