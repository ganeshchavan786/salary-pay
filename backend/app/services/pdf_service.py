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

        # Configuration & Company mapping
        company_data = payroll.get("company") or employee.get("company") or {}
        COMPANY_NAME = company_data.get("name") or payroll.get("company_name") or employee.get("company_name") or "SalaryPay HR Solutions"
        COMPANY_ADDRESS = company_data.get("address") or payroll.get("company_address") or employee.get("company_address") or "123 Business Hub, Pune, Maharashtra - 411045"
        
        # Color tokens matching Zoho Slate/Grey premium palette
        COLOR_PRIMARY = (15, 23, 42)      # Slate 900
        COLOR_TEXT_DARK = (15, 23, 42)    # Slate 900
        COLOR_TEXT_MUTED = (100, 116, 139) # Slate 500
        COLOR_BORDER = (220, 220, 220)    # Light gray borders

        month_num = int(payroll.get("month", 1))
        year_num = int(payroll.get("year", 2026))
        month_name = calendar.month_name[month_num]

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=10)

        # ── Outer Thin Border around entire page (margin 10mm) ──
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.set_line_width(0.2)
        pdf.rect(10, 10, 190, 277)

        # ── Header Section ──
        # Left side: Company Name & Address
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_xy(14, 14)
        pdf.cell(100, 6, safe_str(COMPANY_NAME))
        
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.set_xy(14, 20)
        pdf.cell(100, 5, safe_str(COMPANY_ADDRESS))
        
        # Right side: Styled Logo representation
        # Colors: Green, Orange, Blue, Red
        logo_colors = [(15, 157, 88), (244, 180, 0), (26, 115, 232), (219, 68, 85)]
        logo_positions = [(178, 14), (182, 14), (180, 17), (184, 17)]
        for idx, (px, py) in enumerate(logo_positions):
            pdf.set_fill_color(*logo_colors[idx])
            pdf.rect(px, py, 3.2, 3.2, "F")
            
        pdf.set_text_color(120, 120, 120)
        pdf.set_font("Helvetica", "B", 6.5)
        pdf.set_xy(176, 21.5)
        pdf.cell(16, 3, "SALARYPAY", align="C")

        # Top header bottom boundary line
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.line(10, 28, 200, 28)

        # ── Payslip Month Banner Subtitle ──
        pdf.set_fill_color(248, 250, 252) # light slate-50
        pdf.rect(10, 28, 190, 10, "F")
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_xy(10, 28)
        pdf.cell(190, 10, safe_str(f"Payslip for the month of {month_name} {year_num}"), align="C", border="B")

        # ── Employee Pay Summary block (y=38 to y=78) ──
        # Left: Info metadata
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_xy(14, 41)
        pdf.cell(0, 4, "EMPLOYEE PAY SUMMARY")

        # Format joining date
        joining_date_raw = employee.get("joining_date", "N/A")
        joining_date_str = joining_date_raw
        if joining_date_raw and "-" in joining_date_raw:
            try:
                parts = joining_date_raw.split("-")
                if len(parts) == 3:
                    joining_date_str = f"{parts[2]}/{parts[1]}/{parts[0]}"
            except:
                pass

        # Calculate pay date from paid_at or default
        from datetime import datetime
        pay_date_str = "N/A"
        paid_at = payroll.get("paid_at")
        if paid_at:
            try:
                dt = datetime.fromisoformat(str(paid_at).replace("Z", "+00:00"))
                pay_date_str = dt.strftime("%d/%m/%Y")
            except:
                pass
        
        if pay_date_str == "N/A":
            try:
                last_day = calendar.monthrange(year_num, month_num)[1]
                pay_date_str = f"{last_day:02d}/{month_num:02d}/{year_num}"
            except:
                pay_date_str = f"30/{month_num:02d}/{year_num}"

        emp_info_rows = [
            ("Employee Name", f"{employee.get('name', 'N/A')}, {employee.get('emp_code', 'N/A')}"),
            ("Designation", employee.get("designation", "N/A")),
            ("Date of Joining", joining_date_str),
            ("Pay Period", f"{month_name} {year_num}"),
            ("Pay Date", pay_date_str),
        ]

        # Draw left text info
        y_offset = 47
        for label, val in emp_info_rows:
            pdf.set_xy(14, y_offset)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.cell(30, 5, safe_str(label))
            pdf.cell(5, 5, ": ")
            pdf.set_font("Helvetica", "B", 8.5)
            pdf.cell(60, 5, safe_str(val))
            y_offset += 5.8

        # Paid days & LOP days calculations
        lop_days = payroll.get("lop_days")
        if lop_days is None:
            calc_details = payroll.get("calculation_details", {})
            lop_days = calc_details.get("lop_days")
        
        try:
            lop_days = float(lop_days or 0)
        except:
            lop_days = 0.0

        total_days = payroll.get("total_days")
        if total_days is None:
            try:
                total_days = calendar.monthrange(year_num, month_num)[1]
            except:
                total_days = 30
        else:
            try:
                total_days = int(total_days)
            except:
                total_days = 30
                
        paid_days = total_days - lop_days
        paid_days_str = f"{int(paid_days)}" if paid_days.is_integer() else f"{paid_days:.1f}"
        lop_days_str = f"{int(lop_days)}" if lop_days.is_integer() else f"{lop_days:.1f}"

        # Right: Large Net Pay and days info
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(*COLOR_TEXT_DARK)
        pdf.set_xy(112, 45)
        pdf.cell(88, 5, "Employee Net Pay", align="C")

        pdf.set_font("Helvetica", "B", 20)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_xy(112, 51)
        pdf.cell(88, 10, safe_str(f"Rs. {fmt(payroll.get('net_pay', 0))}"), align="C")

        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(*COLOR_TEXT_DARK)
        pdf.set_xy(112, 65)
        pdf.cell(88, 5, safe_str(f"Paid Days : {paid_days_str} | LOP Days : {lop_days_str}"), align="C")

        # Outer box vertical divider and bottom boundary
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.line(112, 38, 112, 78)
        pdf.line(10, 78, 200, 78)

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

        # Filter out 0 amounts
        earnings = [e for e in earnings if e[1] > 0]
        deductions = [d for d in deductions if d[1] > 0]

        # Table Column Headers
        pdf.set_fill_color(248, 250, 252) # light background
        pdf.rect(10, 78, 95, 8, "F")
        pdf.rect(105, 78, 95, 8, "F")

        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*COLOR_TEXT_DARK)
        
        pdf.set_xy(10, 78)
        pdf.cell(50, 8, "  EARNINGS", border="B", align="L")
        pdf.cell(20, 8, "AMOUNT  ", border="B", align="R")
        pdf.cell(25, 8, "YTD  ", border="B", align="R")
        
        pdf.set_xy(105, 78)
        pdf.cell(50, 8, "  DEDUCTIONS", border="B", align="L")
        pdf.cell(20, 8, "AMOUNT  ", border="B", align="R")
        pdf.cell(25, 8, "YTD  ", border="B", align="R")
        pdf.ln()

        # Calculate YTD multiplier based on April fiscal year start
        multiplier = month_num - 3 if month_num >= 4 else month_num + 9

        # Ensure symmetric vertical columns, pad shorter list
        max_rows = max(len(earnings), len(deductions), 4)
        
        start_y = 86
        pdf.set_y(start_y)
        for i in range(max_rows):
            pdf.set_x(10)
            
            # Left side: Earnings data
            if i < len(earnings):
                label_e = f"  {earnings[i][0]}"
                val_e = earnings[i][1]
                val_e_str = fmt(val_e) + "  "
                ytd_e = val_e * multiplier
                ytd_e_str = fmt(ytd_e) + "  "
            else:
                label_e = ""
                val_e_str = ""
                ytd_e_str = ""
                
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(50, 8, safe_str(label_e), border="B")
            pdf.cell(20, 8, safe_str(val_e_str), border="B", align="R")
            pdf.cell(25, 8, safe_str(ytd_e_str), border="B", align="R")
            
            # Right side: Deductions data
            if i < len(deductions):
                label_d = f"  {deductions[i][0]}"
                val_d = deductions[i][1]
                val_d_str = fmt(val_d) + "  "
                ytd_d = val_d * multiplier
                ytd_d_str = fmt(ytd_d) + "  "
            else:
                label_d = ""
                val_d_str = ""
                ytd_d_str = ""
                
            pdf.cell(50, 8, safe_str(label_d), border="B")
            pdf.cell(20, 8, safe_str(val_d_str), border="B", align="R")
            pdf.cell(25, 8, safe_str(ytd_d_str), border="B", align="R")
            pdf.ln()

        end_y = start_y + (max_rows * 8)

        # Totals Row
        pdf.set_x(10)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(50, 8, "  Gross Earnings", border="B")
        pdf.cell(20, 8, safe_str(fmt(payroll.get("gross_salary", 0)) + "  "), border="B", align="R")
        pdf.cell(25, 8, "", border="B")
        
        pdf.cell(50, 8, "  Total Deductions", border="B")
        pdf.cell(20, 8, safe_str(fmt(payroll.get("total_deductions", 0)) + "  "), border="B", align="R")
        pdf.cell(25, 8, "", border="B")

        # Vertical Divider Lines in the tables
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.line(60, 78, 60, end_y)
        pdf.line(80, 78, 80, end_y)
        pdf.line(105, 78, 105, end_y + 8)
        pdf.line(155, 78, 155, end_y)
        pdf.line(175, 78, 175, end_y)
        
        # Bottom table border line
        pdf.line(10, end_y + 8, 200, end_y + 8)

        # ── Net Pay Math Summary Block ──
        y_math = end_y + 14
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(10, y_math, 190, 8, "F")
        
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_xy(10, y_math)
        pdf.cell(145, 8, "  NET PAY", border="TB")
        pdf.cell(45, 8, "AMOUNT  ", border="TB", align="R")
        
        pdf.set_xy(10, y_math + 8)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(145, 8, "  Gross Earnings", border="B")
        pdf.cell(45, 8, safe_str(fmt(payroll.get("gross_salary", 0)) + "  "), border="B", align="R")
        
        pdf.set_xy(10, y_math + 16)
        pdf.cell(145, 8, "  Total Deductions", border="B")
        pdf.cell(45, 8, safe_str(f"(-) {fmt(payroll.get('total_deductions', 0))}  "), border="B", align="R")
        
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(10, y_math + 24, 190, 8, "F")
        pdf.set_xy(10, y_math + 24)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.cell(145, 8, "Total Net Payable  ", border="B", align="R")
        pdf.cell(45, 8, safe_str(f"Rs. {fmt(payroll.get('net_pay', 0))}  "), border="B", align="R")
        
        # Divider inside Net Pay math box
        pdf.line(155, y_math, 155, y_math + 32)

        # ── Centered Footnote & Words block ──
        words = str(payroll.get("net_pay_words", "Zero Only"))
        if not words.lower().startswith("indian rupee"):
            words = f"Indian Rupee {words}"

        y_foot = y_math + 38
        pdf.set_xy(10, y_foot)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*COLOR_TEXT_DARK)
        pdf.cell(190, 6, safe_str(f"Total Net Payable Rs. {fmt(payroll.get('net_pay', 0))} ({words})"), align="C")
        
        pdf.set_font("Helvetica", "I", 7.5)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.set_xy(10, y_foot + 6)
        pdf.cell(190, 5, "**Total Net Payable = Gross Earnings - Total Deductions", align="C")

        # ── Sign-free Declaration at Page Bottom ──
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(160, 160, 160)
        pdf.set_xy(10, 276)
        pdf.cell(190, 5, "-- This document has been automatically generated by SalaryPay; therefore, a signature is not required. --", align="C")

        return bytes(pdf.output())

    except Exception as e:
        with open("pdf_error.log", "w") as f:
            import traceback
            f.write(str(e))
            f.write("\n")
            f.write(traceback.format_exc())
        raise e
