import React, { useEffect, useState } from 'react'
import { BadgeCheck, Loader2, Save, AlertTriangle } from 'lucide-react'
import { CardHeader, ErrorNote } from './ui.jsx'
import api, { errorMessage } from '../services/api'

const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function BloodGroupVerifier({ patient, onVerified }) {
  const [group, setGroup] = useState(patient.blood_group || '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => setGroup(patient.blood_group || ''), [patient.blood_group])

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError(null); setMessage(null)
    try {
      const response = await api.patch(`/patients/${patient.id}/blood-group/verify`, {
        blood_group: group,
        verification_note: note.trim(),
      })
      setMessage(response.data.message)
      setNote('')
      await onVerified?.()
    } catch (err) {
      setError(errorMessage(err, 'Could not verify the blood group.'))
    } finally {
      setBusy(false)
    }
  }

  return <section className="card mt-5 p-5">
    <CardHeader title="Blood-group verification" description="Verify only from a reliable clinical record or laboratory result. Do not guess." />
    <p className="mt-2 text-sm">Current value: <strong>{patient.blood_group || 'Not recorded'}</strong> · {patient.blood_group_verified ? 'Clinician verified' : 'Not clinically verified'}</p>
    {patient.access_scope === 'limited' ? <p className="mt-3 text-sm text-amber-800">Full record access is required to verify this field.</p> : <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[0.7fr_1.3fr_auto] sm:items-end">
      <div><label className="label" htmlFor="verify-blood-group">Lab-confirmed group</label><select id="verify-blood-group" className="field" value={group} onChange={(e) => setGroup(e.target.value)} required><option value="">Select group</option>{GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
      <div><label className="label" htmlFor="blood-group-note">Verification source / note</label><input id="blood-group-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} minLength={5} maxLength={300} required placeholder="e.g. verified from lab report dated ..." /></div>
      <button type="submit" className="btn-primary btn-sm" disabled={busy || !group || note.trim().length < 5}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Verify group</button>
    </form>}
    <ErrorNote>{error}</ErrorNote>
    {message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300"><BadgeCheck size={15} className="mr-1 inline" />{message}</p>}
    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/10 dark:text-amber-200"><AlertTriangle size={14} className="mr-1 inline" /> A stored value is not a transfusion cross-match. The treating hospital must independently confirm blood type before transfusion.</p>
  </section>
}
