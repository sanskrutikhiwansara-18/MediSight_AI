// Patients a clinician opened during this browser session. Kept in
// sessionStorage (cleared when the tab closes or on log out) and limited to
// the de-identified fields the clinician already saw.
const KEY = 'medisight_recent_patients'

export function getRecent() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function pushRecent(patient) {
  const entry = { id: patient.id, ref: patient.patient_ref, age: patient.age, gender: patient.gender, at: Date.now() }
  const next = [entry, ...getRecent().filter((p) => p.id !== entry.id)].slice(0, 5)
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage can be unavailable (private mode); the list is a convenience only.
  }
}
