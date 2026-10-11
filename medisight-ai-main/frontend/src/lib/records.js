const DAY = 24 * 60 * 60 * 1000

function toDate(value) {
  // API dates are plain YYYY-MM-DD; parse as local time so "today" is today.
  const [y, m, d] = String(value).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function isEmptyRecord(record) {
  return (
    !record ||
    (record.conditions.length === 0 &&
      record.visits.length === 0 &&
      record.lab_results.length === 0 &&
      record.prescriptions.length === 0)
  )
}

export function activeMedications(record) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return record.prescriptions.filter((p) => !p.end_date || toDate(p.end_date) >= today)
}

export function visitsInLastYear(record) {
  const cutoff = Date.now() - 365 * DAY
  return record.visits.filter((v) => toDate(v.visit_date).getTime() >= cutoff)
}

export function relativeDay(value) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - toDate(value)) / DAY)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 14) return `${diff} days ago`
  if (diff < 60) return `${Math.round(diff / 7)} weeks ago`
  return toDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDate(value) {
  return toDate(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Everything that happened to the patient, newest first. */
export function buildTimeline(record) {
  const events = [
    ...record.visits.map((v) => ({
      key: `v${v.id}`,
      date: v.visit_date,
      kind: 'visit',
      title: v.reason,
      detail: v.notes,
    })),
    ...record.lab_results.map((l) => ({
      key: `l${l.id}`,
      date: l.result_date,
      kind: 'lab',
      title: `${l.test_name}: ${l.value} ${l.unit}`,
      detail: l.abnormal ? 'Flagged as outside the reference range' : `Reference ${l.reference_range}`,
      flagged: l.abnormal,
    })),
    ...record.prescriptions.map((p) => ({
      key: `p${p.id}`,
      date: p.start_date,
      kind: 'medication',
      title: `${p.medication} ${p.dosage} started`,
      detail: p.frequency,
    })),
    ...record.conditions.map((c) => ({
      key: `c${c.id}`,
      date: c.diagnosed_date,
      kind: 'condition',
      title: `Diagnosed: ${c.name}`,
      detail: c.icd10_code ? `ICD-10 ${c.icd10_code}` : '',
    })),
  ]
  return events.sort((a, b) => toDate(b.date) - toDate(a.date))
}
