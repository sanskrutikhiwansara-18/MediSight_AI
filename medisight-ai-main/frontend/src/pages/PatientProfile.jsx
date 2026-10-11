import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import RiskPanel from '../components/RiskPanel.jsx'
import RecordViewer from '../components/RecordViewer.jsx'
import BloodGroupVerifier from '../components/BloodGroupVerifier.jsx'
import { ErrorNote, Spinner, StatCard } from '../components/ui.jsx'
import { Stethoscope, Pill, FlaskConical, CalendarClock } from 'lucide-react'
import { activeMedications } from '../lib/records.js'
import { pushRecent } from '../lib/recent.js'
import api, { errorMessage } from '../services/api'

export default function PatientProfile() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [error, setError] = useState(null)

  function load() {
    return api.get(`/patients/${id}`).then((resp) => {
      setPatient(resp.data)
      pushRecent(resp.data)
      return resp.data
    })
  }

  useEffect(() => {
    let cancelled = false
    setError(null)
    setPatient(null)
    load().catch((e) => !cancelled && setError(errorMessage(e, 'Could not load patient record.')))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <>
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-wine-600 dark:text-wine-300 hover:underline">
        <ArrowLeft size={15} aria-hidden="true" /> Back to dashboard
      </Link>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!patient && !error && <Spinner label="Opening record…" />}

      {patient && (
        <>
          <div className="card mb-5 flex flex-wrap items-center gap-4 p-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-wine-300 to-wine-600 font-display text-xl font-semibold text-white" aria-hidden="true">
              {patient.age}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">Patient record</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-blush-50">{patient.patient_ref}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-ink-500 dark:text-ink-400">
                <span>
                  {patient.age} years, {patient.gender}
                </span>
                {patient.region && patient.region !== 'UNSPECIFIED' && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} aria-hidden="true" /> {patient.region}
                  </span>
                )}
                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200">Blood group: {patient.blood_group || 'Not recorded'}{patient.blood_group_verified ? ' · verified' : ' · unverified'}</span>
              </p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={Stethoscope} label="Active conditions" value={patient.conditions.filter((c) => c.active).length} />
            <StatCard icon={Pill} label="Current medications" value={activeMedications(patient).length} tone="good" />
            <StatCard icon={CalendarClock} label="Visits on record" value={patient.visits.length} />
            <StatCard
              icon={FlaskConical}
              label="Flagged labs"
              value={patient.lab_results.filter((l) => l.abnormal).length}
              tone={patient.lab_results.some((l) => l.abnormal) ? 'warn' : 'good'}
            />
          </div>

          <BloodGroupVerifier patient={patient} onVerified={load} />

          <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
            <RecordViewer record={patient} editable={patient.access_scope !== 'limited'} patientId={id} onChanged={load} />
            <div className="h-fit lg:sticky lg:top-6">
              {patient.access_scope === 'limited' ? <div className="card p-4 text-sm text-ink-600 dark:text-ink-300">AI risk calculation is unavailable under limited access. Full representative-approved access is required.</div> : <RiskPanel patientId={id} />}
            </div>
          </div>
        </>
      )}
    </>
  )
}
