import React, { useState } from 'react'
import { Droplet, Save, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { CardHeader, ErrorNote } from './ui.jsx'
import api, { errorMessage } from '../services/api'

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export default function BloodGroupCard({ record, onUpdated }) {
  const [value, setValue] = useState(record.blood_group || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try { const res = await api.patch('/me/blood-group', { blood_group: value }); setMessage(res.data.message); onUpdated?.({ blood_group: res.data.blood_group, blood_group_verified: res.data.blood_group_verified }) }
    catch (e) { setError(errorMessage(e, 'Could not save blood group.')) }
    finally { setBusy(false) }
  }
  return <section className="card p-5"><CardHeader title="Blood group" description="Easy to find in your health record. Never infer it from other data." /><div className="mt-3 flex items-center gap-3 rounded-xl bg-blush-50 p-3 dark:bg-ink-800"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200"><Droplet size={22} /></span><div><p className="text-xl font-extrabold">{record.blood_group || 'Not recorded'}</p><p className="text-xs text-ink-500">{record.blood_group ? (record.blood_group_verified ? 'Clinician verified' : 'Patient-reported · not verified') : 'Add only the blood group you know from a reliable source.'}</p></div></div><form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3"><div className="min-w-[170px] flex-1"><label className="label" htmlFor="blood-group">Blood group</label><select id="blood-group" className="field" value={value} onChange={(e) => setValue(e.target.value)} required><option value="">Select blood group</option>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></div><button className="btn-primary btn-sm" disabled={busy || !value} type="submit">{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button></form><ErrorNote>{error}</ErrorNote>{message && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-900/10 dark:text-amber-200"><AlertTriangle size={14} className="mr-1 inline" /> Record display can help in an emergency but is not proof of blood type. Hospitals must confirm blood group and cross-match before transfusion.</p>{record.blood_group_verified && <p className="mt-2 text-xs text-emerald-700"><ShieldCheck size={13} className="mr-1 inline" /> Marked verified by a clinician.</p>}</section>
}
