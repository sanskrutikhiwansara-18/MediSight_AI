import React, { useMemo, useState } from 'react'
import { Activity, CalendarDays, FlaskConical, Pill, Stethoscope } from 'lucide-react'
import { CardHeader, StatCard } from './ui.jsx'

function period(date) { return date ? String(date).slice(0, 7) : 'Unknown date' }
function label(value) { if (!/^\d{4}-\d{2}$/.test(value)) return value; const [y, m] = value.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }
export default function MonthlyHealthHistory({ record }) {
  const months = useMemo(() => {
    const all = [
      ...(record.conditions || []).map((x) => period(x.diagnosed_date)),
      ...(record.visits || []).map((x) => period(x.visit_date)),
      ...(record.lab_results || []).map((x) => period(x.result_date)),
      ...(record.prescriptions || []).map((x) => period(x.start_date)),
    ].filter((x) => x !== 'Unknown date')
    return [...new Set(all)].sort().reverse()
  }, [record])
  const [month, setMonth] = useState('all')
  const inMonth = (date) => month === 'all' || period(date) === month
  const conditions = (record.conditions || []).filter((x) => inMonth(x.diagnosed_date))
  const visits = (record.visits || []).filter((x) => inMonth(x.visit_date))
  const labs = (record.lab_results || []).filter((x) => inMonth(x.result_date))
  const prescriptions = (record.prescriptions || []).filter((x) => inMonth(x.start_date))
  return <section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><CardHeader title="Monthly health history" description="Filter your own visits, diagnoses, lab results and prescriptions by month." /><div className="min-w-[190px]"><label className="label" htmlFor="health-month">Month</label><select className="field" id="health-month" value={month} onChange={(e) => setMonth(e.target.value)}><option value="all">All recorded months</option>{months.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></div></div>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><StatCard icon={Stethoscope} label="Diagnoses" value={conditions.length} /><StatCard icon={CalendarDays} label="Visits" value={visits.length} /><StatCard icon={FlaskConical} label="Lab results" value={labs.length} /><StatCard icon={Pill} label="Prescriptions" value={prescriptions.length} /></div>
    {month !== 'all' && <p className="mt-3 text-xs text-ink-500">Showing {label(month)}. This view filters records already stored for this patient; it does not create missing history.</p>}
    <div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="mb-2 text-sm font-bold">Diagnoses</h3>{conditions.length ? <ul className="space-y-2">{conditions.map((x) => <li key={x.id} className="rounded-xl bg-blush-50 p-3 text-sm dark:bg-ink-800"><p className="font-semibold">{x.name}</p><p className="text-xs text-ink-500">{x.diagnosed_date} · {x.active ? 'Active' : 'Inactive'}</p></li>)}</ul> : <p className="text-sm text-ink-500">No diagnoses for this period.</p>}</div><div><h3 className="mb-2 text-sm font-bold">Visits</h3>{visits.length ? <ul className="space-y-2">{visits.map((x) => <li key={x.id} className="rounded-xl bg-blush-50 p-3 text-sm dark:bg-ink-800"><p className="font-semibold">{x.reason}</p><p className="text-xs text-ink-500">{x.visit_date}</p></li>)}</ul> : <p className="text-sm text-ink-500">No visits for this period.</p>}</div></div>
    <p className="mt-4 text-xs leading-relaxed text-ink-500"><Activity size={13} className="mr-1 inline" /> Monthly counts describe this patient's recorded history only. They are not a forecast or medical advice.</p>
  </section>
}
