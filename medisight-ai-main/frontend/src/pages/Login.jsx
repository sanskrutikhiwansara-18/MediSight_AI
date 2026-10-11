import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import { ErrorNote } from '../components/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { ROLES, homeFor } from '../lib/roles.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const requested = params.get('role')
  const role = ROLES.some((r) => r.id === requested) ? requested : 'patient'
  const current = ROLES.find((r) => r.id === role)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function chooseRole(id) {
    setParams({ role: id }, { replace: true })
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await login(email.trim(), password, role)
      navigate(homeFor(result.role), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function fillDemo() {
    setEmail(current.demo.email)
    setPassword(current.demo.password)
    setError(null)
  }

  return (
    <AuthShell
      panelTitle="Your health, our priority."
      panelText="One place for records, explained AI insight and private sharing. Patients, clinicians and admins each get their own view."
    >
      <div className="rounded-3xl border border-wine-100 dark:border-ink-700 bg-white/90 p-6 shadow-lift sm:p-8 dark:bg-ink-800/90">
        <h1 className="font-display text-3xl font-medium text-ink-900 dark:text-blush-50">Welcome back</h1>
        <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">Log in to your MediSight account.</p>

        <div role="tablist" aria-label="Sign in as" className="mt-6 grid grid-cols-3 gap-1 rounded-2xl bg-blush-200 dark:bg-ink-700 p-1">
          {ROLES.map(({ id, label, icon: Icon }) => {
            const active = id === role
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => chooseRole(id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition-all ${
                  active ? 'bg-white text-wine-700 dark:bg-ink-700 dark:text-wine-300 shadow-soft' : 'text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-blush-50'
                }`}
              >
                <Icon size={16} className="shrink-0" aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-3 min-h-[2.5rem] text-xs leading-relaxed text-ink-500 dark:text-ink-400">{current.blurb}</p>

        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <div>
            <label htmlFor="email" className="label">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field pr-12"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-400 hover:text-ink-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <ErrorNote>{error}</ErrorNote>

          <button type="submit" disabled={submitting} className="btn-primary w-full rounded-xl py-3">
            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {submitting ? 'Logging in…' : `Log in as ${current.label.toLowerCase()}`}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
          {role === 'patient' ? (
            <p className="text-ink-500 dark:text-ink-400">
              New here?{' '}
              <Link to="/signup" className="font-bold text-wine-600 dark:text-wine-300 hover:underline">
                Create a patient account
              </Link>
            </p>
          ) : (
            <p className="text-xs text-ink-500 dark:text-ink-400">{current.label} accounts are created by your organization.</p>
          )}
          <button type="button" onClick={fillDemo} className="text-xs font-semibold text-ink-500 dark:text-ink-400 underline decoration-wine-300 underline-offset-4 hover:text-wine-600">
            Use demo {current.label.toLowerCase()} login
          </button>
        </div>

        <Link to="/representative/login" className="mt-5 flex items-center gap-3 rounded-2xl border border-wine-100 bg-gradient-to-r from-blush-50 to-white p-3.5 transition hover:border-wine-300 dark:border-ink-700 dark:from-ink-800 dark:to-ink-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wine-100 text-wine-800 dark:bg-wine-900/50 dark:text-wine-200">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink-800 dark:text-blush-100">Parent or guardian?</span>
            <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">Access requests for patients who have designated you.</span>
          </span>
          <span className="text-sm font-semibold text-wine-700 dark:text-wine-300">Sign in to Representative Portal →</span>
        </Link>
      </div>
    </AuthShell>
  )
}
