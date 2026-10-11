// Plain-language names for the model's input features, so a patient or
// clinician never has to read `num_active_conditions`.
const FEATURE_LABELS = {
  age: 'Age',
  is_male: 'Sex',
  num_active_conditions: 'Active conditions',
  num_visits_last_year: 'Visits in the last year',
  num_prescriptions: 'Prescriptions on file',
  abnormal_lab_ratio: 'Share of abnormal lab results',
  has_diabetes: 'Diabetes diagnosis',
  has_hypertension: 'Hypertension diagnosis',
  has_heart_disease: 'Heart disease diagnosis',
  latest_glucose: 'Latest fasting glucose',
  latest_systolic_bp: 'Latest systolic blood pressure',
}

export function featureLabel(name) {
  return FEATURE_LABELS[name] || name.replaceAll('_', ' ')
}

export function formatFeatureValue(name, value) {
  if (name === 'is_male') return Number(value) === 1 ? 'Male' : 'Female / other'
  if (name.startsWith('has_')) return Number(value) === 1 ? 'Yes' : 'No'
  if (name === 'abnormal_lab_ratio') return `${Math.round(Number(value) * 100)}%`
  if (name === 'latest_glucose') return `${Number(value).toFixed(0)} mg/dL`
  if (name === 'latest_systolic_bp') return `${Number(value).toFixed(0)} mmHg`
  return String(value)
}

// One place that decides how each risk level looks everywhere.
export const LEVELS = {
  LOW: {
    label: 'Low',
    text: 'text-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stroke: '#3E8E65',
    bar: 'bg-emerald-500',
  },
  MODERATE: {
    label: 'Moderate',
    text: 'text-amber-700',
    soft: 'bg-amber-50 text-amber-700 border-amber-200',
    stroke: '#C9832B',
    bar: 'bg-amber-500',
  },
  HIGH: {
    label: 'High',
    text: 'text-crimson-700',
    soft: 'bg-crimson-50 text-crimson-700 border-crimson-500/30',
    stroke: '#B4233F',
    bar: 'bg-crimson-500',
  },
}

export function levelMeta(level) {
  return LEVELS[level] || LEVELS.LOW
}
