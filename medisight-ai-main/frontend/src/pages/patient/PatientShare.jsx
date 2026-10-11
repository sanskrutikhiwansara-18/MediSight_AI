import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, QrCode, ShieldOff, RefreshCw, ScanLine, Clock, ScrollText, ShieldCheck, UserPlus, RotateCcw } from 'lucide-react'
import { PageHeader, ErrorNote } from '../../components/ui.jsx'
import api, { errorMessage } from '../../services/api'

function useCountdown(expiresAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  if (!expiresAt) return null
  const iso = /[zZ]|[+-]\\d\\d:?\\d\\d$/.test(expiresAt) ? expiresAt : `${expiresAt}Z`
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000))
}

function formatRemaining(seconds) {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function ConsentManager() {
  const [consents, setConsents] = useState([])
  const [clinicianId, setClinicianId] = useState('')
  const [scope, setScope] = useState('qr_access')
  const [expiry, setExpiry] = useState('24')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(null)

  const loadConsents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/consents/mine')
      setConsents(response.data)
    } catch (e) {
      setError(errorMessage(e, 'Could not load your consent settings.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConsents() }, [loadConsents])

  async function grantConsent(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice('')
    try {
      const expires_at = expiry === 'never' ? null : new Date(Date.now() + Number(expiry) * 60 * 60 * 1000).toISOString()
      await api.post('/consents', {
        authorized_user_id: Number(clinicianId),
        access_scope: scope,
        expires_at,
      })
      setClinicianId('')
      setNotice('Consent granted. You can revoke it at any time below.')
      await loadConsents()
    } catch (e) {
      setError(errorMessage(e, 'Could not grant consent. Check the clinician/admin ID and try again.'))
    } finally {
      setSaving(false)
    }
  }

  async function revokeConsent(id) {
    setBusyId(id)
    setError(null)
    setNotice('')
    try {
      await api.post(`/consents/${id}/revoke`)
      setNotice('Consent revoked.')
      await loadConsents()
    } catch (e) {
      setError(errorMessage(e, 'Could not revoke this consent.'))
    } finally {
      setBusyId(null)
    }
  }

  const active = (status) => String(status).toLowerCase() === 'active'

  return (
    <section className="card p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wine-50 text-wine-600 dark:bg-wine-900/30 dark:text-wine-300">
          <ShieldCheck size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[0.95rem] font-bold text-ink-900 dark:text-blush-50">Consent & access control</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600 dark:text-ink-300">Choose which verified clinician or administrator can access a specific feature. You control the expiry and can revoke permission.</p>
        </div>
      </div>

      <form onSubmit={grantConsent} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-200">
          Clinician / admin user ID
          <input required type="number" min="1" step="1" value={clinicianId} onChange={(e) => setClinicianId(e.target.value)} placeholder="Enter ID provided by your clinic" className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-wine-500 dark:border-ink-700 dark:bg-ink-900 dark:text-blush-50" />
        </label>
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-200">
          Permission scope
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-wine-500 dark:border-ink-700 dark:bg-ink-900 dark:text-blush-50">
            <option value="qr_access">QR access</option>
            <option value="patient_record">Patient record</option>
            <option value="emergency_access">Emergency access</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-700 dark:text-ink-200 sm:col-span-2">
          Consent duration
          <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-wine-500 dark:border-ink-700 dark:bg-ink-900 dark:text-blush-50">
            <option value="1">1 hour</option>
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
            <option value="720">30 days</option>
            <option value="never">No expiry (until revoked)</option>
          </select>
        </label>
        <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
          {saving ? 'Saving consent…' : 'Grant consent'}
        </button>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-ink-500 dark:text-ink-400">Only use the account ID given by your clinic. Emergency access is a recorded permission scope; this setting alone does not trigger emergency override workflows.</p>

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}

      <div className="mt-7 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink-900 dark:text-blush-50">Your consent history</h3>
        <button type="button" onClick={loadConsents} disabled={loading} className="btn-outline btn-sm"><RotateCcw size={14} aria-hidden="true" /> Refresh</button>
      </div>
      {loading ? <p className="mt-4 flex items-center gap-2 text-sm text-ink-500"><Loader2 size={16} className="animate-spin" /> Loading consents…</p> : consents.length === 0 ? (
        <p className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">No consent permissions yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {consents.map((consent) => (
            <li key={consent.id} className="flex flex-col gap-3 rounded-xl border border-ink-100 p-4 dark:border-ink-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900 dark:text-blush-50">User ID {consent.authorized_user_id} · {String(consent.access_scope).replaceAll('_', ' ')}</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Granted {consent.created_at ? new Date(consent.created_at).toLocaleString() : 'date unavailable'} · {consent.expires_at ? `Expires ${new Date(consent.expires_at).toLocaleString()}` : 'No expiry set'}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300">Status: {consent.status}</p>
              </div>
              {active(consent.status) && <button type="button" onClick={() => revokeConsent(consent.id)} disabled={busyId === consent.id} className="btn-outline btn-sm self-start sm:self-center"><ShieldOff size={14} aria-hidden="true" /> {busyId === consent.id ? 'Revoking…' : 'Revoke'}</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function PatientShare() {
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [revoked, setRevoked] = useState(false)
  const remaining = useCountdown(qr?.expires_at)
  const expired = qr && remaining === 0

  async function generate() {
    setLoading(true)
    setError(null)
    setRevoked(false)
    try {
      const resp = await api.post('/me/qr')
      setQr(resp.data)
    } catch (e) {
      setError(errorMessage(e, 'Could not create a QR code.'))
    } finally {
      setLoading(false)
    }
  }

  async function stopSharing() {
    if (!qr) return
    setError(null)
    try {
      await api.post(`/me/qr/revoke/${encodeURIComponent(qr.token)}`)
      setRevoked(true)
      setQr(null)
    } catch (e) {
      setError(errorMessage(e, 'Could not cancel this code.'))
    }
  }

  const live = qr && !expired

  return (
    <>
      <PageHeader title="Share access" subtitle="Control clinician permissions, review consent history, and create a short-lived QR code when you need to share your record." />
      <div className="space-y-5">
        <ConsentManager />
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <section className="card flex flex-col items-center justify-center p-6 text-center sm:p-8">
            {live ? (
              <>
                <div className="rounded-2xl border border-wine-100 bg-white p-4 shadow-soft dark:border-ink-700 dark:bg-ink-800">
                  <img src={`data:image/png;base64,${qr.qr_image_base64}`} alt="Your one-time QR code for clinicians to scan" className="h-56 w-56 sm:h-64 sm:w-64" />
                </div>
                <p className="mt-5 flex items-center gap-2 text-sm font-bold text-ink-900 dark:text-blush-50"><Clock size={16} className="text-wine-600 dark:text-wine-300" aria-hidden="true" /> Expires in <span className="tabular-nums text-wine-700 dark:text-wine-300">{formatRemaining(remaining)}</span></p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button onClick={stopSharing} className="btn-outline btn-sm"><ShieldOff size={14} aria-hidden="true" /> Stop sharing</button>
                  <button onClick={generate} disabled={loading} className="btn-outline btn-sm"><RefreshCw size={14} aria-hidden="true" /> New code</button>
                </div>
              </>
            ) : (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wine-50 text-wine-500 dark:bg-wine-900/30"><QrCode size={28} aria-hidden="true" /></span>
                <h2 className="mt-4 text-lg font-bold text-ink-900 dark:text-blush-50">{expired ? 'That code has expired' : revoked ? 'Sharing stopped' : 'No active code'}</h2>
                <p className="mt-1 max-w-xs text-sm text-ink-500 dark:text-ink-400">{revoked ? 'The code no longer opens your record. Create a new one whenever you need to.' : 'Create a code when you are with a clinician. It works for 15 minutes.'}</p>
                <button onClick={generate} disabled={loading} className="btn-primary mt-5">{loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <QrCode size={16} aria-hidden="true" />}{loading ? 'Creating…' : 'Create QR code'}</button>
              </>
            )}
            {error && <div className="mt-4 w-full"><ErrorNote>{error}</ErrorNote></div>}
          </section>
          <section className="card p-6 sm:p-8">
            <h2 className="text-[0.95rem] font-bold text-ink-900 dark:text-blush-50">What happens when a clinician scans it</h2>
            <ul className="mt-4 space-y-5">
              {[
                [ScanLine, 'They scan the code', 'It contains a random token only. Your name and health data are not inside the image.'],
                [Clock, 'It only lasts a short time', 'The token expires after 15 minutes. You can cancel it sooner with Stop sharing.'],
                [ScrollText, 'The access is logged', 'Each scan and record view is written to the audit trail, so there is a record of who looked.'],
              ].map(([Icon, title, text]) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wine-50 text-wine-600 dark:bg-wine-900/30 dark:text-wine-300"><Icon size={17} aria-hidden="true" /></span>
                  <div><p className="text-sm font-bold text-ink-900 dark:text-blush-50">{title}</p><p className="mt-0.5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{text}</p></div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
