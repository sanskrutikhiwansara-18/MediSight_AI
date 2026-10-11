import React from 'react'
import { Loader2 } from 'lucide-react'
import { initialsOf } from '../lib/roles.js'
import { levelMeta } from '../lib/risk.js'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-blush-50 sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[0.95rem] font-bold text-ink-900 dark:text-blush-50">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

const TONES = {
  wine: 'bg-wine-50 dark:bg-wine-900/30 text-wine-600 dark:text-wine-300',
  good: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  warn: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  bad: 'bg-crimson-50 text-crimson-500 dark:bg-crimson-500/15 dark:text-crimson-400',
}

export function StatCard({ icon: Icon, label, value, note, tone = 'wine', noteTone }) {
  const noteColor =
    noteTone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : noteTone === 'warn' ? 'text-amber-600 dark:text-amber-400' : noteTone === 'bad' ? 'text-crimson-500 dark:text-crimson-400' : 'text-ink-500 dark:text-ink-400'
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone] || TONES.wine}`}>
          <Icon size={18} strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold text-ink-500 dark:text-ink-400">{label}</span>
      </div>
      <p className="mt-3 text-[1.65rem] font-extrabold leading-none tracking-tight text-ink-900 dark:text-blush-50">{value}</p>
      {note && <p className={`mt-1.5 text-xs font-semibold ${noteColor}`}>{note}</p>}
    </div>
  )
}

export function Avatar({ name, size = 36, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wine-300 to-wine-600 font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}

export function RiskBadge({ level }) {
  const meta = levelMeta(level)
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta.soft}`}>
      {meta.label}
    </span>
  )
}

/** Ring gauge: the arc length is the model's probability, the colour is the band. */
export function RiskRing({ score, level, size = 132 }) {
  const meta = levelMeta(level)
  const stroke = 11
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, score))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-blush-200 dark:stroke-ink-700" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={meta.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.6rem] font-extrabold leading-none text-ink-900 dark:text-blush-50">{pct > 0 && pct < 0.01 ? '<1' : Math.round(pct * 100)}%</span>
        <span className={`mt-1 text-xs font-bold ${meta.text}`}>{meta.label} risk</span>
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-500 dark:text-ink-400" role="status">
      <Loader2 className="animate-spin" size={18} aria-hidden="true" />
      {label}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-wine-50 dark:bg-wine-900/30 text-wine-500">
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <h3 className="text-base font-bold text-ink-900 dark:text-blush-50">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-wine-100 dark:border-ink-700">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active ? 'border-wine-600 text-wine-700 dark:text-wine-300' : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-800'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${active ? 'bg-wine-100 text-wine-700 dark:text-wine-300' : 'bg-blush-200 dark:bg-ink-700 text-ink-500 dark:text-ink-400'}`}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <div className="alert-error" role="alert">
      {children}
    </div>
  )
}
