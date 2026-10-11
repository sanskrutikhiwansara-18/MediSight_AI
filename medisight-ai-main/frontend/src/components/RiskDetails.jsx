import React from 'react'
import { RiskRing } from './ui.jsx'
import { featureLabel, formatFeatureValue, levelMeta } from '../lib/risk.js'

const LEVEL_COPY = {
  LOW: 'Few recorded factors are pushing the score up.',
  MODERATE: 'Some recorded factors are raising the score.',
  HIGH: 'Several recorded factors are raising the score. A clinician should review this.',
}

export default function RiskDetails({ risk, audience = 'patient', ringSize = 132 }) {
  const meta = levelMeta(risk.risk_level)
  const factors = risk.shap_explanation || []
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.shap_value)), 0.001)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5">
        <RiskRing score={risk.risk_score} level={risk.risk_level} size={ringSize} />
        <div className="min-w-[12rem] flex-1">
          <p className={`text-sm font-bold ${meta.text}`}>{meta.label} risk</p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{LEVEL_COPY[risk.risk_level]}</p>
          <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">Model estimate · not a diagnosis</p>
        </div>
      </div>

      <section>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ink-800 dark:text-blush-100">
            {audience === 'patient' ? 'What influenced your score' : 'Top contributing factors'}
          </h3>
          {audience === 'patient' && <span className="text-[11px] text-ink-400">SHAP analysis</span>}
        </div>
        {audience === 'patient' && (
          <p className="mb-4 text-xs text-ink-500 dark:text-ink-400">Score direction is about the model, not whether a factor is medically good or bad.</p>
        )}
        <ul className="space-y-4">
          {factors.map((f) => {
            const up = f.shap_value >= 0
            const width = Math.max(4, (Math.abs(f.shap_value) / maxAbs) * 100)
            return (
              <li key={f.feature}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink-800 dark:text-blush-100">
                    {f.label || featureLabel(f.feature)} <span className="font-normal text-ink-400">{formatFeatureValue(f.feature, f.value)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${up ? 'bg-crimson-50 text-crimson-700 dark:bg-crimson-950/40 dark:text-crimson-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                    {audience === 'patient' ? (up ? 'Score ↑' : 'Score ↓') : `${up ? 'Raises' : 'Lowers'} ${up ? '+' : '−'}${Math.abs(f.shap_value).toFixed(2)}`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-blush-200 dark:bg-ink-700">
                  <div className={`h-full rounded-full ${up ? 'bg-crimson-500' : 'bg-emerald-500'}`} style={{ width: `${width}%` }} />
                </div>
                <details className="group mt-1.5 text-xs text-ink-500 dark:text-ink-400">
                  <summary className="w-fit cursor-pointer select-none list-none hover:text-ink-800 dark:hover:text-blush-100">
                    <span className="group-open:hidden">Why this matters +</span>
                    <span className="hidden group-open:inline">Why this matters −</span>
                  </summary>
                  <p className="mt-2 leading-relaxed">{f.explanation || `${featureLabel(f.feature)} ${up ? 'pushed this model score upward' : 'pushed this model score downward'} for this prediction. This describes model behavior, not cause.`}</p>
                </details>
              </li>
            )
          })}
        </ul>
        {audience === 'patient' && <p className="mt-3 text-[11px] text-ink-400">Bar length compares these factors only; it does not show clinical importance.</p>}
      </section>

      <details className="border-t border-wine-100 pt-3 text-xs leading-relaxed text-ink-500 dark:border-ink-700 dark:text-ink-400">
        <summary className="cursor-pointer font-semibold text-ink-600 dark:text-ink-300">About this estimate & safety notes</summary>
        <div className="mt-2 space-y-2">
          <p>{risk.explanation_method || 'SHAP shows how inputs influenced this model prediction; it does not prove that a factor caused the outcome.'}</p>
          {risk.data_note && <p>{risk.data_note}</p>}
          <p>{risk.disclaimer} Model {risk.model_version}.</p>
        </div>
      </details>
    </div>
  )
}
