import React from 'react'
import { Link } from 'react-router-dom'
import { Stethoscope, Pill, CalendarClock, FlaskConical, ArrowRight, QrCode, FileHeart, Loader2 } from 'lucide-react'
import { PageHeader, StatCard, CardHeader, RiskRing, EmptyState } from '../../components/ui.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { firstNameOf, greeting } from '../../lib/roles.js'
import { activeMedications, buildTimeline, isEmptyRecord, relativeDay, visitsInLastYear } from '../../lib/records.js'
import { levelMeta } from '../../lib/risk.js'
import { usePatient } from './PatientLayout.jsx'
import PatientAccessPanel from '../../components/PatientAccessPanel.jsx'

const KIND_DOT = {
  visit: 'bg-wine-500',
  lab: 'bg-amber-500',
  medication: 'bg-emerald-500',
  condition: 'bg-ink-600',
}

export default function PatientOverview() {
  const { auth } = useAuth()
  const { record, risk } = usePatient()
  const empty = isEmptyRecord(record)

  const activeConditions = record.conditions.filter((c) => c.active)
  const meds = activeMedications(record)
  const recentVisits = visitsInLastYear(record)
  const flagged = record.lab_results.filter((l) => l.abnormal)
  const timeline = buildTimeline(record).slice(0, 7)

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstNameOf(auth.fullName)}`} subtitle="Here’s your health overview." />

      {empty ? (
        <div className="card">
          <EmptyState
            icon={FileHeart}
            title="Your record is empty for now"
            action={
              <Link to="/patient/share" className="btn-primary">
                <QrCode size={16} aria-hidden="true" /> Share access with a clinician
              </Link>
            }
          >
            Visits, lab results and prescriptions will appear here once they are added to your record. Your AI risk score appears at the same time.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={Stethoscope} label="Active conditions" value={activeConditions.length} note={`${record.conditions.length} on record`} />
            <StatCard icon={Pill} label="Current medications" value={meds.length} note={meds.length ? 'Ongoing' : 'None ongoing'} tone="good" noteTone="good" />
            <StatCard icon={CalendarClock} label="Visits, last 12 months" value={recentVisits.length} note={`${record.visits.length} in total`} />
            <StatCard
              icon={FlaskConical}
              label="Flagged lab results"
              value={flagged.length}
              note={`of ${record.lab_results.length} results`}
              tone={flagged.length ? 'warn' : 'good'}
              noteTone={flagged.length ? 'warn' : 'good'}
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <section className="card p-5">
              <CardHeader title="Health timeline" description="Your most recent activity, newest first." />
              <ul className="divide-y divide-wine-50 dark:divide-ink-700">
                {timeline.map((e) => (
                  <li key={e.key} className="grid grid-cols-[6.5rem_1fr] gap-3 py-3">
                    <span className="pt-0.5 text-xs font-semibold text-ink-500 dark:text-ink-400">{relativeDay(e.date)}</span>
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-ink-900 dark:text-blush-50">
                          {e.title}
                          {e.flagged && <span className="ml-2 rounded-full bg-crimson-50 px-2 py-0.5 text-[11px] font-bold text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300">Flagged</span>}
                        </p>
                        {e.detail && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{e.detail}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Link to="/patient/records" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-wine-600 dark:text-wine-300 hover:underline">
                See all records <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </section>

            <div className="space-y-5">
              <section className="card p-5">
                <CardHeader title="AI health risk" description="Estimated from your record." />
                {risk.status === 'loading' && (
                  <div className="flex items-center gap-2 py-8 text-sm text-ink-500 dark:text-ink-400" role="status">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Calculating…
                  </div>
                )}
                {risk.status === 'error' && <p className="text-sm text-ink-500 dark:text-ink-400">{risk.error}</p>}
                {risk.status === 'ready' && (
                  <div className="flex items-center gap-5">
                    <RiskRing score={risk.data.risk_score} level={risk.data.risk_level} size={118} />
                    <div>
                      <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">Overall risk</p>
                      <p className={`text-xl font-extrabold ${levelMeta(risk.data.risk_level).text}`}>{levelMeta(risk.data.risk_level).label}</p>
                      <Link to="/patient/insights" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-wine-600 dark:text-wine-300 hover:underline">
                        View details <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}
              </section>

              <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-wine-700 to-wine-900 p-5 text-white shadow-lift">
                <QrCode size={22} className="text-wine-200" aria-hidden="true" />
                <h2 className="mt-3 text-base font-bold">Seeing a clinician?</h2>
                <p className="mt-1 text-sm leading-relaxed text-white/75">Create a QR code that lasts 15 minutes. You can cancel it at any time.</p>
                <Link to="/patient/share" className="btn mt-4 bg-white text-wine-800 dark:text-wine-200 hover:bg-wine-50">
                  Share access <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
      <PatientAccessPanel />
    </>
  )
}
