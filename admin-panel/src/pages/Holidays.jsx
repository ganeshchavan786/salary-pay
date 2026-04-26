import { useState, useEffect, useRef } from 'react'
import {
  CalendarDays, Plus, Trash2, Loader2, Edit2, Download, Upload,
  Copy, Search, ChevronLeft, ChevronRight, List, Calendar, X
} from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { holidayApi } from '../services/api'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  national: { bg: 'bg-red-100',    text: 'text-red-700',    hex: '#ef4444', label: 'National' },
  state:    { bg: 'bg-blue-100',   text: 'text-blue-700',   hex: '#3b82f6', label: 'State' },
  festival: { bg: 'bg-orange-100', text: 'text-orange-700', hex: '#f97316', label: 'Festival' },
  optional: { bg: 'bg-gray-100',   text: 'text-gray-600',   hex: '#9ca3af', label: 'Optional' },
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats }) {
  const cards = [
    { label: 'Total', value: stats?.total ?? '—', color: 'text-gray-700 bg-gray-50' },
    { label: 'National', value: stats?.national ?? '—', color: `${TYPE_COLORS.national.text} ${TYPE_COLORS.national.bg}` },
    { label: 'State', value: stats?.state ?? '—', color: `${TYPE_COLORS.state.text} ${TYPE_COLORS.state.bg}` },
    { label: 'Festival', value: stats?.festival ?? '—', color: `${TYPE_COLORS.festival.text} ${TYPE_COLORS.festival.bg}` },
    { label: 'Optional', value: stats?.optional ?? '—', color: `${TYPE_COLORS.optional.text} ${TYPE_COLORS.optional.bg}` },
  ]
  return (
    <div className="grid grid-cols-5 gap-3 mb-5">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl p-3 text-center ${c.color}`}>
          <p className="text-2xl font-bold">{c.value}</p>
          <p className="text-xs mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Upcoming Widget ───────────────────────────────────────────────────────────
function UpcomingWidget({ upcoming }) {
  if (!upcoming || upcoming.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-4 mb-5">
        <h3 className="font-semibold text-gray-800 mb-2">📅 Upcoming Holidays</h3>
        <p className="text-gray-400 text-sm">No upcoming holidays found.</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl shadow p-4 mb-5">
      <h3 className="font-semibold text-gray-800 mb-3">📅 Upcoming Holidays</h3>
      <div className="space-y-2">
        {upcoming.map(h => {
          const tc = TYPE_COLORS[h.holiday_type] || TYPE_COLORS.optional
          return (
            <div key={h.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.text}`}>{h.holiday_type}</span>
                <span className="text-sm text-gray-800">{h.name}</span>
                {h.name_marathi && <span className="text-xs text-gray-400">{h.name_marathi}</span>}
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-gray-700">{h.date}</div>
                <div className="text-xs text-gray-400">{h.days_remaining === 0 ? 'Today!' : `${h.days_remaining}d`}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({ holidays, year, calendarMonth, setCalendarMonth }) {
  const month = calendarMonth
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const holidayMap = {}
  holidays.forEach(h => {
    const d = new Date(h.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      holidayMap[d.getDate()] = h
    }
  })

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCalendarMonth(m => Math.max(0, m - 1))} disabled={month === 0} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
        <h3 className="font-semibold text-gray-800">{MONTHS[month]} {year}</h3>
        <button onClick={() => setCalendarMonth(m => Math.min(11, m + 1))} disabled={month === 11} className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const h = holidayMap[day]
          const tc = h ? (TYPE_COLORS[h.holiday_type] || TYPE_COLORS.optional) : null
          const isToday = new Date().toDateString() === new Date(year, month, day).toDateString()
          return (
            <div key={day} className={`min-h-12 p-1 rounded-lg border text-xs ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}`}>
              <div className={`font-medium mb-0.5 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>
              {h && (
                <div className={`truncate rounded px-1 py-0.5 ${tc.bg} ${tc.text}`} title={`${h.name}${h.name_marathi ? ' / ' + h.name_marathi : ''}`}>
                  {h.name}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Type Chart ────────────────────────────────────────────────────────────────
function TypeChart({ holidays }) {
  const counts = { national: 0, state: 0, festival: 0, optional: 0 }
  holidays.forEach(h => { if (h.holiday_type in counts) counts[h.holiday_type]++ })
  const data = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: TYPE_COLORS[k].label, value: v, type: k }))

  if (data.length === 0) return (
    <div className="bg-white rounded-xl shadow p-5 text-center text-gray-400">
      <CalendarDays className="w-10 h-10 mx-auto mb-2 text-gray-300" />
      <p>No holidays to chart</p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h3 className="font-semibold text-gray-800 mb-4">Holiday Type Distribution</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
            {data.map(d => <Cell key={d.type} fill={TYPE_COLORS[d.type].hex} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Holidays() {
  const [holidays, setHolidays] = useState([])
  const [stats, setStats] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [viewMode, setViewMode] = useState('table')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [showImportResult, setShowImportResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const importRef = useRef(null)

  useEffect(() => { loadAll() }, [year])

  async function loadAll() {
    setLoading(true)
    try {
      const [hRes, sRes, uRes] = await Promise.all([
        holidayApi.getAll(year),
        holidayApi.getStats(year),
        holidayApi.getUpcoming(),
      ])
      setHolidays(hRes.data.holidays || [])
      setStats(sRes.data)
      setUpcoming(uRes.data.upcoming || [])
    } catch { toast.error('Failed to load holidays') }
    finally { setLoading(false) }
  }

  // Client-side filter
  const filtered = holidays.filter(h => {
    const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) || (h.name_marathi || '').toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || h.holiday_type === typeFilter
    return matchSearch && matchType
  })

  // Selection
  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(h => h.id)))
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} holiday(s)?`)) return
    try {
      const r = await holidayApi.bulkDelete([...selectedIds])
      toast.success(`${r.data.deleted} holiday(s) deleted`)
      setSelectedIds(new Set())
      loadAll()
    } catch { toast.error('Failed to delete') }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove "${name}"?`)) return
    try { await holidayApi.delete(id); toast.success('Holiday removed'); loadAll() }
    catch { toast.error('Failed to remove') }
  }

  async function handleCopyToNextYear() {
    if (!confirm(`Copy all ${year} holidays to ${year + 1}?`)) return
    try {
      const r = await holidayApi.copyToNextYear(year)
      toast.success(`Copied ${r.data.copied}, skipped ${r.data.skipped}`)
    } catch { toast.error('Failed to copy') }
  }

  async function handleSeed(seedYear) {
    try {
      const r = await holidayApi.seed(seedYear)
      toast.success(r.data.message)
      if (seedYear === year) loadAll()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to seed') }
  }

  function handleExportCSV() {
    if (holidays.length === 0) return
    const headers = ['date', 'name', 'name_marathi', 'holiday_type', 'year']
    const rows = holidays.map(h => [h.date, h.name, h.name_marathi || '', h.holiday_type, h.year])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `holidays_${year}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await holidayApi.importCsv(fd)
      setShowImportResult(r.data)
      loadAll()
    } catch (err) { toast.error(err.response?.data?.detail || 'Import failed') }
    finally { if (importRef.current) importRef.current.value = '' }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Holidays</h1>
          <p className="text-gray-500 text-sm">{holidays.length} holidays in {year}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Year selector */}
          <select value={year} onChange={e => setYear(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none">
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          {/* Seed dropdown */}
          <select onChange={e => { if (e.target.value) { handleSeed(+e.target.value); e.target.value = '' } }} className="border rounded-lg px-3 py-2 text-sm outline-none" defaultValue="">
            <option value="" disabled>🌱 Seed Year</option>
            <option value="2025">Seed 2025</option>
            <option value="2026">Seed 2026</option>
            <option value="2027">Seed 2027</option>
          </select>
          <button onClick={handleCopyToNextYear} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"><Copy className="w-4 h-4" /> Copy to {year + 1}</button>
          <button onClick={handleExportCSV} disabled={holidays.length === 0} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50"><Download className="w-4 h-4" /> Export</button>
          <input ref={importRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"><Upload className="w-4 h-4" /> Import</button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" /> Add Holiday</button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats} />

      {/* Upcoming + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <UpcomingWidget upcoming={upcoming} />
        <TypeChart holidays={holidays} />
      </div>

      {/* Filter + View Toggle */}
      <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search holidays..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All Types</option>
          <option value="national">National</option>
          <option value="state">State</option>
          <option value="festival">Festival</option>
          <option value="optional">Optional</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} shown</span>
        <div className="flex border rounded-lg overflow-hidden ml-auto">
          <button onClick={() => setViewMode('table')} className={`px-3 py-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('calendar')} className={`px-3 py-2 ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><Calendar className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Bulk delete toolbar */}
      {selectedIds.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-red-700">{selectedIds.size} selected</span>
          <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Delete Selected</button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto p-1 text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <CalendarView holidays={holidays} year={year} calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No holidays found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-blue-600" />
                    </th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Marathi</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(h => {
                    const tc = TYPE_COLORS[h.holiday_type] || TYPE_COLORS.optional
                    return (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedIds.has(h.id)} onChange={() => toggleSelect(h.id)} className="w-4 h-4 accent-blue-600" />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{h.date}</td>
                        <td className="px-4 py-3 text-gray-700">{h.name}</td>
                        <td className="px-4 py-3 text-gray-500">{h.name_marathi || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.text}`}>{h.holiday_type}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setShowEdit(h)} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(h.id, h.name)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && <HolidayFormModal title="Add Holiday" holidays={holidays} year={year} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadAll() }} />}

      {/* Edit Modal */}
      {showEdit && <HolidayFormModal title="Edit Holiday" holidays={holidays} year={year} holiday={showEdit} onClose={() => setShowEdit(null)} onSaved={() => { setShowEdit(null); loadAll() }} />}

      {/* Import Result Modal */}
      {showImportResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Import Result</h3>
            <div className="space-y-1 text-sm mb-4">
              <p>Total rows: <strong>{showImportResult.total_rows}</strong></p>
              <p className="text-green-600">Imported: <strong>{showImportResult.imported}</strong></p>
              <p className="text-yellow-600">Skipped (duplicates): <strong>{showImportResult.skipped}</strong></p>
              <p className="text-red-600">Errors: <strong>{showImportResult.errors}</strong></p>
            </div>
            {showImportResult.error_details?.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 mb-4">
                {showImportResult.error_details.map((e, i) => (
                  <div key={i} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">{e}</div>
                ))}
              </div>
            )}
            <button onClick={() => setShowImportResult(null)} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Holiday Form Modal (Add + Edit) ───────────────────────────────────────────
function HolidayFormModal({ title, holidays, year, holiday, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: holiday?.name || '',
    name_marathi: holiday?.name_marathi || '',
    date: holiday?.date || '',
    holiday_type: holiday?.holiday_type || 'festival',
  })
  const [saving, setSaving] = useState(false)
  const [dupWarning, setDupWarning] = useState(null)

  function checkDuplicate(dateVal) {
    if (!dateVal) { setDupWarning(null); return }
    const existing = holidays.find(h => h.date === dateVal && h.id !== holiday?.id)
    setDupWarning(existing ? existing.name : null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (holiday) {
        await holidayApi.update(holiday.id, { ...form, date: form.date })
        toast.success('Holiday updated ✅')
      } else {
        await holidayApi.create({ ...form, year })
        toast.success('Holiday added ✅')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name (English) *</label>
            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Republic Day" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name (Marathi)</label>
            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={form.name_marathi} onChange={e => setForm(f => ({...f, name_marathi: e.target.value}))} placeholder="गणराज्य दिन" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required value={form.date}
                onChange={e => { setForm(f => ({...f, date: e.target.value})); checkDuplicate(e.target.value) }} />
              {dupWarning && <p className="text-xs text-orange-600 mt-1">⚠️ "{dupWarning}" already on this date</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm outline-none" value={form.holiday_type} onChange={e => setForm(f => ({...f, holiday_type: e.target.value}))}>
                <option value="national">National</option>
                <option value="state">State</option>
                <option value="festival">Festival</option>
                <option value="optional">Optional</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : (holiday ? 'Update' : 'Add Holiday')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
