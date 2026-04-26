/**
 * UI Test Report Generator
 * =========================
 * Run: node src/tests/UI_test/generate_ui_report.js
 * Runs all UI tests and generates HTML report
 */
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { openSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..', '..', '..') // admin-panel root

// ── Step 1: Run vitest with JSON output ──────────────────────────────────────

const jsonPath = join(__dirname, 'ui_test_results.json')

console.log('🔄 Running UI tests...\n')

try {
  execSync(
    `npx vitest run src/tests/UI_test/ --reporter=json --outputFile=${jsonPath}`,
    { cwd: ROOT, stdio: 'inherit' }
  )
} catch (e) {
  // vitest exits with code 1 on failures — that's ok, we still read the JSON
}

// ── Step 2: Parse JSON results ────────────────────────────────────────────────

let data = { testResults: [] }
if (existsSync(jsonPath)) {
  data = JSON.parse(readFileSync(jsonPath, 'utf-8'))
}

const tests = []
for (const suite of data.testResults || []) {
  const fileName = suite.name?.split('/').pop() || suite.name || 'unknown'
  for (const t of suite.assertionResults || []) {
    tests.push({
      file: fileName,
      display_name: t.title,
      status: t.status === 'passed' ? 'PASSED' : 'FAILED',
      duration: Math.round((t.duration || 0)),
      error: t.failureMessages?.join('\n') || '',
    })
  }
}

// ── Step 3: Generate HTML ─────────────────────────────────────────────────────

const total = tests.length
const passed = tests.filter(t => t.status === 'PASSED').length
const failed = total - passed
const passRate = total > 0 ? Math.round(passed / total * 100) : 0
const now = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
const overallOk = failed === 0
const overallColor = overallOk ? '#10b981' : '#ef4444'
const overallText = overallOk ? 'ALL PASS ✅' : `${failed} FAILED ❌`

// Group by file
const sections = {}
const sectionNames = {
  'test_01_login_ui.test.jsx': '🔐 Section 1: Login Page',
  'test_02_attendance_ui.test.jsx': '📅 Section 2: Attendance Page',
  'test_03_leave_ui.test.jsx': '🏖️ Section 3: Leave Management',
  'test_04_payhead_ui.test.jsx': '💼 Section 4: Payhead Configuration',
  'test_05_salary_calc_ui.test.jsx': '💰 Section 5: Salary Calculation',
}

for (const t of tests) {
  if (!sections[t.file]) sections[t.file] = []
  sections[t.file].push(t)
}

let sectionsHtml = ''
for (const [file, fileTests] of Object.entries(sections)) {
  const sp = fileTests.filter(t => t.status === 'PASSED').length
  const st = fileTests.length
  const sc = sp === st ? '#10b981' : '#ef4444'
  const sn = sectionNames[file] || file

  let rows = ''
  fileTests.forEach((t, i) => {
    const isPass = t.status === 'PASSED'
    const badge = isPass
      ? '<span class="badge pass">✅ PASS</span>'
      : '<span class="badge fail">❌ FAIL</span>'
    const errHtml = t.error
      ? `<div class="err-msg">${t.error.slice(0, 200)}</div>`
      : ''
    rows += `
    <tr class="${isPass ? 'pass-row' : 'fail-row'}">
      <td class="num">${i + 1}</td>
      <td class="tname">${t.display_name}</td>
      <td class="tstatus">${badge}</td>
      <td class="tdur">${t.duration}ms</td>
      <td class="terr">${errHtml}</td>
    </tr>`
  })

  sectionsHtml += `
  <div class="section-card">
    <div class="section-header" style="border-left:5px solid ${sc}">
      <div class="section-title">${sn}</div>
      <div class="section-badge" style="background:${sc}">${sp}/${st} passed</div>
    </div>
    <table class="test-table">
      <thead><tr><th>#</th><th>Test</th><th>Status</th><th>Time</th><th>Error</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI Test Report — Admin Panel</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;padding:24px}
    .header{background:linear-gradient(135deg,#1e293b,#334155);color:white;border-radius:16px;padding:32px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
    .header h1{font-size:26px;font-weight:700;margin-bottom:4px}
    .header p{color:#94a3b8;font-size:13px}
    .overall{font-size:20px;font-weight:700;color:${overallColor};background:rgba(255,255,255,.1);padding:12px 24px;border-radius:12px;border:2px solid ${overallColor}}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
    .card{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .card-value{font-size:36px;font-weight:800;margin-bottom:4px}
    .card-label{font-size:13px;color:#64748b;font-weight:500}
    .card.total .card-value{color:#3b82f6}
    .card.pass .card-value{color:#10b981}
    .card.fail .card-value{color:#ef4444}
    .card.rate .card-value{color:#8b5cf6}
    .progress-wrap{background:white;border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .progress-label{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;font-weight:600}
    .progress-bar{height:12px;background:#e2e8f0;border-radius:99px;overflow:hidden}
    .progress-fill{height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:99px;width:${passRate}%}
    .section-card{background:white;border-radius:12px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden}
    .section-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
    .section-title{font-size:16px;font-weight:700}
    .section-badge{color:white;font-size:13px;font-weight:600;padding:4px 12px;border-radius:99px}
    .test-table{width:100%;border-collapse:collapse}
    .test-table th{background:#f1f5f9;padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
    .test-table td{padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;vertical-align:top}
    .pass-row{background:#f0fdf4}
    .fail-row{background:#fef2f2}
    .num{color:#94a3b8;font-size:12px;width:32px}
    .tname{font-weight:500;color:#1e293b}
    .tstatus{width:100px}
    .tdur{color:#94a3b8;font-size:12px;width:70px}
    .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700}
    .badge.pass{background:#dcfce7;color:#16a34a}
    .badge.fail{background:#fee2e2;color:#dc2626}
    .err-msg{font-family:monospace;font-size:11px;color:#dc2626;background:#fef2f2;padding:4px 8px;border-radius:4px;white-space:pre-wrap;max-width:400px;overflow:hidden}
    .footer{text-align:center;color:#94a3b8;font-size:13px;margin-top:32px;padding:16px}
    @media(max-width:768px){.summary{grid-template-columns:repeat(2,1fr)}.header{flex-direction:column;gap:16px;text-align:center}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🖥️ UI Test Report — Admin Panel</h1>
      <p>Face Recognition Attendance PWA</p>
      <p style="margin-top:6px;color:#cbd5e1">Generated: ${now}</p>
    </div>
    <div class="overall">${overallText}</div>
  </div>

  <div class="summary">
    <div class="card total"><div class="card-value">${total}</div><div class="card-label">Total Tests</div></div>
    <div class="card pass"><div class="card-value">${passed}</div><div class="card-label">Passed ✅</div></div>
    <div class="card fail"><div class="card-value">${failed}</div><div class="card-label">Failed ❌</div></div>
    <div class="card rate"><div class="card-value">${passRate}%</div><div class="card-label">Pass Rate</div></div>
  </div>

  <div class="progress-wrap">
    <div class="progress-label"><span>Test Progress</span><span>${passed} / ${total} tests passing</span></div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  </div>

  ${sectionsHtml}

  <div class="footer">Admin Panel UI Tests · ${now}</div>
</body>
</html>`

const reportPath = join(__dirname, 'ui_test_report.html')
writeFileSync(reportPath, html, 'utf-8')

console.log(`\n${'='.repeat(60)}`)
console.log(`  📊 UI REPORT GENERATED`)
console.log(`${'='.repeat(60)}`)
console.log(`  Total:  ${total} tests`)
console.log(`  Passed: ${passed} ✅`)
console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : '✅'}`)
console.log(`  Rate:   ${passRate}%`)
console.log(`${'='.repeat(60)}`)
console.log(`  📄 Report: ${reportPath}`)
console.log(`${'='.repeat(60)}\n`)

// Open in browser
const { exec } = await import('child_process')
exec(`start "" "${reportPath}"`)
console.log('  🌐 Opening in browser...')
