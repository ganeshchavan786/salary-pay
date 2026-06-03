import calendar
from io import BytesIO
from typing import Optional

def generate_salary_slip(payroll: dict, employee: dict) -> bytes:
    try:
        from fpdf import FPDF
        
        # Helper functions
        def safe_str(text):
            if text is None: return "-"
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
        
        # Color tokens
        COLOR_PRIMARY   = (15, 23, 42)       # Slate 900
        COLOR_TEXT_DARK = (15, 23, 42)
        COLOR_TEXT_MUTED = (100, 116, 139)
        COLOR_BORDER    = (220, 220, 220)

        month_num  = int(payroll.get("month", 1))
        year_num   = int(payroll.get("year", 2026))
        month_name = calendar.month_name[month_num]

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=10)

        # ── Outer Border ──
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.set_line_width(0.2)
        pdf.rect(10, 10, 190, 277)

        # ── Header ──
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_xy(14, 14)
        pdf.cell(100, 6, safe_str(COMPANY_NAME))
        
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.set_xy(14, 20)
        pdf.cell(100, 5, safe_str(COMPANY_ADDRESS))
        
        # Logo squares (Google colours)
        logo_colors    = [(15, 157, 88), (244, 180, 0), (26, 115, 232), (219, 68, 85)]
        logo_positions = [(178, 14), (182, 14), (180, 17), (184, 17)]
        for idx, (px, py) in enumerate(logo_positions):
            pdf.set_fill_color(*logo_colors[idx])
            pdf.rect(px, py, 3.2, 3.2, "F")
            
        pdf.set_text_color(120, 120, 120)
        pdf.set_font("Helvetica", "B", 6.5)
        pdf.set_xy(176, 21.5)
        pdf.cell(16, 3, "SALARYPAY", align="C")

        pdf.set_draw_color(*COLOR_BORDER)
        pdf.line(10, 28, 200, 28)

        # ── Payslip Month Banner ──
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(10, 28, 190, 10, "F")
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_xy(10, 28)
        pdf.cell(190, 10, safe_str(f"Payslip for the month of {month_name} {year_num}"), align="C", border="B")

        # ── Employee Pay Summary block (y=38..90) ──
        # Title
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_xy(14, 41)
        pdf.cell(0, 4, "EMPLOYEE PAY SUMMARY")

        # Format joining date
        joining_date_raw = employee.get("joining_date", "N/A")
        joining_date_str = str(joining_date_raw) if joining_date_raw else "N/A"
        if joining_date_str and joining_date_str != "N/A" and "-" in joining_date_str:
            try:
                parts = joining_date_str.split("-")
                if len(parts) == 3:
                    joining_date_str = f"{parts[2]}/{parts[1]}/{parts[0]}"
            except:
                pass

        # Pay Date
        from datetime import datetime as dt
        pay_date_str = "N/A"
        paid_at = payroll.get("paid_at")
        if paid_at:
            try:
                d = dt.fromisoformat(str(paid_at).replace("Z", "+00:00"))
                pay_date_str = d.strftime("%d/%m/%Y")
            except:
                pass
        if pay_date_str == "N/A":
            try:
                last_day = calendar.monthrange(year_num, month_num)[1]
                pay_date_str = f"{last_day:02d}/{month_num:02d}/{year_num}"
            except:
                pay_date_str = f"30/{month_num:02d}/{year_num}"

        # ── Left column info rows (y starting 47) ──
        # Two sub-columns on the left (x=14..112)
        # Col1: labels+values  width=49
        # Col2: labels+values  width=49
        left_info_col1 = [
            ("Employee Code",   employee.get("emp_code", "N/A")),
            ("Date of Joining", joining_date_str),
            ("Aadhaar No",      employee.get("aadhaar_no", "-")),
            ("Employee Name",   employee.get("name", "N/A")),
            ("Location",        employee.get("location", "-")),
            ("Working Days",    str(payroll.get("working_days", payroll.get("total_days", 30)))),
        ]
        left_info_col2 = [
            ("Designation",     employee.get("designation", "-")),
            ("UAN No",          employee.get("uan_no", "-")),
            ("Present Days",    str(payroll.get("present_days", payroll.get("total_days", 30)))),
            ("PF No",           employee.get("pf_no", "-")),
            ("ESI No",          employee.get("esi_no", "-")),
            ("PAN No",          employee.get("pan_no", "-")),
        ]

        row_h = 5.5
        y_start = 47

        for i, ((lbl1, val1), (lbl2, val2)) in enumerate(zip(left_info_col1, left_info_col2)):
            y_row = y_start + i * row_h

            # --- Col 1 ---
            pdf.set_xy(14, y_row)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(26, row_h, safe_str(lbl1))
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.set_font("Helvetica", "B", 7.5)
            pdf.cell(2, row_h, ":")
            pdf.cell(20, row_h, safe_str(val1))

            # --- Col 2 ---
            pdf.set_xy(62, y_row)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(26, row_h, safe_str(lbl2))
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.set_font("Helvetica", "B", 7.5)
            pdf.cell(2, row_h, ":")
            pdf.cell(22, row_h, safe_str(val2))

        # ── Right side: Net Pay box ──
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
        lop_days_str  = f"{int(lop_days)}"  if lop_days.is_integer()  else f"{lop_days:.1f}"

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

        # Dividers: vertical separator and bottom of summary block
        summary_bottom = y_start + 6 * row_h + 2  # ends just below last row
        summary_bottom = max(summary_bottom, 82)

        pdf.set_draw_color(*COLOR_BORDER)
        pdf.line(112, 38, 112, summary_bottom)
        pdf.line(10, summary_bottom, 200, summary_bottom)

        # ── Earnings & Deductions tables ──
        raw_earnings = payroll.get("earnings")
        if isinstance(raw_earnings, list):
            earnings = [(item.get("label", "Earnings"), float(item.get("amount") or 0)) for item in raw_earnings]
        else:
            earnings = [
                ("Basic Salary",       payroll.get("basic_salary", 0)),
                ("HRA",                payroll.get("hra", 0)),
                ("Special Allowance",  payroll.get("special_allowance", 0)),
                ("Travel Allowance",   payroll.get("travel_allowance", 0)),
                ("Medical Allowance",  payroll.get("medical_allowance", 0)),
                ("Overtime",           payroll.get("overtime_amount", 0)),
            ]
            if payroll.get("arrears_amount", 0) > 0:
                earnings.append(("Arrears", payroll.get("arrears_amount", 0)))
                
        raw_deductions = payroll.get("deductions")
        if isinstance(raw_deductions, list):
            deductions = [(item.get("label", "Deduction"), float(item.get("amount") or 0)) for item in raw_deductions]
        else:
            deductions = [
                ("Income Tax (TDS)",   payroll.get("income_tax", 0)),
                ("Provident Fund (PF)",payroll.get("pf_deduction", 0)),
                ("Professional Tax",   payroll.get("pt_deduction", 0)),
                ("ESI",                payroll.get("esi_employee", 0)),
                ("Loan / Advance",     payroll.get("loan_deductions", 0)),
                ("LOP Deduction",      payroll.get("lop_deduction", 0)),
            ]

        # Filter zero amounts
        earnings   = [e for e in earnings   if float(e[1] or 0) > 0]
        deductions = [d for d in deductions if float(d[1] or 0) > 0]

        table_y = summary_bottom

        # Table Headers (no YTD)
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(10,  table_y, 95, 8, "F")
        pdf.rect(105, table_y, 95, 8, "F")

        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*COLOR_TEXT_DARK)
        
        pdf.set_xy(10, table_y)
        pdf.cell(68, 8, "  EARNINGS", border="B", align="L")
        pdf.cell(27, 8, "AMOUNT  ",   border="B", align="R")
        
        pdf.set_xy(105, table_y)
        pdf.cell(68, 8, "  DEDUCTIONS", border="B", align="L")
        pdf.cell(27, 8, "AMOUNT  ",    border="B", align="R")
        pdf.ln()

        max_rows = max(len(earnings), len(deductions), 4)
        start_y  = table_y + 8
        pdf.set_y(start_y)

        for i in range(max_rows):
            pdf.set_x(10)

            # Earnings row
            if i < len(earnings):
                label_e = f"  {earnings[i][0]}"
                val_e   = f"{fmt(earnings[i][1])}  "
            else:
                label_e = ""; val_e = ""

            pdf.set_font("Helvetica", "", 8)
            pdf.cell(68, 8, safe_str(label_e), border="B")
            pdf.cell(27, 8, safe_str(val_e),   border="B", align="R")

            # Deductions row
            if i < len(deductions):
                label_d = f"  {deductions[i][0]}"
                val_d   = f"{fmt(deductions[i][1])}  "
            else:
                label_d = ""; val_d = ""

            pdf.cell(68, 8, safe_str(label_d), border="B")
            pdf.cell(27, 8, safe_str(val_d),   border="B", align="R")
            pdf.ln()

        end_y = start_y + (max_rows * 8)

        # Totals row
        pdf.set_x(10)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(68, 8, "  Gross Earnings",   border="B")
        pdf.cell(27, 8, safe_str(fmt(payroll.get("gross_salary", 0)) + "  "), border="B", align="R")
        pdf.cell(68, 8, "  Total Deductions", border="B")
        pdf.cell(27, 8, safe_str(fmt(payroll.get("total_deductions", 0)) + "  "), border="B", align="R")

        # Vertical dividers in table (only 3 lines now, no YTD)
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.line(78,  table_y, 78,  end_y)        # earnings label/amount split
        pdf.line(105, table_y, 105, end_y + 8)    # table centre divider
        pdf.line(173, table_y, 173, end_y)        # deductions label/amount split

        # Bottom table border
        pdf.line(10, end_y + 8, 200, end_y + 8)

        # ── Net Pay Math Block ──
        y_math = end_y + 14
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(10, y_math, 190, 8, "F")
        
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_xy(10, y_math)
        pdf.cell(145, 8, "  NET PAY",  border="TB")
        pdf.cell(45,  8, "AMOUNT  ",   border="TB", align="R")
        
        pdf.set_xy(10, y_math + 8)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(145, 8, "  Gross Earnings", border="B")
        pdf.cell(45,  8, safe_str(fmt(payroll.get("gross_salary", 0)) + "  "), border="B", align="R")
        
        pdf.set_xy(10, y_math + 16)
        pdf.cell(145, 8, "  Total Deductions", border="B")
        pdf.cell(45,  8, safe_str(f"(-) {fmt(payroll.get('total_deductions', 0))}  "), border="B", align="R")
        
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(10, y_math + 24, 190, 8, "F")
        pdf.set_xy(10, y_math + 24)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.cell(145, 8, "Total Net Payable  ",   border="B", align="R")
        pdf.cell(45,  8, safe_str(f"Rs. {fmt(payroll.get('net_pay', 0))}  "), border="B", align="R")
        
        pdf.line(155, y_math, 155, y_math + 32)

        # ── Footnote ──
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

        # ── Attendance Summary Box ──
        att_records = payroll.get("attendance_records", [])
        
        # Count from attendance records
        att_halfday = sum(1 for r in att_records if r.get("status") == "halfday")
        att_late    = sum(1 for r in att_records if r.get("is_late"))
        att_total   = int(payroll.get("total_days", 30))
        att_working = int(payroll.get("working_days", 30))
        att_present = int(payroll.get("present_days", 0))
        att_absent  = int(payroll.get("absent_days", 0))

        y_att = y_foot + 14
        box_h = 14
        pdf.set_draw_color(*COLOR_BORDER)
        pdf.set_line_width(0.3)
        pdf.rect(10, y_att, 190, box_h)

        # Row 1
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        row1_y = y_att + 1
        items_row1 = [
            f"Total Days: {att_total}",
            f"Working: {att_working}",
            f"Present: {att_present}",
        ]
        col_w = 63
        for idx, txt in enumerate(items_row1):
            x = 14 + idx * col_w
            pdf.set_xy(x, row1_y)
            # Box symbol
            pdf.set_font("Helvetica", "", 7)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(3, 6, safe_str(chr(9744)))  # ☐ ballot box
            pdf.set_font("Helvetica", "B", 7.5)
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.cell(55, 6, safe_str(txt))

        # Row 2
        row2_y = y_att + 7.5
        items_row2 = [
            f"Absent: {att_absent}",
            f"Half Day: {att_halfday}",
            f"Late/Early: {att_late}",
        ]
        for idx, txt in enumerate(items_row2):
            x = 14 + idx * col_w
            pdf.set_xy(x, row2_y)
            pdf.set_font("Helvetica", "", 7)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(3, 6, safe_str(chr(9744)))
            pdf.set_font("Helvetica", "B", 7.5)
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.cell(55, 6, safe_str(txt))

        # ── Footer ──
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(160, 160, 160)
        pdf.set_xy(10, 276)
        pdf.cell(190, 5, "-- This document has been automatically generated by SalaryPay; therefore, a signature is not required. --", align="C")

        # ── Page 2: Attendance Detail Table ──
        if att_records:
            from datetime import datetime as _dt
            import calendar as _cal

            pdf.add_page()
            pdf.set_auto_page_break(auto=True, margin=10)

            # Outer border
            pdf.set_draw_color(*COLOR_BORDER)
            pdf.set_line_width(0.2)
            pdf.rect(10, 10, 190, 277)

            # Header
            pdf.set_text_color(*COLOR_PRIMARY)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_xy(14, 14)
            pdf.cell(182, 7, safe_str(f"Attendance Detail - {month_name} {year_num}"), align="C")

            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.set_xy(14, 22)
            pdf.cell(182, 5, safe_str(f"{employee.get('name', '')}  |  {employee.get('emp_code', '')}"), align="C")

            pdf.set_draw_color(*COLOR_BORDER)
            pdf.line(10, 30, 200, 30)

            # Table header
            t_y = 32
            col_widths = [20, 14, 28, 28, 22, 22, 22, 34]  # total=190
            headers    = ["Date", "Day", "Check In", "Check Out", "Work Hrs", "OT Hrs", "Status", "Remark"]

            pdf.set_fill_color(248, 250, 252)
            pdf.rect(10, t_y, 190, 7, "F")
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(*COLOR_TEXT_DARK)
            x_pos = 10
            for ci, hdr in enumerate(headers):
                pdf.set_xy(x_pos, t_y)
                pdf.cell(col_widths[ci], 7, safe_str(f" {hdr}"), border="B")
                x_pos += col_widths[ci]

            # Table rows
            row_y = t_y + 7
            row_h = 6
            DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

            for rec in att_records:
                if row_y > 275:
                    pdf.add_page()
                    pdf.set_draw_color(*COLOR_BORDER)
                    pdf.set_line_width(0.2)
                    pdf.rect(10, 10, 190, 277)
                    row_y = 14

                # Parse day name
                day_name = ""
                try:
                    d = _dt.strptime(rec["date"], "%Y-%m-%d")
                    day_name = DAY_NAMES[d.weekday()]
                except:
                    pass

                # Date formatted
                date_display = rec["date"]
                try:
                    d = _dt.strptime(rec["date"], "%Y-%m-%d")
                    date_display = d.strftime("%d %b")
                except:
                    pass

                status_val = str(rec.get("status", "-"))

                # Status-based row coloring
                if status_val in ("absent",):
                    pdf.set_fill_color(254, 242, 242)  # light red
                    pdf.rect(10, row_y, 190, row_h, "F")
                elif status_val in ("weeklyoff", "holiday"):
                    pdf.set_fill_color(245, 245, 245)  # light gray
                    pdf.rect(10, row_y, 190, row_h, "F")
                elif status_val == "halfday":
                    pdf.set_fill_color(255, 251, 235)  # light yellow
                    pdf.rect(10, row_y, 190, row_h, "F")

                # Remark
                remark = ""
                if rec.get("is_late"):
                    remark = "Late"

                row_data = [
                    date_display,
                    day_name,
                    rec.get("check_in", "-"),
                    rec.get("check_out", "-"),
                    str(rec.get("work_hours", "-")),
                    str(rec.get("ot_hours", "-")),
                    status_val.capitalize(),
                    remark,
                ]

                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*COLOR_TEXT_DARK)
                x_pos = 10
                for ci, cell_val in enumerate(row_data):
                    pdf.set_xy(x_pos, row_y)
                    pdf.cell(col_widths[ci], row_h, safe_str(f" {cell_val}"), border="B")
                    x_pos += col_widths[ci]

                row_y += row_h

            # Attendance Summary Box at bottom of Page 2
            if row_y < 260:
                sum_y = row_y + 5
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_text_color(*COLOR_PRIMARY)
                pdf.set_xy(10, sum_y)
                pdf.cell(190, 6, "ATTENDANCE SUMMARY", align="C")

                sum_y += 8
                box_items = [
                    ("Total Days", att_total),
                    ("Working", att_working),
                    ("Present", att_present),
                    ("Absent", att_absent),
                    ("Half Day", att_halfday),
                    ("Late", att_late),
                ]
                box_w = 31
                for bi, (blbl, bval) in enumerate(box_items):
                    bx = 10 + bi * box_w + 1
                    pdf.set_draw_color(*COLOR_BORDER)
                    pdf.rect(bx, sum_y, box_w - 2, 16)
                    pdf.set_font("Helvetica", "B", 12)
                    pdf.set_text_color(*COLOR_PRIMARY)
                    pdf.set_xy(bx, sum_y + 1)
                    pdf.cell(box_w - 2, 8, safe_str(str(bval)), align="C")
                    pdf.set_font("Helvetica", "", 6.5)
                    pdf.set_text_color(*COLOR_TEXT_MUTED)
                    pdf.set_xy(bx, sum_y + 9)
                    pdf.cell(box_w - 2, 5, safe_str(blbl), align="C")

        return bytes(pdf.output())

    except Exception as e:
        with open("pdf_error.log", "w") as f:
            import traceback
            f.write(str(e))
            f.write("\n")
            f.write(traceback.format_exc())
        raise e
