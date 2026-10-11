import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScanLine, Loader2, ChevronRight, History, FileText, Send } from 'lucide-react'
import QRScanner from '../components/QRScanner.jsx'
import EmergencyAccess from '../components/EmergencyAccess.jsx'
import { PageHeader, CardHeader, ErrorNote, Avatar } from '../components/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { firstNameOf, greeting } from '../lib/roles.js'
import { getRecent } from '../lib/recent.js'
import api, { errorMessage } from '../services/api'

export default function ClinicianDashboard() {
  const { auth } = useAuth()
  const [showScanner, setShowScanner] = useState(false)
  const [error, setError] = useState(null)
  const [resolving, setResolving] = useState(false)
  const navigate = useNavigate()
  const recent = getRecent()
  const [patientRef, setPatientRef] = useState('')
  const [accessScope, setAccessScope] = useState('limited')
  const [requestReason, setRequestReason] = useState('')
  const [accessRequests, setAccessRequests] = useState([])
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestMessage, setRequestMessage] = useState(null)

  async function loadAccessRequests() {
    try { const response = await api.get('/access-requests/sent'); setAccessRequests(response.data) }
    catch (e) { setError(errorMessage(e, 'Could not load access requests.')) }
  }

  useEffect(() => { loadAccessRequests() }, [])

  async function submitAccessRequest(event) {
    event.preventDefault(); setRequestBusy(true); setError(null); setRequestMessage(null)
    try {
      const response = await api.post('/access-requests/by-reference', { patient_ref: patientRef.trim(), access_scope: accessScope, reason: requestReason })
      setRequestMessage(`Request sent for ${response.data.patient_ref}. Patient and representative were notified in-app.`)
      setPatientRef(''); setRequestReason(''); await loadAccessRequests()
    } catch (e) { setError(errorMessage(e, 'Could not submit access request.')) }
    finally { setRequestBusy(false) }
  }

  async function handleScan(token) {
    setError(null)
    setResolving(true)
    try {
      const resp = await api.post('/qr/validate', { token })
      if (resp.data.valid) {
        setShowScanner(false)
        navigate(`/patients/${resp.data.patient_id}`)
      } else {
        setShowScanner(false)
        setError(resp.data.reason || 'This QR code is not valid.')
      }
    } catch (e) {
      setError(errorMessage(e, 'Could not validate this code.'))
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstNameOf(auth.fullName)}`}
        subtitle="Scan a patient’s QR code to open their record. There is no patient list by design: access always starts with the patient."
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <section className="card flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wine-50 dark:bg-wine-900/30 text-wine-600 dark:text-wine-300">
            <ScanLine size={30} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-ink-900 dark:text-blush-50">Scan a patient QR to begin</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            The code carries only a random, revocable, time-limited token. No medical data is stored in the image.
          </p>
          <button onClick={() => setShowScanner(true)} className="btn-primary mt-6 px-6 py-3">
            <ScanLine size={16} aria-hidden="true" /> Scan patient QR
          </button>
          {resolving && (
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Validating token…
            </p>
          )}
          {error && (
            <div className="mt-4 max-w-sm">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="card p-5">
            <CardHeader title="Opened this session" description="Clears when you log out or close the tab." />
            {recent.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-blush-100 dark:bg-ink-800 px-4 py-4 text-sm text-ink-500 dark:text-ink-400">
                <History size={16} aria-hidden="true" /> No records opened yet.
              </p>
            ) : (
              <ul className="-mx-2 divide-y divide-wine-50 dark:divide-ink-700">
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link to={`/patients/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-wine-50">
                      <Avatar name={p.ref.replace('PT-', 'P ')} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink-900 dark:text-blush-50">{p.ref}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400">
                          {p.age} years, {p.gender}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-ink-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="card mt-5 p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900 dark:text-blush-50"><FileText size={18} /> Request record access</h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Use the patient's reference (for example PT-00001). The patient is notified immediately and can reject an unfamiliar request; the designated representative makes the final access decision.</p>
        <form onSubmit={submitAccessRequest} className="mt-4 grid gap-3 md:grid-cols-[0.8fr_0.7fr_1.5fr_auto] md:items-end">
          <div><label htmlFor="patient-ref" className="label">Patient reference</label><input id="patient-ref" className="field" required value={patientRef} onChange={(e) => setPatientRef(e.target.value)} placeholder="PT-00001" /></div>
          <div><label htmlFor="access-scope" className="label">Access level</label><select id="access-scope" className="field" value={accessScope} onChange={(e) => setAccessScope(e.target.value)}><option value="limited">Limited</option><option value="full">Full</option></select></div>
          <div><label htmlFor="request-reason" className="label">Reason (min. 10 characters)</label><input id="request-reason" className="field" minLength={10} required value={requestReason} onChange={(e) => setRequestReason(e.target.value)} placeholder="Why is access needed?" /></div>
          <button className="btn-primary btn-sm" type="submit" disabled={requestBusy}>{requestBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send request</button>
        </form>
        {requestMessage && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">{requestMessage}</p>}
        {accessRequests.length > 0 && <div className="mt-5"><h3 className="mb-2 text-sm font-bold">Your access requests</h3><div className="space-y-2">{accessRequests.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-700"><div><p className="text-sm font-semibold">{r.patient_ref} · {r.access_scope} access</p><p className="text-xs text-ink-500">{r.status.replaceAll('_', ' ')} · {new Date(r.created_at).toLocaleString()}</p></div>{r.status === 'representative_approved' && <button type="button" className="btn-outline btn-sm" onClick={() => navigate(`/patients/${r.patient_id}`)}>Open approved record <ChevronRight size={14} /></button>}</div>)}</div></div>}
      </section>

      <EmergencyAccess />

      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </>
  )
}
