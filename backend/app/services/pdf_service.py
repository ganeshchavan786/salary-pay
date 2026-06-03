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
        
        # Slate 900 primary, Slate 50 background cards, Teal 600 accents
        COLOR_PRIMARY = (15, 23, 42)
        COLOR_ACCENT = (13, 148, 136)
        COLOR_SECONDARY = (241, 245, 249)
        COLOR_TEXT_DARK = (15, 23, 42)
        COLOR_TEXT_MUTED = (100, 116, 139)
        COLOR_BORDER = (226, 232, 240)

        month_num = int(payroll.get("month", 1))
        year_num = int(payroll.get("year", 2026))
        month_name = calendar.month_name[month_num]

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # ── Header (Deep Slate Banner with bottom Teal border) ──
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.rect(0, 0, 210, 42, "F")
        
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.rect(0, 42, 210, 3, "F")
        
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_xy(15, 12)
        pdf.cell(0, 10, safe_str(COMPANY_NAME))
        
        pdf.set_font("Helvetica", "", 9)
        pdf.set_xy(15, 23)
        pdf.cell(0, 5, safe_str(COMPANY_ADDRESS))
        
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_xy(150, 15)
        pdf.cell(45, 10, "PAYSLIP", align="R")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_xy(150, 23)
        pdf.cell(45, 5, safe_str(f"{month_name} {year_num}"), align="R")

        # ── Employee Info Box Card ──
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.set_fill_color(248, 250, 252) # slate-50
        pdf.rect(15, 52, 180, 45, "DF")

        # Card Header Label
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_xy(20, 56)
        pdf.cell(0, 5, "EMPLOYEE INFORMATION")

        details = [
            ("Employee Name", employee.get("name", "N/A"), "Bank Name", employee.get("bank_name", "N/A")),
            ("Employee Code", employee.get("emp_code", "N/A"), "Account No", employee.get("account_no", "N/A")),
            ("Department", employee.get("department", "N/A"), "IFSC Code", employee.get("ifsc_code", "N/A")),
            ("Designation", employee.get("designation", "N/A"), "PAN No", employee.get("pan_no", "N/A")),
            ("Joining Date", employee.get("joining_date", "N/A"), "Aadhaar No", employee.get("aadhaar_no", "N/A")),
        ]

        pdf.set_y(63)
        for label1, val1, label2, val2 in details:
            pdf.set_x(20)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(32, 6, safe_str(f"{label1}:"))
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(58, 6, safe_str(val1))
            
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(32, 6, safe_str(f"{label2}:"))
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(58, 6, safe_str(val2))
            pdf.ln()

        # ── Earnings & Deductions Dynamic Resolution ──
        raw_earnings = payroll.get("earnings")
        if isinstance(raw_earnings, list):
            earnings = []
            for item in raw_earnings:
                earnings.append((item.get("label", "Earnings Item"), float(item.get("amount") or 0)))
        else:
            earnings = [
                ("Basic Salary", payroll.get("basic_salary", 0)),
                ("HRA", payroll.get("hra", 0)),
                ("Special Allowance", payroll.get("special_allowance", 0)),
                ("Travel Allowance", payroll.get("travel_allowance", 0)),
                ("Medical Allowance", payroll.get("medical_allowance", 0)),
                ("Overtime", payroll.get("overtime_amount", 0)),
            ]
            if payroll.get("arrears_amount", 0) > 0:
                earnings.append(("Arrears", payroll.get("arrears_amount", 0)))
                
        raw_deductions = payroll.get("deductions")
        if isinstance(raw_deductions, list):
            deductions = []
            for item in raw_deductions:
                deductions.append((item.get("label", "Deductions Item"), float(item.get("amount") or 0)))
        else:
            deductions = [
                ("Income Tax (TDS)", payroll.get("income_tax", 0)),
                ("Provident Fund (PF)", payroll.get("pf_deduction", 0)),
                ("Professional Tax (PT)", payroll.get("pt_deduction", 0)),
                ("ESI", payroll.get("esi_employee", 0)),
                ("Loan / Advance", payroll.get("loan_deductions", 0)),
                ("LOP Deduction", payroll.get("lop_deduction", 0)),
            ]

        # Filter out 0 amounts to keep it extremely clean
        earnings = [e for e in earnings if e[1] > 0]
        deductions = [d for d in deductions if d[1] > 0]

        # Table Column Headers
        pdf.ln(10)
        pdf.set_x(15)
        pdf.set_fill_color(*COLOR_SECONDARY)
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLOR_TEXT_DARK)
        
        pdf.cell(65, 10, "  EARNINGS", fill=True, border="TB")
        pdf.cell(25, 10, "AMOUNT  ", fill=True, border="TB", align="R")
        pdf.cell(65, 10, "  DEDUCTIONS", fill=True, border="TB")
        pdf.cell(25, 10, "AMOUNT  ", fill=True, border="TB", align="R")
        pdf.ln()

        pdf.set_text_color(*COLOR_TEXT_DARK)
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
        end_y = pdf.get_y()

        # Vertical Divider Line between Earnings & Deductions
        pdf.set_draw_color(203, 213, 225) # slate-300
        pdf.line(105, start_y, 105, end_y)

        # ── Totals ──
        pdf.set_fill_color(248, 250, 252) # slate-50
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_x(15)
        pdf.cell(65, 10, "  GROSS EARNINGS", fill=True, border="B")
        pdf.cell(25, 10, fmt(payroll.get("gross_salary", 0)), fill=True, border="B", align="R")
        pdf.cell(65, 10, "  TOTAL DEDUCTIONS", fill=True, border="B")
        pdf.cell(25, 10, fmt(payroll.get("total_deductions", 0)), fill=True, border="B", align="R")
        pdf.ln()
        
        # Extend vertical divider line through totals
        pdf.line(105, end_y, 105, end_y + 10)

        # ── Net Pay Callout Banner ──
        pdf.ln(8)
        pdf.set_x(15)
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(90, 14, "  NET TAKE HOME (NET PAY)", fill=True)
        pdf.cell(90, 14, f"  Rs. {fmt(payroll.get('net_pay', 0))}  ", fill=True, align="R")
        pdf.ln()

        pdf.set_x(15)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.set_font("Helvetica", "I", 8.5)
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
