import React, { useEffect, useState } from 'react'
import { Bell, ShieldCheck, Check, X, Loader2, UserRoundCheck } from 'lucide-react'
import { CardHeader, ErrorNote } from './ui.jsx'
import api, { errorMessage } from '../services/api'

export default function PatientAccessPanel() {
  const [email, setEmail] = useState('representative@medisight.dev')
  const [requests, setRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function load() {
    try {
      const [r, n] = await Promise.all([api.get('/access-requests/mine'), api.get('/notifications')])
      setRequests(r.data); setNotifications(n.data)
    } catch (e) { setError(errorMessage(e, 'Could not load access requests or notifications.')) }
  }
  useEffect(() => {
    load()
    const timer = window.setInterval(load, 15000)
    return () => window.clearInterval(timer)
  }, [])

  async function designate(e) {
    e.preventDefault(); setBusy(true); setError(null); setMessage(null)
    try { const res = await api.post('/representative/designate', { representative_email: email }); setMessage(res.data.message); await load() }
    catch (e) { setError(errorMessage(e, 'Could not designate representative.')) }
    finally { setBusy(false) }
  }

  async function decide(id, decision) {
    setBusy(true); setError(null); setMessage(null)
    try { const res = await api.post(`/access-requests/${id}/patient-decision`, { decision }); setMessage(res.data.message); await load() }
    catch (e) { setError(errorMessage(e, 'Could not save your decision.')) }
    finally { setBusy(false) }
  }

  async function markRead(item) {
    try { await api.post(`/notifications/${item.id}/read`); await load() }
    catch (e) { setError(errorMessage(e, 'Could not mark notification read.')) }
  }

  return <section className="card mt-5 p-5">
    <CardHeader title="Representative & access approvals" description="Designate a trusted representative. You are notified when a clinician requests access and can reject anything you do not recognise." />
    <form onSubmit={designate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><label htmlFor="representative-email" className="label">Representative email</label><input id="representative-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></div><button disabled={busy} className="btn-primary btn-sm" type="submit">{busy ? <Loader2 size={15} className="animate-spin" /> : <UserRoundCheck size={15} />} Designate representative</button></form>
    <ErrorNote>{error}</ErrorNote>
    {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">{message}</p>}
    <div className="mt-5"><CardHeader title="Access requests" description="Representative approval is required for normal access. Your rejection blocks the request." />
      {requests.length === 0 ? <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">No clinician access requests yet.</p> : <div className="mt-3 space-y-3">{requests.map((r) => <article key={r.id} className="rounded-2xl border border-wine-100 p-4 dark:border-ink-700"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{r.requester_name} requests {r.access_scope} access</h3><p className="text-xs text-ink-500">{r.requester_email} · {new Date(r.created_at).toLocaleString()}</p></div><span className="rounded-full bg-blush-100 px-3 py-1 text-xs font-semibold dark:bg-ink-800">{r.status.replaceAll('_', ' ')}</span></div><p className="mt-2 text-sm">Reason: {r.reason}</p>{r.status === 'pending' && <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className="btn-outline btn-sm" onClick={() => decide(r.id, 'approve')}><Check size={14} /> Allow representative review</button><button disabled={busy} className="btn-outline btn-sm" onClick={() => decide(r.id, 'reject')}><X size={14} /> Reject request</button></div>}{r.status === 'patient_approved' && <p className="mt-2 text-xs text-emerald-700">Your representative must still make the final access decision.</p>}</article>)}</div>}
    </div>
    <div className="mt-5"><CardHeader title="Notifications" description="In-app alerts from this project; email notifications are not configured." />{notifications.length === 0 ? <p className="mt-3 text-sm text-ink-500">No notifications.</p> : <div className="mt-3 space-y-2">{notifications.slice(0, 8).map((n) => <div key={n.id} className={`rounded-xl border p-3 ${n.is_read ? 'border-ink-100 dark:border-ink-800' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/10'}`}><div className="flex items-start gap-2"><Bell size={15} className="mt-0.5 shrink-0" /><div className="flex-1"><p className="text-sm font-semibold">{n.title}</p><p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{n.message}</p><p className="mt-1 text-xs text-ink-500">{new Date(n.created_at).toLocaleString()}</p></div>{!n.is_read && <button className="btn-outline btn-sm" onClick={() => markRead(n)} aria-label="Mark notification as read">Mark read</button>}</div></div>)}</div>}</div>
    <p className="mt-4 rounded-xl bg-blush-50 p-3 text-xs leading-relaxed text-ink-600 dark:bg-ink-800 dark:text-ink-300"><ShieldCheck size={14} className="mr-1 inline" /> Emergency break-glass access is a separate path for a genuine emergency, requires a reason, expires automatically, creates an audit entry, and sends you an in-app notification. Silence alone never authorizes access.</p>
  </section>
}
