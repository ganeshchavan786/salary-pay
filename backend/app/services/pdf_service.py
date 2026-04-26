"""
PDF salary slip generation using fpdf2.
"""
from io import BytesIO
from typing import Optional
import calendar


def generate_salary_slip(payroll: dict, employee: dict) -> bytes:
    """
    Generate a salary slip PDF.
    
    Args:
        payroll: dict with payroll fields (month, year, gross_salary, basic_salary,
                 hra, travel_allowance, special_allowance, pt_deduction, pf_deduction,
                 lop_deduction, late_mark_deduction, total_deductions, net_pay, status)
        employee: dict with employee fields (name, emp_code, designation, department)
    
    Returns:
        PDF as bytes
    """
    from fpdf import FPDF

    COMPANY_NAME = "Face Attendance HR"
    COMPANY_SUBTITLE = "HR Management System"
    PRIMARY_COLOR = (21, 101, 192)   # #1565C0 blue
    LIGHT_BG = (240, 248, 255)       # light blue bg
    GREEN = (5, 150, 105)
    GRAY = (100, 116, 139)
    DARK = (15, 23, 42)

    month_num = int(payroll.get("month", 1))
    year_num = int(payroll.get("year", 2026))
    month_name = calendar.month_name[month_num]

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Company Header ──────────────────────────────────────────────────────
    pdf.set_fill_color(*PRIMARY_COLOR)
    pdf.rect(0, 0, 210, 30, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_xy(10, 8)
    pdf.cell(0, 8, COMPANY_NAME, ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_xy(10, 18)
    pdf.cell(0, 6, COMPANY_SUBTITLE)

    # ── Salary Slip Title ───────────────────────────────────────────────────
    pdf.set_text_color(*DARK)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_xy(10, 36)
    pdf.cell(0, 8, f"SALARY SLIP - {month_name.upper()} {year_num}", ln=True)

    # ── Employee Info ───────────────────────────────────────────────────────
    pdf.set_fill_color(*LIGHT_BG)
    pdf.set_draw_color(200, 220, 240)
    pdf.rect(10, 48, 190, 28, "FD")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*DARK)

    emp_name = employee.get("name", "—")
    emp_code = employee.get("emp_code", "—")
    designation = employee.get("designation") or "—"
    department = employee.get("department") or "—"

    pdf.set_xy(14, 52)
    pdf.cell(90, 6, f"Employee: {emp_name}")
    pdf.set_xy(110, 52)
    pdf.cell(90, 6, f"Code: {emp_code}")
    pdf.set_xy(14, 60)
    pdf.cell(90, 6, f"Designation: {designation}")
    pdf.set_xy(110, 60)
    pdf.cell(90, 6, f"Department: {department}")
    pdf.set_xy(14, 68)
    pdf.cell(90, 6, f"Pay Period: {month_name} {year_num}")

    # ── Earnings Table ──────────────────────────────────────────────────────
    def fmt(val) -> str:
        try:
            return f"Rs. {float(val):,.2f}"
        except (TypeError, ValueError):
            return "Rs. 0.00"

    pdf.set_xy(10, 82)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_fill_color(*PRIMARY_COLOR)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(95, 8, "  EARNINGS", fill=True)
    pdf.cell(95, 8, "  DEDUCTIONS", fill=True, ln=True)

    earnings = [
        ("Basic Salary", payroll.get("basic_salary", 0)),
        ("HRA", payroll.get("hra", 0)),
        ("Travel Allowance", payroll.get("travel_allowance", 0)),
        ("Special Allowance", payroll.get("special_allowance", 0)),
    ]
    deductions = [
        ("Professional Tax", payroll.get("pt_deduction", 200)),
        ("PF Deduction", payroll.get("pf_deduction", 0)),
        ("LOP Deduction", payroll.get("lop_deduction", 0)),
        ("Late Mark Deduction", payroll.get("late_mark_deduction", 0)),
    ]

    pdf.set_text_color(*DARK)
    pdf.set_font("Helvetica", "", 10)
    max_rows = max(len(earnings), len(deductions))
    for i in range(max_rows):
        fill = (i % 2 == 0)
        if fill:
            pdf.set_fill_color(248, 250, 252)
        else:
            pdf.set_fill_color(255, 255, 255)

        # Earnings column
        if i < len(earnings):
            label, val = earnings[i]
            pdf.cell(65, 7, f"  {label}", fill=fill)
            pdf.cell(30, 7, fmt(val), fill=fill, align="R")
        else:
            pdf.cell(95, 7, "", fill=fill)

        # Deductions column
        if i < len(deductions):
            label, val = deductions[i]
            pdf.cell(65, 7, f"  {label}", fill=fill)
            pdf.cell(30, 7, fmt(val), fill=fill, align="R", ln=True)
        else:
            pdf.cell(95, 7, "", fill=fill, ln=True)

    # ── Totals Row ──────────────────────────────────────────────────────────
    pdf.set_fill_color(226, 232, 240)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(65, 7, "  Gross Salary", fill=True)
    pdf.cell(30, 7, fmt(payroll.get("gross_salary", 0)), fill=True, align="R")
    pdf.cell(65, 7, "  Total Deductions", fill=True)
    pdf.cell(30, 7, fmt(payroll.get("total_deductions", 0)), fill=True, align="R", ln=True)

    # ── Net Pay ─────────────────────────────────────────────────────────────
    pdf.ln(4)
    pdf.set_fill_color(*GREEN)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(95, 12, "  NET PAY", fill=True)
    pdf.cell(95, 12, f"  {fmt(payroll.get('net_pay', 0))}", fill=True, align="R", ln=True)

    # ── Status ──────────────────────────────────────────────────────────────
    pdf.ln(4)
    pdf.set_text_color(*GRAY)
    pdf.set_font("Helvetica", "I", 9)
    status = str(payroll.get("status", "processed")).upper()
    pdf.cell(0, 6, f"Status: {status}", ln=True)

    # ── Footer ──────────────────────────────────────────────────────────────
    pdf.ln(10)
    pdf.set_draw_color(*GRAY)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*GRAY)
    pdf.cell(0, 5, "This is a computer-generated salary slip and does not require a signature.", ln=True, align="C")
    pdf.cell(0, 5, f"Generated for {month_name} {year_num} | {COMPANY_NAME}", ln=True, align="C")

    # Return as bytes
    buf = BytesIO()
    pdf_bytes = pdf.output()
    if isinstance(pdf_bytes, str):
        return pdf_bytes.encode("latin-1")
    return bytes(pdf_bytes)
