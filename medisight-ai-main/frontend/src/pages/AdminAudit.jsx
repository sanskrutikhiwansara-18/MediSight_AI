import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldCheck, ShieldAlert, Loader2, Download, Search, ScrollText, Ban, CheckCircle2 } from 'lucide-react'
import { PageHeader, CardHeader, ErrorNote, Spinner, StatCard } from '../components/ui.jsx'
import api, { errorMessage } from '../services/api'

const csvCell = (value) => {
  const raw = String(value ?? '')
  const safe = /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw
  return '"' + safe.replaceAll('"', '""') + '"'
}

export default function AdminAudit() {
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [testing, setTesting] = useState(false)
  const [query, setQuery] = useState('')
  const [resultFilter, setResultFilter] = useState('all')

  const refresh = useCallback(() => {
    setError(null)
    api.get('/audit/logs?limit=100')
      .then((r) => setLogs(r.data))
      .catch((e) => setError(errorMessage(e, 'Could not load the audit log.')))
  }, [])
  useEffect(refresh, [refresh])

  async function tryPatientAccess() {
    setTesting(true)
    setAttempt(null)
    try {
      await api.get('/patients/1')
      setAttempt({ ok: true })
    } catch (e) {
      setAttempt({ ok: false, status: e?.response?.status, detail: e?.response?.data?.detail })
    } finally {
      setTesting(false)
      refresh()
    }
  }

  const denied = (logs || []).filter((l) => !l.success).length
  const filteredLogs = useMemo(() => (logs || []).filter((log) => {
    if (resultFilter === 'allowed' && !log.success) return false
    if (resultFilter === 'denied' && log.success) return false
    const needle = query.trim().toLowerCase()
    return !needle || [log.actor_role, log.action, log.resource, log.timestamp, log.id]
      .some((v) => String(v ?? '').toLowerCase().includes(needle))
  }), [logs, query, resultFilter])

  function exportCsv() {
    const columns = ['timestamp', 'actor_role', 'action', 'resource', 'success']
    const rows = filteredLogs.map((log) => columns.map((key) =>
      csvCell(key === 'success' ? (log.success ? 'Allowed' : 'Denied') : log[key])).join(','))
    const blob = new Blob([[columns.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'medisight-audit-log.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return <>
    <PageHeader title="Audit & access" subtitle="Review access events and verify that admins cannot open patient records."
      actions={<><button onClick={refresh} className="btn-outline btn-sm"><RefreshCw size={14} aria-hidden="true" /> Refresh</button>
        <button onClick={exportCsv} disabled={!filteredLogs.length} className="btn-primary btn-sm"><Download size={14} aria-hidden="true" /> Export CSV</button></>} />
    <ErrorNote>{error}</ErrorNote>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      <StatCard icon={ScrollText} label="Recent events" value={logs ? logs.length : '–'} note="Latest 100" />
      <StatCard icon={CheckCircle2} label="Allowed" value={logs ? logs.length - denied : '–'} tone="good" />
      <StatCard icon={Ban} label="Denied" value={logs ? denied : '–'} tone={denied ? 'bad' : 'good'} noteTone="bad" />
    </div>
    <section className="card mt-5 p-5">
      <CardHeader title="Access control check" description="The server should deny this patient-record request made with an admin session."
        action={<button onClick={tryPatientAccess} disabled={testing} className="btn-dark btn-sm shrink-0">
          {testing && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}{testing ? 'Requesting…' : 'Attempt patient access'}</button>} />
      {attempt && <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${attempt.ok ? 'border-crimson-500/30 bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'}`} role="status">
        {attempt.ok ? <ShieldAlert size={18} className="mt-0.5 shrink-0" /> : <ShieldCheck size={18} className="mt-0.5 shrink-0" />}
        <span>{attempt.ok ? 'Unexpected: access was allowed. Check the backend role guard before presenting this demo.' : `Blocked as expected. Server answered ${attempt.status}: ${attempt.detail || 'Access denied'}`}</span>
      </div>}
    </section>
    <section className="card mt-5 p-5">
      <CardHeader title="Recent audit log" description="Search and filter the latest 100 events. CSV export includes only the visible filtered rows." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, role, resource…" aria-label="Search audit logs"
            className="w-full rounded-xl border border-wine-100 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-800 outline-none focus:border-wine-400 dark:border-ink-700 dark:bg-ink-900 dark:text-blush-50" />
        </label>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} aria-label="Filter audit result"
          className="rounded-xl border border-wine-100 bg-white px-3 py-2.5 text-sm text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-blush-50">
          <option value="all">All results</option><option value="allowed">Allowed only</option><option value="denied">Denied only</option>
        </select>
      </div>
      {!logs && !error && <Spinner />}
      {logs && <div className="-mx-1 overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
        <thead><tr className="table-head"><th className="px-1 py-2 text-left font-semibold">Time</th><th className="px-1 py-2 text-left font-semibold">Role</th><th className="px-1 py-2 text-left font-semibold">Action</th><th className="px-1 py-2 text-left font-semibold">Resource</th><th className="px-1 py-2 text-left font-semibold">Result</th></tr></thead>
        <tbody>{filteredLogs.map((log) => <tr key={log.id} className="border-b border-wine-50 dark:border-ink-700 last:border-0">
          <td className="whitespace-nowrap px-1 py-2.5 text-xs text-ink-500 dark:text-ink-400">{new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(log.timestamp) ? log.timestamp : `${log.timestamp}Z`).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
          <td className="px-1 py-2.5 capitalize text-ink-600 dark:text-ink-300">{log.actor_role}</td>
          <td className="px-1 py-2.5 font-semibold text-ink-800 dark:text-blush-100">{log.action.replaceAll('_', ' ').toLowerCase()}</td>
          <td className="px-1 py-2.5 text-ink-500 dark:text-ink-400">{log.resource}</td>
          <td className="px-1 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${log.success ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300'}`}>{log.success ? 'Allowed' : 'Denied'}</span></td>
        </tr>)}{filteredLogs.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-ink-500 dark:text-ink-400">No audit events match this filter.</td></tr>}</tbody>
      </table></div>}
    </section>
  </>
}
