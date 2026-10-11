import React from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import { PageHeader, EmptyState, ErrorNote } from '../../components/ui.jsx'
import RiskDetails from '../../components/RiskDetails.jsx'
import { isEmptyRecord } from '../../lib/records.js'
import { usePatient } from './PatientLayout.jsx'

export default function PatientInsights() {
  const { record, risk, reloadRisk } = usePatient()

  return (
    <>
      <PageHeader
        title="AI insights"
        subtitle="A quick view of your model estimate and the factors behind it."
        actions={risk.status === 'ready' ? (
          <button onClick={reloadRisk} className="btn-outline btn-sm">Recalculate</button>
        ) : null}
      />

      {isEmptyRecord(record) ? (
        <div className="card">
          <EmptyState icon={Sparkles} title="No insights yet">
            Add health record details such as conditions, lab results, visits or prescriptions to generate insights.
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,1fr)]">
          <section className="card min-w-0 p-4 sm:p-6" aria-label="AI risk estimate" aria-busy={risk.status === 'loading'}>
            {risk.status === 'loading' && (
              <div className="space-y-5 py-6 sm:py-10" role="status" aria-live="polite">
                <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Calculating your estimate…
                </div>
                <div className="h-3 w-2/5 animate-pulse rounded-full bg-blush-200 dark:bg-ink-700" />
                {[0, 1, 2].map((item) => (
                  <div key={item} className="space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-blush-100 dark:bg-ink-700" />
                    <div className="h-2 w-full animate-pulse rounded-full bg-blush-200 dark:bg-ink-700" />
                  </div>
                ))}
              </div>
            )}
            {risk.status === 'error' && (
              <div className="space-y-3">
                <ErrorNote>{risk.error || 'The estimate could not be loaded right now.'}</ErrorNote>
                <p className="text-sm text-ink-500 dark:text-ink-400">Your record is still available. You can retry the estimate.</p>
                <button onClick={reloadRisk} className="btn-outline btn-sm">Try again</button>
              </div>
            )}
            {risk.status === 'ready' && <RiskDetails risk={risk.data} audience="patient" ringSize={144} />}
          </section>

          <aside className="card min-w-0 p-4 sm:p-6">
            <h2 className="text-[0.95rem] font-bold text-ink-900 dark:text-blush-50">About this score</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              SHAP highlights which recorded factors moved the model estimate. It explains the model, not medical cause or diagnosis.
            </p>
            <details className="mt-4 text-sm text-ink-600 dark:text-ink-300">
              <summary className="cursor-pointer font-semibold">Data & safety notes</summary>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
                <li>The percentage is a model estimate, not your confirmed medical probability or a diagnosis.</li>
                <li>“Score ↑” and “Score ↓” describe the model score only. A lower score does not mean a condition is beneficial or medically safe.</li>
                <li>Bar lengths compare factors within this prediction; they do not measure clinical importance or prove cause and effect.</li>
                <li>The model requires recorded fasting glucose and systolic blood pressure. Other missing inputs may use pipeline defaults, so ask a clinician to verify the record.</li>
                <li>This version was trained on synthetic Synthea data and has not been clinically validated. Use it for research/demo context, not diagnosis or treatment decisions.</li>
              </ul>
            </details>
            <Link to="/patient/share" className="btn-outline btn-sm mt-5 inline-flex max-w-full">
              Share with a clinician
            </Link>
          </aside>
        </div>
      )}
    </>
  )
}
