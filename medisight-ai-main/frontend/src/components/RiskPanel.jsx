import React, { useState } from 'react'
import { Sparkles, Loader2, Plus, X, Save } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import RiskDetails from './RiskDetails.jsx'
import { CardHeader, ErrorNote } from './ui.jsx'

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function RiskPanel({ patientId }) {
  const [risk, setRisk] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showMeasurements, setShowMeasurements] = useState(false)
  const [savingMeasurements, setSavingMeasurements] = useState(false)
  const [glucose, setGlucose] = useState('')
  const [systolicBp, setSystolicBp] = useState('')
  const [measurementDate, setMeasurementDate] = useState(localDate())

  async function runPrediction() {
    setError(null)
    setLoading(true)
    try {
      const resp = await api.get(`/patients/${patientId}/risk`)
      setRisk(resp.data)
    } catch (e) {
      setRisk(null)
      setError(errorMessage(e, 'Risk model unavailable.'))
    } finally {
      setLoading(false)
    }
  }

  async function saveMeasurements(e) {
    e.preventDefault()
    setError(null)
    setSavingMeasurements(true)
    try {
      // Save measured clinical values as lab records; the risk service reads these records.
      await api.post(`/patients/${patientId}/labs`, {
        test_name: 'Fasting Glucose',
        value: Number(glucose),
        unit: 'mg/dL',
        reference_range: '70-99',
        result_date: measurementDate,
        abnormal: Number(glucose) < 70 || Number(glucose) > 99,
      })
      await api.post(`/patients/${patientId}/labs`, {
        test_name: 'Systolic BP',
        value: Number(systolicBp),
        unit: 'mmHg',
        reference_range: '90-120',
        result_date: measurementDate,
        abnormal: Number(systolicBp) < 90 || Number(systolicBp) > 120,
      })
      setShowMeasurements(false)
      setGlucose('')
      setSystolicBp('')
      setRisk(null)
    } catch (e2) {
      setError(errorMessage(e2, 'Could not save clinical measurements. Please check the patient record before trying again.'))
    } finally {
      setSavingMeasurements(false)
    }
  }

  return (
    <section className="card p-5">
      <CardHeader
        title="AI risk assessment"
        description="XGBoost score, explained with SHAP. Requires recorded Fasting Glucose and Systolic BP."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowMeasurements((v) => !v); setError(null) }}
              className="btn-outline btn-sm shrink-0"
              disabled={savingMeasurements}
            >
              {showMeasurements ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
              {showMeasurements ? 'Cancel' : 'Add measurements'}
            </button>
            <button onClick={runPrediction} disabled={loading || savingMeasurements} className="btn-primary btn-sm shrink-0">
              {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
              {loading ? 'Scoring…' : risk ? 'Re-run' : 'Run risk model'}
            </button>
          </div>
        }
      />
      <ErrorNote>{error}</ErrorNote>

      {showMeasurements && (
        <form onSubmit={saveMeasurements} className="mb-4 rounded-xl border border-wine-100 bg-blush-50 p-4 dark:border-ink-700 dark:bg-ink-800/60">
          <h3 className="mb-1 text-sm font-bold text-ink-900 dark:text-blush-50">Add clinical measurements</h3>
          <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">Enter values from the patient's actual measurements. These will be saved to the clinical record before risk scoring.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="risk-glucose">Fasting glucose (mg/dL) *</label>
              <input id="risk-glucose" className="field" type="number" min="1" max="1000" step="any" required value={glucose} onChange={(e) => setGlucose(e.target.value)} placeholder="e.g. 95" />
            </div>
            <div>
              <label className="label" htmlFor="risk-systolic-bp">Systolic blood pressure (mmHg) *</label>
              <input id="risk-systolic-bp" className="field" type="number" min="30" max="300" step="any" required value={systolicBp} onChange={(e) => setSystolicBp(e.target.value)} placeholder="e.g. 120" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="risk-measurement-date">Measurement date *</label>
              <input id="risk-measurement-date" className="field" type="date" required value={measurementDate} onChange={(e) => setMeasurementDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary btn-sm" disabled={savingMeasurements}>
              {savingMeasurements ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {savingMeasurements ? 'Saving…' : 'Save measurements'}
            </button>
            <button type="button" className="btn-outline btn-sm" onClick={() => setShowMeasurements(false)} disabled={savingMeasurements}>Cancel</button>
          </div>
        </form>
      )}

      {!risk && !error && (
        <p className="rounded-xl bg-blush-100 dark:bg-ink-800 px-4 py-6 text-center text-sm text-ink-500 dark:text-ink-400">
          Add the patient's measured Fasting Glucose and Systolic BP, then select Run risk model. The model will not score a patient by substituting guessed values for missing measurements.
        </p>
      )}
      {risk && <RiskDetails risk={risk} audience="clinician" ringSize={124} />}
    </section>
  )
}
