"""
UI Test HTML Report Generator
==============================
Run: python src/tests/UI_test/generate_ui_report.py
"""
import json
import os
import subprocess
import sys
import webbrowser
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ADMIN_DIR = os.path.join(SCRIPT_DIR, '..', '..', '..', '..')
ADMIN_DIR = os.path.normpath(ADMIN_DIR)
JSON_PATH = os.path.join(SCRIPT_DIR, 'ui_test_results.json')
REPORT_PATH = os.path.join(SCRIPT_DIR, 'ui_test_report.html')

SECTION_NAMES = {
    'test_01_login_ui.test.jsx':        '🔐 Section 1: Login Page',
    'test_02_attendance_ui.test.jsx':   '📅 Section 2: Attendance Page',
    'test_03_leave_ui.test.jsx':        '🏖️ Section 3: Leave Management',
    'test_04_payhead_ui.test.jsx':      '💼 Section 4: Payhead Configuration',
    'test_05_salary_calc_ui.test.jsx':  '💰 Section 5: Salary Calculation',
}


def run_tests():
    print("🔄 Running UI tests...")
    subprocess.run(
        ["npx", "vitest", "run", "src/tests/UI_test/",
         "--reporter=json", f"--outputFile={JSON_PATH}"],
        cwd=ADMIN_DIR,
        shell=True,
    )


def load_results():
    if not os.path.exists(JSON_PATH):
        return []
    with open(JSON_PATH, encoding='utf-8') as f:
        data = json.load(f)

    tests = []
    for suite in data.get('testResults', []):
        file_name = suite.get('name', '').replace('\\', '/').split('/')[-1]
        for t in suite.get('assertionResults', []):
            tests.append({
                'file': file_name,
                'display_name': t.get('title', ''),
                'status': 'PASSED' if t.get('status') == 'passed' else 'FAILED',
                'duration': round(t.get('duration') or 0),
                'error': '\n'.join(t.get('failureMessages', []))[:300],
            })
    return tests


def generate_html(tests):
    total = len(tests)
    passed = sum(1 for t in tests if t['status'] == 'PASSED')
    failed = total - passed
    pass_rate = round(passed / total * 100, 1) if total else 0
    now = datetime.now().strftime('%d %B %Y, %I:%M %p')
    overall_ok = failed == 0
    overall_color = '#10b981' if overall_ok else '#ef4444'
    overall_text = 'ALL PASS ✅' if overall_ok else f'{failed} FAILED ❌'

    # Group by file
    from collections import OrderedDict
    sections = OrderedDict()
    for t in tests:
        sections.setdefault(t['file'], []).append(t)

    sections_html = ''
    for file_name, file_tests in sections.items():
        sp = sum(1 for t in file_tests if t['status'] == 'PASSED')
        st = len(file_tests)
        sc = '#10b981' if sp == st else '#ef4444'
        sn = SECTION_NAMES.get(file_name, file_name)

        rows = ''
        for i, t in enumerate(file_tests):
            is_pass = t['status'] == 'PASSED'
            badge = '<span class="badge pass">✅ PASS</span>' if is_pass else '<span class="badge fail">❌ FAIL</span>'
            err_html = f'<div class="err-msg">{t["error"]}</div>' if t['error'] else ''
            row_class = 'pass-row' if is_pass else 'fail-row'
            rows += f'''
            <tr class="{row_class}">
              <td class="num">{i+1}</td>
              <td class="tname">{t["display_name"]}</td>
              <td class="tstatus">{badge}</td>
              <td class="tdur">{t["duration"]}ms</td>
              <td class="terr">{err_html}</td>
            </tr>'''

        sections_html += f'''
        <div class="section-card">
          <div class="section-header" style="border-left:5px solid {sc}">
            <div class="section-title">{sn}</div>
            <div class="section-badge" style="background:{sc}">{sp}/{st} passed</div>
          </div>
          <table class="test-table">
            <thead><tr><th>#</th><th>Test</th><th>Status</th><th>Time</th><th>Error</th></tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>'''

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Test Report — Admin Panel</title>
  <style>
    *{{margin:0;padding:0;box-sizing:border-box}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;padding:24px}}
    .header{{background:linear-gradient(135deg,#1e293b,#334155);color:white;border-radius:16px;padding:32px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}}
    .header h1{{font-size:26px;font-weight:700;margin-bottom:4px}}
    .header p{{color:#94a3b8;font-size:13px}}
    .overall{{font-size:20px;font-weight:700;color:{overall_color};background:rgba(255,255,255,.1);padding:12px 24px;border-radius:12px;border:2px solid {overall_color}}}
    .summary{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}}
    .card{{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}}
    .card-value{{font-size:36px;font-weight:800;margin-bottom:4px}}
    .card-label{{font-size:13px;color:#64748b;font-weight:500}}
    .card.total .card-value{{color:#3b82f6}}
    .card.pass .card-value{{color:#10b981}}
    .card.fail .card-value{{color:#ef4444}}
    .card.rate .card-value{{color:#8b5cf6}}
    .progress-wrap{{background:white;border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)}}
    .progress-label{{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;font-weight:600}}
    .progress-bar{{height:12px;background:#e2e8f0;border-radius:99px;overflow:hidden}}
    .progress-fill{{height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:99px;width:{pass_rate}%}}
    .section-card{{background:white;border-radius:12px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden}}
    .section-header{{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0}}
    .section-title{{font-size:16px;font-weight:700}}
    .section-badge{{color:white;font-size:13px;font-weight:600;padding:4px 12px;border-radius:99px}}
    .test-table{{width:100%;border-collapse:collapse}}
    .test-table th{{background:#f1f5f9;padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em}}
    .test-table td{{padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;vertical-align:top}}
    .pass-row{{background:#f0fdf4}}
    .fail-row{{background:#fef2f2}}
    .num{{color:#94a3b8;font-size:12px;width:32px}}
    .tname{{font-weight:500;color:#1e293b}}
    .tstatus{{width:100px}}
    .tdur{{color:#94a3b8;font-size:12px;width:70px}}
    .badge{{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700}}
    .badge.pass{{background:#dcfce7;color:#16a34a}}
    .badge.fail{{background:#fee2e2;color:#dc2626}}
    .err-msg{{font-family:monospace;font-size:11px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:4px;white-space:pre-wrap;max-width:400px}}
    .footer{{text-align:center;color:#94a3b8;font-size:13px;margin-top:32px;padding:16px}}
    @media(max-width:768px){{.summary{{grid-template-columns:repeat(2,1fr)}}.header{{flex-direction:column;gap:16px;text-align:center}}}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🖥️ UI Test Report — Admin Panel</h1>
      <p>Face Recognition Attendance PWA · React + Vitest</p>
      <p style="margin-top:6px;color:#cbd5e1">Generated: {now}</p>
    </div>
    <div class="overall">{overall_text}</div>
  </div>

  <div class="summary">
    <div class="card total"><div class="card-value">{total}</div><div class="card-label">Total Tests</div></div>
    <div class="card pass"><div class="card-value">{passed}</div><div class="card-label">Passed ✅</div></div>
    <div class="card fail"><div class="card-value">{failed}</div><div class="card-label">Failed ❌</div></div>
    <div class="card rate"><div class="card-value">{pass_rate}%</div><div class="card-label">Pass Rate</div></div>
  </div>

  <div class="progress-wrap">
    <div class="progress-label"><span>Test Progress</span><span>{passed} / {total} tests passing</span></div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>

  {sections_html}

  <div class="footer">Admin Panel UI Tests · {now}</div>
</body>
</html>'''


def main():
    run_tests()
    tests = load_results()

    if not tests:
        print("⚠️  No results found in JSON. Check if tests ran.")
        return

    html = generate_html(tests)
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(html)

    passed = sum(1 for t in tests if t['status'] == 'PASSED')
    total = len(tests)

    print(f"\n{'='*60}")
    print(f"  📊 UI REPORT GENERATED")
    print(f"{'='*60}")
    print(f"  Total:  {total} tests")
    print(f"  Passed: {passed} ✅")
    print(f"  Failed: {total - passed} {'❌' if total - passed > 0 else '✅'}")
    print(f"  Rate:   {round(passed/total*100, 1)}%")
    print(f"{'='*60}")
    print(f"  📄 Report: {REPORT_PATH}")
    print(f"{'='*60}\n")

    webbrowser.open(f"file:///{REPORT_PATH.replace(os.sep, '/')}")
    print("  🌐 Opening in browser...")


if __name__ == '__main__':
    main()
