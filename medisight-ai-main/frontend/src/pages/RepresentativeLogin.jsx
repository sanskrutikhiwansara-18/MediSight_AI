import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import { ErrorNote } from '../components/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { homeFor } from '../lib/roles.js'

export default function RepresentativeLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('representative@medisight.dev')
  const [password, setPassword] = useState('Guardian123!')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await login(email.trim(), password, 'representative')
      navigate(homeFor(result.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Could not sign in to the Representative Portal.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell panelTitle="Support someone you care about." panelText="Review record-access requests for patients who have explicitly designated you. Emergency access is time-limited and audited.">
      <div className="rounded-3xl border border-wine-100 bg-white/90 p-6 shadow-lift dark:border-ink-700 dark:bg-ink-800/90 sm:p-8">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-wine-100 bg-gradient-to-r from-blush-50 to-white p-4 dark:border-ink-700 dark:from-ink-800 dark:to-ink-800">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wine-700 text-white"><ShieldCheck size={22} /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-wine-700 dark:text-wine-300">MediSight AI</p>
            <h1 className="mt-1 font-display text-2xl font-medium text-ink-900 dark:text-blush-50">Representative Portal</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">Review and approve record-access requests for patients who have authorised you.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="rep-email" className="label">Email address</label><input id="rep-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></div>
          <div><label htmlFor="rep-password" className="label">Password</label><div className="relative"><input id="rep-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field pr-12" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-400 hover:text-ink-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" disabled={submitting} className="btn-primary w-full rounded-xl py-3">{submitting && <Loader2 size={16} className="animate-spin" />}{submitting ? 'Signing in…' : 'Sign in to Representative Portal'}</button>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-ink-500 dark:text-ink-400">Local demo account prefilled. This is a development credential and must not be used in production.</p>
        <Link to="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-wine-700 dark:text-ink-300"><ArrowLeft size={15} /> Back to patient, clinician and admin login</Link>
      </div>
    </AuthShell>
  )
}
