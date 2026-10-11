import React, { useEffect, useState } from 'react'
import { Check, X, ShieldAlert, Users, Clock3, FileText, Loader2, Eye } from 'lucide-react'
import { PageHeader, StatCard, CardHeader, ErrorNote, Spinner } from '../components/ui.jsx'
import api, { errorMessage } from '../services/api'

const terminal = new Set(['representative_approved', 'representative_rejected', 'patient_rejected', 'expired'])

export default function RepresentativeDashboard() {
  const [relationships, setRelationships] = useState(null)
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [emergencyPatient, setEmergencyPatient] = useState('')
  const [emergencyReason, setEmergencyReason] = useState('')
  const [openRecord, setOpenRecord] = useState(null)
  const [recordData, setRecordData] = useState(null)

  async function load() {
    setError(null)
    try {
      const [r, q] = await Promise.all([api.get('/representative/relationships'), api.get('/representative/requests')])
      setRelationships(r.data); setRequests(q.data)
    } catch (e) { setError(errorMessage(e, 'Could not load representative dashboard.')) }
  }
  useEffect(() => {
    load()
    const timer = window.setInterval(load, 15000)
    return () => window.clearInterval(timer)
  }, [])

  async function decide(id, decision) {
    setBusy(id); setError(null)
    try { await api.post(`/representative/requests/${id}/decision`, { decision }); await load() }
    catch (e) { setError(errorMessage(e, 'Could not save decision.')) }
    finally { setBusy(null) }
  }

  async function emergency(event) {
    event.preventDefault(); setBusy('emergency'); setError(null)
    try {
      await api.post('/representative/emergency-access', { patient_id: Number(emergencyPatient), reason: emergencyReason, duration_minutes: 30 })
      setEmergencyPatient(''); setEmergencyReason(''); await load()
    } catch (e) { setError(errorMessage(e, 'Emergency access could not be granted.')) }
    finally { setBusy(null) }
  }

  async function viewRecord(item) {
    setBusy(`record-${item.id}`); setError(null)
    try {
      const response = await api.get(`/representative/patients/${item.patient_id}/record`, { params: { request_id: item.id } })
      setOpenRecord(item.id); setRecordData(response.data)
    } catch (e) { setError(errorMessage(e, 'Could not open this record. Only an active approved grant can open it.')) }
    finally { setBusy(null) }
  }

  if (!relationships || !requests) return <><PageHeader title="Representative Portal" subtitle="Review patient-designated relationships and record-access requests." /><ErrorNote>{error}</ErrorNote>{!error && <Spinner label="Loading representative workspace…" />}</>
  const pending = requests.filter((r) => ['pending', 'patient_approved'].includes(r.status) && !r.is_emergency)
  const grantStillActive = (r) => ['representative_approved', 'emergency_granted'].includes(r.status) && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now())
  const activeGrants = requests.filter(grantStillActive)
  return <>
    <PageHeader title="Representative Portal" subtitle="Review and approve record-access requests for patients who have authorised you." />
    <ErrorNote>{error}</ErrorNote>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard icon={Users} label="Patient relationships" value={relationships.length} />
      <StatCard icon={Clock3} label="Pending reviews" value={pending.length} tone={pending.length ? 'warn' : 'good'} />
      <StatCard icon={FileText} label="Approved / emergency grants" value={activeGrants.length} tone="good" />
    </div>

    <section className="card mt-5 p-5">
      <CardHeader title="Pending access requests" description="The patient is notified immediately and may reject a suspicious request. A patient rejection overrides representative approval." />
      {pending.length === 0 ? <p className="rounded-xl bg-blush-100 px-4 py-6 text-sm text-ink-500 dark:bg-ink-800 dark:text-ink-400">No requests are waiting for your review.</p> : <div className="space-y-3">{pending.map((item) => <article key={item.id} className="rounded-2xl border border-wine-100 p-4 dark:border-ink-700">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-ink-900 dark:text-blush-50">{item.patient_name} <span className="font-normal text-ink-500">({item.patient_ref})</span></h3><p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Requested by {item.requester_name} · {item.requester_email}</p><p className="mt-1 text-sm"><span className="font-semibold">{item.access_scope === 'full' ? 'Full access' : 'Limited access'}</span> · {new Date(item.created_at).toLocaleString()}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{item.status.replaceAll('_', ' ')}</span></div>
        <p className="mt-3 rounded-xl bg-blush-50 p-3 text-sm text-ink-700 dark:bg-ink-800 dark:text-ink-200"><strong>Reason:</strong> {item.reason}</p>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === item.id || item.status !== 'patient_approved'} onClick={() => decide(item.id, 'approve')} className="btn-primary btn-sm" title={item.status !== 'patient_approved' ? 'Waiting for the patient to approve this request' : 'Approve access'}><Check size={15} /> {item.status === 'patient_approved' ? `Approve ${item.access_scope}` : 'Waiting for patient approval'}</button><button disabled={busy === item.id} onClick={() => decide(item.id, 'reject')} className="btn-outline btn-sm"><X size={15} /> Reject</button></div>
      </article>)}</div>}
    </section>

    <section className="card mt-5 p-5">
      <CardHeader title="Patients who designated you" description="Only patients who explicitly selected your account appear here." />
      {relationships.length === 0 ? <p className="rounded-xl bg-blush-100 px-4 py-6 text-sm text-ink-500 dark:bg-ink-800 dark:text-ink-400">No patients have designated this representative account yet. Sign in as a patient and designate representative@medisight.dev from the health overview.</p> : <div className="grid gap-3 sm:grid-cols-2">{relationships.map((r) => <div key={r.id} className="rounded-2xl border border-wine-100 p-4 dark:border-ink-700"><h3 className="font-bold">{r.patient_name}</h3><p className="text-sm text-ink-500">{r.patient_ref}</p><p className="mt-2 text-xs text-emerald-700">Relationship active</p></div>)}</div>}
    </section>

    <section className="card mt-5 p-5">
      <CardHeader title="Emergency access (break-glass)" description="Use only when there is a genuine emergency and waiting for a normal decision is unsafe. It lasts 30 minutes, is audited, and notifies the patient." />
      <form onSubmit={emergency} className="grid gap-3 md:grid-cols-[0.7fr_1.3fr_auto] md:items-end">
        <div><label className="label" htmlFor="emergency-patient">Designated patient</label><select id="emergency-patient" required value={emergencyPatient} onChange={(e) => setEmergencyPatient(e.target.value)} className="field"><option value="">Select a patient</option>{relationships.map((r) => <option key={r.patient_id} value={r.patient_id}>{r.patient_name} ({r.patient_ref})</option>)}</select></div>
        <div><label className="label" htmlFor="emergency-reason">Emergency reason</label><input id="emergency-reason" required minLength={10} value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} className="field" placeholder="Explain why immediate access is necessary" /></div>
        <button className="btn-primary btn-sm" disabled={busy === 'emergency'} type="submit">{busy === 'emergency' ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />} Start 30-minute access</button>
      </form>
    </section>

    <section className="card mt-5 p-5">
      <CardHeader title="Approval history and active grants" description="Only approved or emergency-granted requests can open a record." />
      {requests.filter((r) => !pending.includes(r)).length === 0 ? <p className="text-sm text-ink-500">No history yet.</p> : <div className="space-y-3">{requests.filter((r) => !pending.includes(r)).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-700"><div><p className="font-semibold">{item.patient_name} · {item.access_scope === 'full' ? 'Full' : 'Limited'} access</p><p className="text-xs text-ink-500">{item.status.replaceAll('_', ' ')}{item.expires_at ? ` · expires ${new Date(item.expires_at).toLocaleString()}` : ''}</p></div>{grantStillActive(item) && <button className="btn-outline btn-sm" onClick={() => viewRecord(item)} disabled={busy === `record-${item.id}`}>{busy === `record-${item.id}` ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Open authorized record</button>}</div>)}</div>}
      {recordData && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:bg-ink-800"><h3 className="font-bold">Authorized record: {recordData.patient_ref}</h3><p className="mt-1 text-sm">Blood group: {recordData.blood_group || 'Not recorded'} {recordData.blood_group_verified ? '(clinician verified)' : '(not verified)'}</p><p className="mt-1 text-sm">Active conditions: {recordData.conditions.filter((c) => c.active).map((c) => c.name).join(', ') || 'None recorded'}</p><p className="mt-1 text-sm">Visits: {recordData.visits.length} · Lab results: {recordData.lab_results.length} · Prescriptions visible: {recordData.prescriptions.length}</p><p className="mt-1 text-xs text-ink-500">This record is being displayed under grant #{openRecord}. Do not rely on patient-reported blood group for transfusion decisions.</p></div>}
    </section>
  </>
}
