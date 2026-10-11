import React, { useEffect, useMemo, useState } from 'react'
import { Search, MapPin, CalendarDays, ArrowDownWideNarrow } from 'lucide-react'
import { CardHeader, ErrorNote, Spinner } from './ui.jsx'
import api, { errorMessage } from '../services/api'

const INDIA_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh','Puducherry','Chandigarh','Andaman and Nicobar Islands','Lakshadweep','Dadra and Nagar Haveli and Daman and Diu']
const CITIES = ['Mumbai','Pune','Nagpur','Nashik','Bengaluru','Mysuru','Hubballi','Chennai','Coimbatore','Hyderabad','Warangal','Ahmedabad','Surat','Vadodara','Jaipur','Jodhpur','Delhi','Lucknow','Kanpur','Varanasi','Kolkata','Bhopal','Indore','Patna','Ranchi','Bhubaneswar','Kochi','Thiruvananthapuram','Amritsar','Chandigarh','Dehradun','Guwahati','Visakhapatnam','Vijayawada','Puducherry','Port Blair','Daman','Silvassa','Kavaratti']
export default function RegionalDiseaseFinder() {
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [sort, setSort] = useState('high')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let ignore = false
    setError(null); setData(null)
    const params = {}
    if (search.trim()) params.region = search.trim()
    if (month) params.month = month
    api.get('/analytics/regional-disease-ratios', { params }).then((r) => { if (!ignore) setData(r.data) }).catch((e) => { if (!ignore) setError(errorMessage(e, 'Could not load regional disease ratios.')) })
    return () => { ignore = true }
  }, [search, month])
  const rows = useMemo(() => [...(data || [])].sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1
    const diff = (a.percentage ?? -1) - (b.percentage ?? -1)
    return sort === 'high' ? -diff : diff
  }), [data, sort])
  return <section className="card p-5"><CardHeader title="City / state disease finder" description="Search the locations present in the current database, filter by diagnosis month and rank visible disease shares from highest to lowest." />
    <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_1fr_0.9fr]"><div><label className="label" htmlFor="region-search">Search city or state</label><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input id="region-search" list="india-locations" className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Pune, Maharashtra, Boston" /><datalist id="india-locations">{[...INDIA_STATES, ...CITIES].map((x) => <option key={x} value={x} />)}</datalist></div></div><div><label className="label" htmlFor="ratio-month">Diagnosis month</label><input id="ratio-month" type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} /></div><div><label className="label" htmlFor="ratio-sort">Sort by ratio</label><select id="ratio-sort" className="field" value={sort} onChange={(e) => setSort(e.target.value)}><option value="high">Highest to lowest</option><option value="low">Lowest to highest</option></select></div></div>
    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"><MapPin size={15} className="mr-1 inline" /><strong>Data coverage note:</strong> The included records are synthetic Synthea sample patients, not Indian surveillance data. Indian states/cities are search suggestions only; no India-specific disease ratio is displayed unless matching records are actually in the dataset. No existing dataset files are changed.</div>
    <ErrorNote>{error}</ErrorNote>
    {!data && !error && <div className="mt-4"><Spinner label="Calculating privacy-protected ratios…" /></div>}
    {data && rows.length === 0 && <p className="mt-4 rounded-xl bg-blush-100 px-4 py-8 text-center text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">No matching records for this city/state and month. This means the selected filter has no matching records in the current dataset; it does not mean there are zero cases in that real-world location.</p>}
    {data && rows.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700"><th className="px-3 py-3">City / state region</th><th className="px-3 py-3">Disease / condition</th><th className="px-3 py-3">Patients</th><th className="px-3 py-3">Region denominator</th><th className="px-3 py-3">Ratio</th></tr></thead><tbody>{rows.map((r, i) => <tr key={`${r.region}-${r.condition}-${i}`} className="border-b border-ink-100 last:border-0 dark:border-ink-800"><td className="px-3 py-3">{r.region}</td><td className="px-3 py-3 font-semibold">{r.condition}</td><td className="px-3 py-3">{r.suppressed ? 'SUPPRESSED' : r.count}</td><td className="px-3 py-3">{r.suppressed ? 'SUPPRESSED' : r.regional_patient_count}</td><td className="px-3 py-3 font-bold">{r.suppressed ? '—' : `${r.percentage.toFixed(2)}%`}</td></tr>)}</tbody></table><p className="mt-3 text-xs leading-relaxed text-ink-500"><ArrowDownWideNarrow size={13} className="mr-1 inline" /> Ratios are condition-specific shares among distinct patients with an active diagnosis in the selected region and month. A patient may have multiple conditions, so percentages can sum to over 100%. Counts below the privacy threshold k=5 are suppressed.</p></div>}
  </section>
}
