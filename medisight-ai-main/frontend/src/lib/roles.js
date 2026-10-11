import { HeartPulse, Stethoscope, ShieldCheck } from 'lucide-react'

export const ROLE_HOME = {
  patient: '/patient',
  clinician: '/dashboard',
  admin: '/admin',
  representative: '/representative',
}

export function homeFor(role) {
  return ROLE_HOME[role] || '/login'
}

// Order matters: this is the order of the tabs on the sign-in page.
export const ROLES = [
  {
    id: 'patient',
    label: 'Patient',
    icon: HeartPulse,
    blurb: 'See your own health record, understand your AI risk score and share access with a QR code.',
    demo: { email: 'patient@medisight.dev', password: 'Patient123!' },
  },
  {
    id: 'clinician',
    label: 'Clinician',
    icon: Stethoscope,
    blurb: 'Scan a patient’s QR code to open their record and review an explained risk score.',
    demo: { email: 'clinician@medisight.dev', password: 'Clinician123!' },
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    blurb: 'Review privacy-protected population trends and the audit trail. No patient-level data.',
    demo: { email: 'admin@medisight.dev', password: 'Admin123!' },
  },
]

export function initialsOf(name = '') {
  const parts = name
    .replace(/^(dr|mr|mrs|ms)\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function firstNameOf(name = '') {
  const cleaned = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').trim()
  return cleaned.split(/\s+/)[0] || 'there'
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
