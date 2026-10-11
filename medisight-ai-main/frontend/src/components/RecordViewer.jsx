import React, { useState } from 'react'
import { ClipboardList, FlaskConical, Pill, CalendarClock, Plus, X, Loader2 } from 'lucide-react'
import { EmptyState, Tabs, ErrorNote } from './ui.jsx'
import { formatDate } from '../lib/records.js'
import api, { errorMessage } from '../services/api'

function Pill_({ tone, children }) {
  const cls = {
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    muted: 'bg-blush-200 text-ink-500 dark:bg-ink-700 dark:text-ink-300',
    good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    bad: 'bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300',
  }[tone]
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>
}

// Field definitions per tab: what the clinician fills in, and how it maps
// onto the Create schemas the backend expects (POST /patients/{id}/<endpoint>).
const FORM_DEFS = {
  conditions: {
    endpoint: 'conditions',
    title: 'Add condition',
    fields: [
      { name: 'name', label: 'Condition name', type: 'text', required: true, placeholder: 'e.g. Type 2 Diabetes Mellitus' },
      { name: 'icd10_code', label: 'ICD-10 code', type: 'text', placeholder: 'e.g. E11' },
      { name: 'diagnosed_date', label: 'Diagnosed date', type: 'date', required: true },
      { name: 'active', label: 'Currently active', type: 'checkbox', default: true },
    ],
  },
  medications: {
    endpoint: 'prescriptions',
    title: 'Add prescription',
    fields: [
      { name: 'medication', label: 'Medication', type: 'text', required: true, placeholder: 'e.g. Metformin' },
      { name: 'dosage', label: 'Dosage', type: 'text', placeholder: 'e.g. 500mg' },
      { name: 'frequency', label: 'Frequency', type: 'text', placeholder: 'e.g. Twice daily' },
      { name: 'start_date', label: 'Start date', type: 'date', required: true },
      { name: 'end_date', label: 'End date (leave blank if ongoing)', type: 'date' },
    ],
  },
  labs: {
    endpoint: 'labs',
    title: 'Add lab result',
    fields: [
      { name: 'test_name', label: 'Test name', type: 'text', required: true, placeholder: 'e.g. Fasting Glucose' },
      { name: 'value', label: 'Value', type: 'number', required: true, step: 'any' },
      { name: 'unit', label: 'Unit', type: 'text', placeholder: 'e.g. mg/dL' },
      { name: 'reference_range', label: 'Reference range', type: 'text', placeholder: 'e.g. 70-99' },
      { name: 'result_date', label: 'Result date', type: 'date', required: true },
      { name: 'abnormal', label: 'Flag as abnormal', type: 'checkbox', default: false },
    ],
  },
  visits: {
    endpoint: 'visits',
    title: 'Log a visit',
    fields: [
      { name: 'visit_date', label: 'Visit date', type: 'date', required: true },
      { name: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'e.g. Medication review' },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional clinical notes' },
    ],
  },
}

function emptyValues(def) {
  const v = {}
  for (const f of def.fields) v[f.name] = f.type === 'checkbox' ? !!f.default : ''
  return v
}

function AddEntryForm({ tab, patientId, onAdded, onClose }) {
  const def = FORM_DEFS[tab]
  const [values, setValues] = useState(() => emptyValues(def))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function setField(name, value) {
    setValues((v) => ({ ...v, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = {}
      for (const f of def.fields) {
        let val = values[f.name]
        if (f.type === 'number' && val !== '') val = Number(val)
        if (f.type === 'date' && val === '') val = null
        payload[f.name] = val
      }
      await api.post(`/patients/${patientId}/${def.endpoint}`, payload)
      onAdded()
      onClose()
    } catch (e2) {
      setError(errorMessage(e2, 'Could not save this entry.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-2xl border border-wine-100 bg-blush-50 p-4 dark:border-ink-700 dark:bg-ink-800/60">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-900 dark:text-blush-50">{def.title}</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-wine-100 hover:text-ink-700 dark:hover:bg-ink-700" aria-label="Cancel">
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {def.fields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            {f.type === 'checkbox' ? (
              <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-ink-700 dark:text-blush-200">
                <input
                  type="checkbox"
                  checked={values[f.name]}
                  onChange={(e) => setField(f.name, e.target.checked)}
                  className="h-4 w-4 rounded border-wine-300 text-wine-600 focus:ring-wine-500/30"
                />
                {f.label}
              </label>
            ) : (
              <>
                <label className="label">{f.label}{f.required && ' *'}</label>
                {f.type === 'textarea' ? (
                  <textarea
                    className="field"
                    rows={2}
                    value={values[f.name]}
                    onChange={(e) => setField(f.name, e.target.value)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <input
                    className="field"
                    type={f.type}
                    step={f.step}
                    required={f.required}
                    value={values[f.name]}
                    onChange={(e) => setField(f.name, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button type="submit" className="btn-primary btn-sm" disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />} Save
        </button>
        <button type="button" onClick={onClose} className="btn-outline btn-sm" disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/**
 * Tabbed view of a patient's conditions, medications, labs and visits.
 * Shared by the patient's own "Health records" page and the clinician's
 * patient profile. When `editable` is set (clinician context), each tab
 * gets an "Add" button so the clinician can log new data — visits, a new
 * diagnosis, a lab result, a prescription — directly from the record.
 * `onChanged` is called after a successful add so the caller can refetch
 * the patient and refresh the risk score / medication counts.
 */
export default function RecordViewer({ record, editable = false, patientId, onChanged }) {
  const [tab, setTab] = useState('conditions')
  const [adding, setAdding] = useState(false)

  const tabs = [
    { id: 'conditions', label: 'Conditions', count: record.conditions.length },
    { id: 'medications', label: 'Medications', count: record.prescriptions.length },
    { id: 'labs', label: 'Lab results', count: record.lab_results.length },
    { id: 'visits', label: 'Visits', count: record.visits.length },
  ]

  const sortedVisits = [...record.visits].sort((a, b) => b.visit_date.localeCompare(a.visit_date))
  const sortedLabs = [...record.lab_results].sort((a, b) => b.result_date.localeCompare(a.result_date))

  function changeTab(id) {
    setTab(id)
    setAdding(false)
  }

  return (
    <div className="card overflow-hidden dark:border-ink-700 dark:bg-ink-800">
      <div className="flex items-center justify-between gap-3 px-3 pt-2 sm:px-5">
        <Tabs tabs={tabs} value={tab} onChange={changeTab} />
        {editable && !adding && (
          <button onClick={() => setAdding(true)} className="btn-outline btn-sm shrink-0">
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5" role="tabpanel">
        {editable && adding && (
          <AddEntryForm
            tab={tab}
            patientId={patientId}
            onAdded={() => onChanged && onChanged()}
            onClose={() => setAdding(false)}
          />
        )}

        {tab === 'conditions' &&
          (record.conditions.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No conditions on record" />
          ) : (
            <ul className="divide-y divide-wine-100 dark:divide-ink-700">
              {record.conditions.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-ink-900 dark:text-blush-50">{c.name}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {c.icd10_code && `ICD-10 ${c.icd10_code} · `}Diagnosed {formatDate(c.diagnosed_date)}
                    </p>
                  </div>
                  <Pill_ tone={c.active ? 'warn' : 'muted'}>{c.active ? 'Active' : 'Resolved'}</Pill_>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'medications' &&
          (record.prescriptions.length === 0 ? (
            <EmptyState icon={Pill} title="No prescriptions on record" />
          ) : (
            <ul className="divide-y divide-wine-100 dark:divide-ink-700">
              {record.prescriptions.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-ink-900 dark:text-blush-50">
                      {p.medication} <span className="font-medium text-ink-500 dark:text-ink-400">{p.dosage}</span>
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {p.frequency}. Started {formatDate(p.start_date)}
                      {p.end_date ? `, ended ${formatDate(p.end_date)}` : ''}
                    </p>
                  </div>
                  <Pill_ tone={p.end_date ? 'muted' : 'good'}>{p.end_date ? 'Ended' : 'Ongoing'}</Pill_>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'labs' &&
          (sortedLabs.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No lab results on record" />
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="px-1 py-2 font-semibold">Test</th>
                    <th className="px-1 py-2 font-semibold">Result</th>
                    <th className="px-1 py-2 font-semibold">Reference</th>
                    <th className="px-1 py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLabs.map((l) => (
                    <tr key={l.id} className="border-b border-wine-50 last:border-0 dark:border-ink-700">
                      <td className="px-1 py-2.5 font-semibold text-ink-800 dark:text-blush-100">{l.test_name}</td>
                      <td className="px-1 py-2.5">
                        <span className={`font-bold ${l.abnormal ? 'text-crimson-700 dark:text-crimson-400' : 'text-ink-800 dark:text-blush-100'}`}>
                          {l.value} {l.unit}
                        </span>
                        {l.abnormal && <span className="ml-2 rounded-full bg-crimson-50 px-2 py-0.5 text-[11px] font-bold text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300">Flagged</span>}
                      </td>
                      <td className="px-1 py-2.5 text-ink-500 dark:text-ink-400">{l.reference_range}</td>
                      <td className="px-1 py-2.5 text-ink-500 dark:text-ink-400">{formatDate(l.result_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'visits' &&
          (sortedVisits.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No visits on record" />
          ) : (
            <ol className="relative ml-2 space-y-5 border-l border-wine-200 py-1 dark:border-ink-600">
              {sortedVisits.map((v) => (
                <li key={v.id} className="ml-5">
                  <span className="absolute -ml-[26px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-wine-500 ring-1 ring-wine-300 dark:border-ink-800" aria-hidden="true" />
                  <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">{formatDate(v.visit_date)}</p>
                  <p className="text-sm font-bold text-ink-900 dark:text-blush-50">{v.reason}</p>
                  {v.notes && <p className="mt-0.5 text-sm text-ink-600 dark:text-ink-300">{v.notes}</p>}
                </li>
              ))}
            </ol>
          ))}
      </div>
    </div>
  )
}
