import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import AuthShell from '../components/AuthShell.jsx'
import { ErrorNote } from '../components/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { homeFor } from '../lib/roles.js'

function Rule({ ok, children }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-400'}`}>
      <Check size={13} aria-hidden="true" className={ok ? '' : 'opacity-40'} /> {children}
    </li>
  )
}

export default function Signup() {
  const { registerPatient } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', age: '', gender: '', region: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const rules = useMemo(
    () => ({
      length: form.password.length >= 8,
      letter: /[A-Za-z]/.test(form.password),
      number: /\d/.test(form.password),
    }),
    [form.password],
  )
  const passwordOk = rules.length && rules.letter && rules.number
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const age = Number(form.age)
    if (!Number.isInteger(age) || age < 18 || age > 120) return setError('Enter your age as a whole number between 18 and 120.')
    if (!passwordOk) return setError('Choose a password with at least 8 characters, including a letter and a number.')
    if (form.password !== form.confirm) return setError('The two passwords do not match.')

    setSubmitting(true)
    try {
      const result = await registerPatient({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        age,
        gender: form.gender,
        region: form.region.trim(),
      })
      navigate(homeFor(result.role), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      panelTitle="A health record that answers to you."
      panelText="Create a patient account to see your conditions, labs and medications, understand your AI risk score and share access on your terms."
    >
      <div className="rounded-3xl border border-wine-100 dark:border-ink-700 bg-white/90 p-6 shadow-lift sm:p-8 dark:bg-ink-800/90">
        <h1 className="font-display text-3xl font-medium text-ink-900 dark:text-blush-50">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">For patients. It takes about a minute.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="full_name" className="label">Full name</label>
            <input id="full_name" required autoComplete="name" value={form.full_name} onChange={set('full_name')} className="field" placeholder="Priya Sharma" />
          </div>
          <div>
            <label htmlFor="email" className="label">Email address</label>
            <input id="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className="field" placeholder="you@example.com" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="age" className="label">Age</label>
              <input id="age" type="number" inputMode="numeric" min="18" max="120" required value={form.age} onChange={set('age')} className="field" placeholder="34" />
            </div>
            <div>
              <label htmlFor="gender" className="label">Gender</label>
              <select id="gender" required value={form.gender} onChange={set('gender')} className="field">
                <option value="" disabled>Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="region" className="label">
              City or district <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <input id="region" autoComplete="address-level2" value={form.region} onChange={set('region')} className="field" placeholder="Pune" />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
                className="field pr-12"
                placeholder="Create a password"
                aria-describedby="password-rules"
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
            <ul id="password-rules" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Rule ok={rules.length}>8+ characters</Rule>
              <Rule ok={rules.letter}>A letter</Rule>
              <Rule ok={rules.number}>A number</Rule>
            </ul>
          </div>

          <div>
            <label htmlFor="confirm" className="label">Confirm password</label>
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={set('confirm')}
              className={`field ${mismatch ? 'border-crimson-500 focus:border-crimson-500 focus:ring-crimson-500/20' : ''}`}
              placeholder="Repeat your password"
              aria-invalid={mismatch}
            />
            {mismatch && <p className="mt-1.5 text-xs font-semibold text-crimson-700 dark:text-crimson-400">Passwords do not match yet.</p>}
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-wine-50 dark:bg-wine-900/30 px-3.5 py-3 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
            <Lock size={14} className="mt-0.5 shrink-0 text-wine-600 dark:text-wine-300" aria-hidden="true" />
            Your name and email stay with your login. Your health record stores only age, gender and area, so clinicians never see who you are next to a diagnosis.
          </p>

          <ErrorNote>{error}</ErrorNote>

          <button type="submit" disabled={submitting} className="btn-primary w-full rounded-xl py-3">
            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500 dark:text-ink-400">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-wine-600 dark:text-wine-300 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
