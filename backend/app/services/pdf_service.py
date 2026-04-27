import calendar
from io import BytesIO
from typing import Optional

def generate_salary_slip(payroll: dict, employee: dict) -> bytes:
    try:
        from fpdf import FPDF
        
        # Helper functions
        def safe_str(text):
            if text is None: return "-"
            # Replace special dashes and characters not in latin-1
            t = str(text).replace("\u2014", "-").replace("\u2013", "-")
            return t.encode('latin-1', 'replace').decode('latin-1')

        def fmt(val):
            try: return f"{float(val or 0):,.2f}"
            except: return "0.00"
            
        def safe_add(*vals):
            return sum(float(v or 0) for v in vals)

        # Configuration
        COMPANY_NAME = "SalaryPay HR Solutions"
        COMPANY_ADDRESS = "123 Business Hub, Pune, Maharashtra - 411045"
        PRIMARY_COLOR = (30, 58, 138)
        SECONDARY_COLOR = (243, 244, 246)
        ACCENT_COLOR = (5, 150, 105)
        TEXT_DARK = (31, 41, 55)
        TEXT_GRAY = (107, 114, 128)

        month_num = int(payroll.get("month", 1))
        year_num = int(payroll.get("year", 2026))
        month_name = calendar.month_name[month_num]

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # ── Header ──
        pdf.set_fill_color(*PRIMARY_COLOR)
        pdf.rect(0, 0, 210, 40, "F")
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_xy(15, 12)
        pdf.cell(0, 10, safe_str(COMPANY_NAME))
        
        pdf.set_font("Helvetica", "", 9)
        pdf.set_xy(15, 22)
        pdf.cell(0, 5, safe_str(COMPANY_ADDRESS))
        
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_xy(150, 15)
        pdf.cell(45, 10, "PAYSLIP", align="R")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_xy(150, 22)
        pdf.cell(45, 5, safe_str(f"{month_name} {year_num}"), align="R")

        # ── Employee Info ──
        pdf.set_text_color(*TEXT_DARK)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_xy(15, 48)
        pdf.cell(0, 8, "EMPLOYEE INFORMATION")
        pdf.line(15, 56, 195, 56)

        details = [
            ("Employee Name", employee.get("name", "N/A"), "Bank Name", employee.get("bank_name", "N/A")),
            ("Employee Code", employee.get("emp_code", "N/A"), "Account No", employee.get("account_no", "N/A")),
            ("Department", employee.get("department", "N/A"), "IFSC Code", employee.get("ifsc_code", "N/A")),
            ("Designation", employee.get("designation", "N/A"), "PAN No", employee.get("pan_no", "N/A")),
            ("Joining Date", employee.get("joining_date", "N/A"), "Aadhaar No", employee.get("aadhaar_no", "N/A")),
        ]

        pdf.set_y(60)
        pdf.set_font("Helvetica", "", 9)
        for label1, val1, label2, val2 in details:
            pdf.set_x(15)
            pdf.set_text_color(*TEXT_GRAY)
            pdf.cell(35, 7, safe_str(f"{label1}:"))
            pdf.set_text_color(*TEXT_DARK)
            pdf.cell(55, 7, safe_str(val1))
            pdf.set_text_color(*TEXT_GRAY)
            pdf.cell(35, 7, safe_str(f"{label2}:"))
            pdf.set_text_color(*TEXT_DARK)
            pdf.cell(55, 7, safe_str(val2))
            pdf.ln()

        # ── Earnings & Deductions ──
        pdf.ln(10)
        pdf.set_x(15)
        pdf.set_fill_color(*SECONDARY_COLOR)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(90, 10, "  EARNINGS", fill=True)
        pdf.cell(90, 10, "  DEDUCTIONS", fill=True)
        pdf.ln()

        earnings = [
            ("Basic Salary", payroll.get("basic_salary", 0)),
            ("HRA", payroll.get("hra", 0)),
            ("Special Allowance", payroll.get("special_allowance", 0)),
            ("Travel Allowance", payroll.get("travel_allowance", 0)),
            ("Medical Allowance", payroll.get("medical_allowance", 0)),
            ("Overtime / Arrears", safe_add(payroll.get("overtime_amount"), payroll.get("arrears_amount"))),
        ]
        deductions = [
            ("Income Tax (TDS)", payroll.get("income_tax", 0)),
            ("Provident Fund (PF)", payroll.get("pf_deduction", 0)),
            ("Professional Tax (PT)", payroll.get("pt_deduction", 0)),
            ("ESI", payroll.get("esi_employee", 0)),
            ("Loan / Advance", payroll.get("loan_deductions", 0)),
            ("LOP Deduction", payroll.get("lop_deduction", 0)),
        ]

        pdf.set_text_color(*TEXT_DARK)
        pdf.set_font("Helvetica", "", 9)
        max_rows = max(len(earnings), len(deductions))
        
        start_y = pdf.get_y()
        for i in range(max_rows):
            pdf.set_x(15)
            # Earnings col
            if i < len(earnings):
                pdf.cell(65, 8, safe_str(earnings[i][0]), border="B")
                pdf.cell(25, 8, fmt(earnings[i][1]), border="B", align="R")
            else:
                pdf.cell(90, 8, "", border="B")
            
            # Deductions col
            if i < len(deductions):
                pdf.cell(65, 8, safe_str(deductions[i][0]), border="B")
                pdf.cell(25, 8, fmt(deductions[i][1]), border="B", align="R")
            else:
                pdf.cell(90, 8, "", border="B")
            pdf.ln()

        # ── Totals ──
        pdf.set_fill_color(249, 250, 251)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_x(15)
        pdf.cell(65, 10, "  GROSS EARNINGS", fill=True)
        pdf.cell(25, 10, fmt(payroll.get("gross_salary", 0)), fill=True, align="R")
        pdf.cell(65, 10, "  TOTAL DEDUCTIONS", fill=True)
        pdf.cell(25, 10, fmt(payroll.get("total_deductions", 0)), fill=True, align="R")
        pdf.ln()

        # ── Net Pay ──
        pdf.ln(10)
        pdf.set_x(15)
        pdf.set_fill_color(*ACCENT_COLOR)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(90, 15, "  NET TAKE HOME", fill=True)
        pdf.cell(90, 15, f"  Rs. {fmt(payroll.get('net_pay', 0))}  ", fill=True, align="R")
        pdf.ln()

        pdf.set_x(15)
        pdf.set_text_color(*TEXT_GRAY)
        pdf.set_font("Helvetica", "I", 8)
        pdf.cell(0, 8, safe_str(f"Amount in words: Rupees {payroll.get('net_pay_words', 'Zero Only')}"))

        # ── Footer ──
        pdf.set_y(260)
        pdf.set_x(15)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(0, 5, safe_str("This is a computer generated document and does not require a physical signature."), align="C", ln=True)
        pdf.cell(0, 5, safe_str(f"© {year_num} {COMPANY_NAME} | Secure Payroll Service"), align="C")

        return bytes(pdf.output())

    except Exception as e:
        with open("pdf_error.log", "w") as f:
            import traceback
            f.write(str(e))
            f.write("\n")
            f.write(traceback.format_exc())
        raise e
