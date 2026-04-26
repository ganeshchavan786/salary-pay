from decimal import Decimal
from typing import List, Dict, Any
from datetime import datetime


class InsightsEngine:
    """Rule-based salary insights and anomaly detection"""

    def detect_salary_anomaly(
        self, current_salary: Decimal, previous_salary: Decimal, threshold_pct: float = 30.0
    ) -> Dict:
        """Detect if salary changed by more than threshold %"""
        if previous_salary == 0:
            return {"anomaly": False}

        change_pct = abs(float(current_salary - previous_salary) / float(previous_salary) * 100)

        return {
            "anomaly": change_pct > threshold_pct,
            "change_percentage": round(change_pct, 2),
            "current_salary": float(current_salary),
            "previous_salary": float(previous_salary),
            "severity": "high" if change_pct > 50 else "medium" if change_pct > 30 else "low",
        }

    def detect_high_ot_cost(
        self, ot_amount: Decimal, gross_salary: Decimal, threshold_pct: float = 20.0
    ) -> Dict:
        """Detect if OT cost exceeds threshold % of salary"""
        if gross_salary == 0:
            return {"alert": False}

        ot_pct = float(ot_amount / gross_salary * 100)

        return {
            "alert": ot_pct > threshold_pct,
            "ot_percentage": round(ot_pct, 2),
            "ot_amount": float(ot_amount),
            "gross_salary": float(gross_salary),
            "message": f"OT cost is {ot_pct:.1f}% of salary (threshold: {threshold_pct}%)",
        }

    def detect_frequent_absentee(
        self, absent_days: int, threshold_days: int = 3
    ) -> Dict:
        """Detect if employee is frequently absent"""
        return {
            "alert": absent_days > threshold_days,
            "absent_days": absent_days,
            "threshold": threshold_days,
            "severity": "high" if absent_days > threshold_days * 2 else "medium",
        }

    def generate_period_insights(self, salary_data: List[Dict]) -> List[Dict]:
        """Generate insights for all employees in a period"""
        insights = []

        for emp in salary_data:
            emp_insights = []

            # OT cost check
            ot_check = self.detect_high_ot_cost(
                Decimal(str(emp.get("overtime_amount", 0))),
                Decimal(str(emp.get("gross_salary", 1))),
            )
            if ot_check.get("alert"):
                emp_insights.append({
                    "type": "HIGH_OT_COST",
                    "severity": "medium",
                    "message": ot_check["message"],
                    "data": ot_check,
                })

            # Absentee check
            absent_check = self.detect_frequent_absentee(emp.get("absent_days", 0))
            if absent_check.get("alert"):
                emp_insights.append({
                    "type": "FREQUENT_ABSENTEE",
                    "severity": absent_check["severity"],
                    "message": f"Employee absent {absent_check['absent_days']} days this month",
                    "data": absent_check,
                })

            if emp_insights:
                insights.append({
                    "employee_id": emp.get("employee_id"),
                    "employee_name": emp.get("employee_name"),
                    "insights": emp_insights,
                })

        return insights


insights_engine = InsightsEngine()
