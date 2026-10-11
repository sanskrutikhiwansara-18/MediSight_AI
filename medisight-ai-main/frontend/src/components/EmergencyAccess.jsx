import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2, ShieldCheck, ShieldOff, Clock } from 'lucide-react'
import { ErrorNote } from './ui.jsx'
import api, { errorMessage } from '../services/api'

// API datetimes are stored as UTC-naive strings. Explicitly parse them as UTC;
// otherwise browsers interpret them as local time and grants appear expired early.
function parseApiDate(value) {
  if (!value) return NaN
  const text = String(value)
  const hasTimezone = /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(text)
  return new Date(hasTimezone ? text : `${text.replace(' ', 'T')}Z`).getTime()
}

function formatApiDate(value) {
  const timestamp = parseApiDate(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'Unknown'
}

const SCOPES = [
  ['record', 'Patient record'],
  ['visits', 'Visits'],
  ['conditions', 'Conditions'],
  ['labs', 'Lab results'],
  ['prescriptions', 'Prescriptions'],
  ['qr_access', 'QR access'],
]

export default function EmergencyAccess() {
  const navigate = useNavigate()
  const [patientId, setPatientId] = useState('')
  const [reason, setReason] = useState('')
  const [scope, setScope] = useState('record')
  const [duration, setDuration] = useState('15')
  const [grants, setGrants] = useState([])
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function createGrant(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await api.post('/emergency-access', {
        patient_id: Number(patientId),
        reason: reason.trim(),
        access_scope: [scope],
        duration_minutes: Number(duration),
      })
      setGrants((current) => [response.data, ...current.filter((item) => item.id !== response.data.id)])
      setNotice(`Emergency access granted. Grant ID: ${response.data.id}`)
      setPatientId('')
      setReason('')
    } catch (e) {
      setError(errorMessage(e, 'Could not grant emergency access.'))
    } finally {
      setSaving(false)
    }
  }

  async function revokeGrant(grantId) {
    setBusyId(grantId)
    setError('')
    setNotice('')
    try {
      await api.post(`/emergency-access/${grantId}/revoke`)
      setGrants((current) => current.map((grant) =>
        grant.id === grantId ? { ...grant, revoked_at: new Date().toISOString() } : grant
      ))
      setNotice(`Emergency grant ${grantId} revoked.`)
    } catch (e) {
      setError(errorMessage(e, 'Could not revoke emergency access.'))
    } finally {
      setBusyId(null)
    }
  }

  function grantStatus(grant) {
    if (grant.revoked_at) return 'REVOKED'
    if (parseApiDate(grant.expires_at) <= Date.now()) return 'EXPIRED'
    return 'ACTIVE'
  }

  return (
    <section className="card mt-5 p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-blush-50">Emergency patient access</h2>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            Create a short-lived, scoped grant for a genuine emergency. The backend records the reason and audit events.
          </p>
        </div>
      </div>

      <form onSubmit={createGrant} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink-700 dark:text-ink-200">
          Patient ID
          <input required type="number" min="1" step="1" value={patientId}
            onChange={(e) => setPatientId(e.target.value)} placeholder="Enter patient ID"
            className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900" />
        </label>

        <label className="text-sm font-medium text-ink-700 dark:text-ink-200">
          Access scope
          <select value={scope} onChange={(e) => setScope(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900">
            {SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-ink-700 dark:text-ink-200 sm:col-span-2">
          Emergency reason (minimum 10 characters)
          <textarea required minLength={10} maxLength={500} rows={3} value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Document why emergency access is required"
            className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900" />
        </label>

        <label className="text-sm font-medium text-ink-700 dark:text-ink-200 sm:col-span-2">
          Grant duration
          <select value={duration} onChange={(e) => setDuration(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:border-ink-700 dark:bg-ink-900">
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </label>

        <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
          {saving ? 'Creating grant…' : 'Grant emergency access'}
        </button>
      </form>

      <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
        Emergency access is time-limited and logged. Use only for a genuine, documented emergency.
      </p>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <div className="mt-7">
        <h3 className="text-sm font-bold text-ink-900 dark:text-blush-50">Grants created in this session</h3>
        {grants.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">No grants created in this session yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {grants.map((grant) => {
              const status = grantStatus(grant)
              return (
                <li key={grant.id} className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink-900 dark:text-blush-50">Grant #{grant.id} · Patient {grant.patient_id}</p>
                    <span className="text-xs font-bold">{status}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">Scope: {grant.access_scope}</p>
                  <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Reason: {grant.reason}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                    <Clock size={13} aria-hidden="true" /> Expires: {formatApiDate(grant.expires_at)}
                  </p>
                  <button type="button" onClick={() => navigate(`/patients/${grant.patient_id}`)} disabled={status !== 'ACTIVE'} className="btn-primary btn-sm mt-3">
                    Open patient report
                  </button>
                  {status === 'ACTIVE' && (
                    <button type="button" onClick={() => revokeGrant(grant.id)} disabled={busyId === grant.id} className="btn-outline btn-sm mt-3">
                      {busyId === grant.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
                      Revoke access
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
