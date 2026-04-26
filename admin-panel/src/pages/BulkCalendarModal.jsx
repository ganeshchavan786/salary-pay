import { useState, useEffect } from 'react'
import { X, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { attendanceHrApi, holidayApi } from '../services/api'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const STATUS_COLORS = {
  present:   'bg-green-100 text-green-700 border-green-200',
  absent:    'bg-red-100 text-red-700 border-red-200',
  halfday:   'bg-purple-100 text-purple-700 border-purple-200',
  leave:     'bg-orange-100 text-orange-700 border-orange-200',
  holiday:   'bg-blue-100 text-blue-700 border-blue-200',
  weeklyoff: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_LABELS = {
  present:   'P',
  absent:    'A',
  halfday:   'H',
  leave:     'L',
  holiday:   'Ho',
  weeklyoff: 'WO',
}

// Cycle: skip weeklyoff in manual cycling (weeklyoff is auto-only)
const STATUS_CYCLE = ['present', 'absent', 'halfday', 'leave', 'holiday']

function isSecondOrFourthSaturday(d) {
  if (d.getDay() !== 6) return false
  let satCount = 0
  for (let day = 1; day <= d.getDate(); day++) {
    if (new Date(d.getFullYear(), d.getMonth(), day).getDay() === 6) satCount++
  }
  return satCount === 2 || satCount === 4
}

export default function BulkCalendarModal({ employee, month: initMonth, year: initYear, onClose, onSaved }) {
  const [month, setMonth] = useState(initMonth)
  const [year, setYear] = useState(initYear)
  const [days, setDays] = useState([])
  const [defaultCheckIn, setDefaultCheckIn] = useState('09:30')
  const [defaultCheckOut, setDefaultCheckOut] = useState('18:30')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [workingDays, setWorkingDays] = useState(0)
  const [saveSummary, setSaveSummary] = useState(null)

  // Navigate month
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function handleClose() {
    setSaveSummary(null)
    onClose()
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setSaveSummary(null)
      try {
        // Fetch existing records and working days — holidays separately (non-critical)
        const [recordsRes, workingDaysRes] = await Promise.all([
          attendanceHrApi.getDaily(employee.id, month, year),
          attendanceHrApi.workingDays(month, year).catch(() => ({ data: { working_days: 0 } })),
        ])

        const existingRecords = recordsRes.data.records || []
        setWorkingDays(workingDaysRes.data.working_days || 0)

        // Fetch holidays separately — don't block if it fails
        let holidayDates = new Set()
        try {
          const holidaysRes = await holidayApi.getAll(year)
          const holidays = (holidaysRes.data || []).filter(h => {
            if (!h.date) return false
            const d = new Date(h.date)
            return d.getMonth() + 1 === month && d.getFullYear() === year && h.is_active !== false
          })
          holidayDates = new Set(holidays.map(h => h.date.slice(0, 10)))
        } catch (e) {
          console.warn('Could not load holidays:', e)
        }

        // Build existing records map
        const recordMap = {}
        for (const rec of existingRecords) {
          recordMap[rec.date] = rec
        }

        // Build days array
        const daysInMonth = new Date(year, month, 0).getDate()
        const builtDays = []

        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(year, month - 1, day)
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isWeeklyOff = d.getDay() === 0 || isSecondOrFourthSaturday(d)
          const isHolidayDate = holidayDates.has(dateStr)
          const existingRecord = recordMap[dateStr] || null

          let status
          let isAutoMarked = false

          if (existingRecord && existingRecord.is_overridden) {
            // Manually overridden — keep as-is
            status = existingRecord.status
          } else if (isWeeklyOff) {
            status = 'weeklyoff'
            isAutoMarked = true
          } else if (isHolidayDate) {
            status = 'holiday'
            isAutoMarked = true
          } else if (existingRecord) {
            // Use existing face-recognition record
            status = existingRecord.status
          } else {
            // Default: PRESENT (not absent)
            status = 'present'
          }

          builtDays.push({
            date: dateStr,
            status,
            isWeeklyOff,
            isHolidayDate,
            isAutoMarked,
            hasExistingRecord: !!recordMap[dateStr],
          })
        }

        setDays(builtDays)
      } catch (err) {
        toast.error('Failed to load attendance data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [employee.id, month, year])

  function handleDayClick(index) {
    const day = days[index]
    if (day.isWeeklyOff) return // Cannot change weekly off

    const currentIdx = STATUS_CYCLE.indexOf(day.status)
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % STATUS_CYCLE.length
    const nextStatus = STATUS_CYCLE[nextIdx]

    setDays(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], status: nextStatus, isAutoMarked: false }
      return updated
    })
  }

  async function handleSaveAll() {
    setSaving(true)
    try {
      const records = days.map(d => ({
        date: d.date,
        status: d.status,
        check_in: ['present', 'halfday'].includes(d.status) ? defaultCheckIn : null,
        check_out: ['present', 'halfday'].includes(d.status) ? defaultCheckOut : null,
      }))

      const response = await attendanceHrApi.bulkSave({ emp_id: employee.id, month, year, records })
      if (response.data?.summary) {
        setSaveSummary(response.data.summary)
      }
      toast.success(`Attendance saved for ${MONTHS_FULL[month-1]} ${year} ✅`)
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const presentCount  = days.filter(d => d.status === 'present').length
  const absentCount   = days.filter(d => d.status === 'absent').length
  const holidayCount  = days.filter(d => d.status === 'holiday').length
  const leaveCount    = days.filter(d => d.status === 'leave').length
  const weeklyOffCount= days.filter(d => d.status === 'weeklyoff').length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-2 max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between bg-white rounded-t-xl">
          <h3 className="font-semibold text-gray-800 text-sm">
            📅 Bulk Attendance — {employee.name} ({employee.emp_code})
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month navigation */}
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <select value={month} onChange={e => setMonth(+e.target.value)}
              className="border rounded px-2 py-1 text-sm font-medium">
              {MONTHS_FULL.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(+e.target.value)}
              className="border rounded px-2 py-1 text-sm font-medium">
              {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Default times */}
        <div className="px-3 py-2 border-b flex flex-wrap gap-3 items-center bg-gray-50">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Check-in</span>
            <input type="time" value={defaultCheckIn} onChange={e => setDefaultCheckIn(e.target.value)}
              className="border rounded px-2 py-0.5 text-xs" />
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Check-out</span>
            <input type="time" value={defaultCheckOut} onChange={e => setDefaultCheckOut(e.target.value)}
              className="border rounded px-2 py-0.5 text-xs" />
          </div>
        </div>

        {/* Summary bar */}
        <div className="px-3 py-1.5 border-b bg-blue-50 flex flex-wrap gap-3 text-xs">
          <span className="text-green-700 font-medium">✅ Present: {presentCount}</span>
          <span className="text-red-700 font-medium">❌ Absent: {absentCount}</span>
          {holidayCount > 0 && <span className="text-blue-700 font-medium">🎉 Holiday: {holidayCount}</span>}
          {leaveCount > 0 && <span className="text-orange-700 font-medium">🏖 Leave: {leaveCount}</span>}
          <span className="text-gray-500 font-medium">📅 Working: {workingDays}</span>
        </div>

        {/* Legend */}
        <div className="px-3 py-1.5 border-b flex flex-wrap gap-2 text-[10px]">
          {Object.entries(STATUS_LABELS).map(([s, l]) => (
            <span key={s} className={`px-1.5 py-0.5 rounded font-medium border ${STATUS_COLORS[s]}`}>
              {l} = {s}
            </span>
          ))}
          <span className="text-gray-400 ml-1">• Click to cycle</span>
        </div>

        {/* Calendar grid */}
        <div className="p-3 overflow-y-auto" style={{minHeight: '300px'}}>
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_NAMES.map(name => (
                  <div key={name} className="text-center text-[10px] font-medium text-gray-400 py-0.5">{name}</div>
                ))}
              </div>
              {(() => {
                const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
                const cells = [
                  ...Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />),
                  ...days.map((day, index) => {
                    const dayNum = new Date(day.date).getDate()
                    const isToday = day.date === new Date().toISOString().slice(0,10)
                    return (
                      <div key={day.date} onClick={() => handleDayClick(index)}
                        className={`rounded-lg border text-center text-xs transition select-none p-1
                          ${day.isWeeklyOff ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow hover:border-blue-300'}
                          ${isToday ? 'ring-2 ring-blue-400' : ''}
                          ${day.hasExistingRecord && !day.isAutoMarked ? 'ring-1 ring-amber-400' : ''}
                          ${STATUS_COLORS[day.status] || 'bg-gray-50 border-gray-200'}`}>
                        <div className={`font-bold text-sm ${isToday ? 'text-blue-600' : ''}`}>{dayNum}</div>
                        <div className="font-medium text-[10px] mt-0.5">
                          {STATUS_LABELS[day.status] || day.status}
                        </div>
                        {day.isAutoMarked && (
                          <div className="text-[8px] opacity-60">auto</div>
                        )}
                        {day.hasExistingRecord && !day.isAutoMarked && (
                          <div className="text-[8px] text-amber-500">●</div>
                        )}
                      </div>
                    )
                  }),
                ]
                return <div className="grid grid-cols-7 gap-1">{cells}</div>
              })()}
            </>
          )}
        </div>

        {/* Save summary banner */}
        {saveSummary && (
          <div className="px-3 py-2 border-t bg-gray-50 text-xs space-y-1">
            <p className="text-gray-700">
              Created <span className="font-semibold text-green-700">{saveSummary.created}</span> new records,
              updated <span className="font-semibold text-blue-700">{saveSummary.updated}</span> existing records.
              {saveSummary.skipped > 0 && (
                <> Skipped <span className="font-semibold text-amber-600">{saveSummary.skipped}</span> records (already existed).</>
              )}
            </p>
            {saveSummary.failed > 0 && (
              <p className="text-red-600 font-medium">
                ⚠️ {saveSummary.failed} records failed to save.
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t flex gap-2 bg-white rounded-b-xl">
          <button onClick={handleClose}
            className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSaveAll} disabled={saving || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : `Save ${MONTHS[month-1]} ${year} (${days.length} days)`}
          </button>
        </div>
      </div>
    </div>
  )
}
