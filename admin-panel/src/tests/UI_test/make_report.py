import json, os, webbrowser
from datetime import datetime
from collections import OrderedDict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, 'ui_test_results.json')
REPORT_PATH = os.path.join(SCRIPT_DIR, 'ui_test_report.html')

SECTION_NAMES = {
    'test_01_login_ui.test.jsx':          '🔐 Section 1: Login Page',
    'test_02_attendance_ui.test.jsx':     '📅 Section 2: Attendance Page',
    'test_03_leave_ui.test.jsx':          '🏖️ Section 3: Leave Management',
    'test_04_payhead_ui.test.jsx':        '💼 Section 4: Payhead Config',
    'test_05_salary_calc_ui.test.jsx':    '💰 Section 5: Salary Calculation',
    'test_06_payhead_real_data.test.jsx': '👥 Section 6: Payhead Real Employees',
    'test_07_deduction_ui.test.jsx':      '💳 Section 7: Deduction Management',
}

with open(JSON_PATH, encoding='utf-8') as f:
    data = json.load(f)

tests = []
for suite in data.get('testResults', []):
    fn = suite.get('name', '').replace('\\', '/').split('/')[-1]
    for t in suite.get('assertionResults', []):
        err = (t.get('failureMessages') or [''])[0][:200]
        tests.append({
            'file': fn,
            'name': t.get('title', ''),
            'status': 'PASSED' if t.get('status') == 'passed' else 'FAILED',
            'dur': round(t.get('duration') or 0),
            'err': err,
        })

total = len(tests)
passed = sum(1 for t in tests if t['status'] == 'PASSED')
failed = total - passed
rate = round(passed / total * 100, 1) if total else 0
now = datetime.now().strftime('%d %B %Y, %I:%M %p')
oc = '#10b981' if failed == 0 else '#ef4444'
ot = 'ALL PASS ✅' if failed == 0 else f'{failed} FAILED ❌'

secs = OrderedDict()
for t in tests:
    secs.setdefault(t['file'], []).append(t)

sections_html = ''
for fn, ft in secs.items():
    sp = sum(1 for t in ft if t['status'] == 'PASSED')
    st = len(ft)
    sc = '#10b981' if sp == st else '#ef4444'
    sn = SECTION_NAMES.get(fn, fn)
    rows = ''
    for i, t in enumerate(ft):
        ip = t['status'] == 'PASSED'
        badge = (
            '<span class="badge pass">✅ PASS</span>' if ip
            else '<span class="badge fail">❌ FAIL</span>'
        )
        err_html = f'<div class="err">{t["err"]}</div>' if t['err'] else ''
        rows += f'''
        <tr class="{'pr' if ip else 'fr'}">
          <td class="n">{i+1}</td>
          <td class="tn">{t["name"]}</td>
          <td class="ts">{badge}</td>
          <td class="td">{t["dur"]}ms</td>
          <td>{err_html}</td>
        </tr>'''
    sections_html += f'''
    <div class="sc">
      <div class="sh" style="border-left:5px solid {sc}">
        <div class="st">{sn}</div>
        <div class="sb" style="background:{sc}">{sp}/{st} passed</div>
      </div>
      <table class="tt">
        <thead><tr><th>#</th><th>Test</th><th>Status</th><th>Time</th><th>Error</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>'''

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>UI Test Report — Admin Panel</title>
  <style>
    *{{margin:0;padding:0;box-sizing:border-box}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;padding:24px}}
    .hdr{{background:linear-gradient(135deg,#1e293b,#334155);color:white;border-radius:16px;padding:32px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}}
    .hdr h1{{font-size:26px;font-weight:700;margin-bottom:4px}}
    .hdr p{{color:#94a3b8;font-size:13px}}
    .ov{{font-size:20px;font-weight:700;color:{oc};background:rgba(255,255,255,.1);padding:12px 24px;border-radius:12px;border:2px solid {oc}}}
    .sum{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}}
    .card{{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}}
    .cv{{font-size:36px;font-weight:800;margin-bottom:4px}}
    .cl{{font-size:13px;color:#64748b}}
    .t .cv{{color:#3b82f6}}.p .cv{{color:#10b981}}.f .cv{{color:#ef4444}}.r .cv{{color:#8b5cf6}}
    .pw{{background:white;border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)}}
    .pl{{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;font-weight:600}}
    .pb{{height:12px;background:#e2e8f0;border-radius:99px;overflow:hidden}}
    .pf{{height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:99px;width:{rate}%}}
    .sc{{background:white;border-radius:12px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden}}
    .sh{{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0}}
    .st{{font-size:16px;font-weight:700}}
    .sb{{color:white;font-size:13px;font-weight:600;padding:4px 12px;border-radius:99px}}
    .tt{{width:100%;border-collapse:collapse}}
    .tt th{{background:#f1f5f9;padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em}}
    .tt td{{padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;vertical-align:top}}
    .pr{{background:#f0fdf4}}.fr{{background:#fef2f2}}
    .n{{color:#94a3b8;font-size:12px;width:32px}}
    .tn{{font-weight:500}}
    .ts{{width:100px}}
    .td{{color:#94a3b8;font-size:12px;width:70px}}
    .badge{{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700}}
    .badge.pass{{background:#dcfce7;color:#16a34a}}
    .badge.fail{{background:#fee2e2;color:#dc2626}}
    .err{{font-family:monospace;font-size:11px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:4px;white-space:pre-wrap;max-width:400px}}
    .ftr{{text-align:center;color:#94a3b8;font-size:13px;margin-top:32px;padding:16px}}
    @media(max-width:768px){{.sum{{grid-template-columns:repeat(2,1fr)}}.hdr{{flex-direction:column;gap:16px;text-align:center}}}}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>🖥️ UI Test Report — Admin Panel</h1>
      <p>Face Recognition Attendance PWA · React + Vitest</p>
      <p style="margin-top:6px;color:#cbd5e1">Generated: {now}</p>
    </div>
    <div class="ov">{ot}</div>
  </div>
  <div class="sum">
    <div class="card t"><div class="cv">{total}</div><div class="cl">Total Tests</div></div>
    <div class="card p"><div class="cv">{passed}</div><div class="cl">Passed ✅</div></div>
    <div class="card f"><div class="cv">{failed}</div><div class="cl">Failed ❌</div></div>
    <div class="card r"><div class="cv">{rate}%</div><div class="cl">Pass Rate</div></div>
  </div>
  <div class="pw">
    <div class="pl"><span>Test Progress</span><span>{passed} / {total} tests passing</span></div>
    <div class="pb"><div class="pf"></div></div>
  </div>
  {sections_html}
  <div class="ftr">Admin Panel UI Tests · {now}</div>
</body>
</html>"""

with open(REPORT_PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Total: {total} | Passed: {passed} | Failed: {failed} | Rate: {rate}%")
print(f"Report: {REPORT_PATH}")
webbrowser.open('file:///' + REPORT_PATH.replace(os.sep, '/'))
print("Opening in browser...")
