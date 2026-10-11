import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  FlaskConical,
  Activity,
  Pill,
  History,
  UserPlus,
  QrCode,
  BrainCircuit,
  ShieldCheck,
  Cpu,
  Sparkles,
  Stethoscope,
  ScrollText,
  UserRoundX,
  KeyRound,
  Timer,
} from 'lucide-react'
import PublicNav from '../components/PublicNav.jsx'
import NeuralOrb from '../components/NeuralOrb.jsx'
import Logo from '../components/Logo.jsx'
import { useAuth } from '../lib/auth.jsx'
import { homeFor } from '../lib/roles.js'

function Chip({ icon: Icon, children, className = '' }) {
  return (
    <span
      className={`absolute inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white/90 shadow-lg backdrop-blur-md ${className}`}
    >
      <Icon size={14} aria-hidden="true" /> {children}
    </span>
  )
}

function Hero() {
  const { auth } = useAuth()
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-14 lg:pt-10">
        <div className="relative z-10">
          <h1 className="font-display text-[2.7rem] font-medium leading-[1.06] tracking-tight text-ink-900 sm:text-6xl">
            Smarter
            <br />
            Health Decisions
            <br />
            with <span className="text-wine-600">AI</span>
          </h1>
          <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-ink-600">
            MediSight turns a patient’s history, labs and prescriptions into a risk score a clinician can question — and keeps the
            person behind the record private.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={auth ? homeFor(auth.role) : '/signup'} className="btn-primary px-6 py-3">
              {auth ? 'Open dashboard' : 'Create patient account'} <ArrowRight size={16} aria-hidden="true" />
            </Link>
            {!auth && (
              <Link to="/login" className="btn-outline px-6 py-3">
                Log in
              </Link>
            )}
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
            {[
              ['3', 'roles, each with its own sign-in'],
              ['15 min', 'QR access window'],
              ['k = 5', 'smallest group admins can see'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-display text-3xl font-medium text-ink-900">{value}</dt>
                <dd className="mt-1 text-xs leading-snug text-ink-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto aspect-[600/560] w-full max-w-[640px] lg:-mr-10">
          <NeuralOrb className="h-full w-full" />
          <Chip icon={FlaskConical} className="left-[14%] top-[13%]">Lab reports</Chip>
          <Chip icon={Activity} className="right-[8%] top-[27%]">Vitals</Chip>
          <Chip icon={History} className="bottom-[16%] left-[8%]">Medical history</Chip>
          <Chip icon={Pill} className="bottom-[27%] right-[4%]">Prescriptions</Chip>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { icon: UserPlus, title: 'Create your account', text: 'Patients sign up in a minute. Your name lives with your login; your clinical record holds no name at all.' },
  { icon: QrCode, title: 'Share with a QR code', text: 'When you see a clinician, make a code that lasts 15 minutes. It carries a random token, never your data.' },
  { icon: BrainCircuit, title: 'Read an explained score', text: 'The clinician sees a risk score and the factors that pushed it up or down, in plain language.' },
  { icon: ShieldCheck, title: 'Stay in control', text: 'Stop sharing whenever you like. Every access is written to an audit log admins can review.' },
]

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <h2 className="font-display text-4xl font-medium tracking-tight text-ink-900">How it works</h2>
      <p className="mt-3 max-w-lg text-ink-600">From a sign-up to a clinician’s decision, in four steps.</p>

      <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="relative">
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="absolute left-16 right-0 top-8 hidden border-t border-dashed border-wine-300 lg:block" />
            )}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-wine-200 bg-white text-wine-600 shadow-soft">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wine-600 text-white">
                <Icon size={20} aria-hidden="true" />
              </span>
            </span>
            <p className="mt-4 font-display text-lg text-wine-400">0{i + 1}</p>
            <h3 className="mt-1 text-lg font-bold text-ink-900">{title}</h3>
            <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-ink-600">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const SAMPLE_FACTORS = [
  { label: 'Age', value: '+1.20', width: 88, up: true },
  { label: 'Latest fasting glucose', value: '+0.82', width: 62, up: true },
  { label: 'Active conditions', value: '+0.54', width: 42, up: true },
  { label: 'Visits in the last year', value: '−0.31', width: 24, up: false },
]

function AiCore() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-3 sm:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink-900 via-[#240B14] to-wine-900 px-6 py-14 text-white shadow-lift sm:px-12">
        <NeuralOrb seed={19} count={240} showBlob={false} showBadge={false} className="pointer-events-none absolute left-[22%] top-1/2 hidden h-[150%] -translate-y-1/2 opacity-60 lg:block" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="relative z-10">
            <h2 className="font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
              The power of AI
              <br />
              at the core
            </h2>
            <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-white/70">
              A gradient-boosted model reads the structured record, and SHAP shows which inputs moved the score. It supports the
              clinician’s judgement. It never replaces it.
            </p>
            <Link to="/signup" className="btn-rose mt-8 px-6 py-3">
              Get started <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="relative">
            <div className="relative ml-auto max-w-md rounded-2xl border border-white/10 bg-ink-900/60 p-6 backdrop-blur-md">
              <div className="flex items-start justify-between">
                <h3 className="text-base font-bold">Risk prediction</h3>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">Example output</span>
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="font-display text-4xl">46%</span>
                <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">Moderate</span>
              </div>
              <p className="mt-5 text-xs font-semibold text-white/60">What moved the score</p>
              <ul className="mt-3 space-y-3">
                {SAMPLE_FACTORS.map((f) => (
                  <li key={f.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-white/85">{f.label}</span>
                      <span className={f.up ? 'text-rose-300' : 'text-emerald-300'}>{f.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${f.up ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${f.width}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/50">
                Decision support, not a diagnosis. A clinician confirms any action.
              </p>
            </div>
          </div>
        </div>

        <ul className="relative z-10 mt-14 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 lg:grid-cols-4">
          {[
            [Cpu, 'XGBoost model', 'Trained on structured records'],
            [Sparkles, 'SHAP explanations', 'Top factors for every score'],
            [Stethoscope, 'Clinician in the loop', 'Scores inform; people decide'],
            [ScrollText, 'Audit trail', 'Every access is recorded'],
          ].map(([Icon, title, text]) => (
            <li key={title} className="flex items-start gap-3">
              <Icon size={20} className="mt-0.5 shrink-0 text-wine-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-0.5 text-xs text-white/55">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function LayeredShield() {
  return (
    <svg viewBox="0 0 420 380" className="mx-auto w-full max-w-md" role="img" aria-label="Layers of protection around your health data">
      <defs>
        <linearGradient id="lyr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBE3E5" />
          <stop offset="1" stopColor="#F1BFC6" />
        </linearGradient>
        <linearGradient id="lyrTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF3F4" />
          <stop offset="1" stopColor="#F4C9CF" />
        </linearGradient>
        <linearGradient id="shd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E0808A" />
          <stop offset="1" stopColor="#7A1A36" />
        </linearGradient>
      </defs>
      {[250, 205, 160, 115].map((y, i) => (
        <g key={y} opacity={0.55 + i * 0.15}>
          <path d={`M210 ${y - 62} L350 ${y} L210 ${y + 62} L70 ${y} Z`} fill={i === 3 ? 'url(#lyrTop)' : 'url(#lyr)'} stroke="#fff" strokeWidth="2" />
        </g>
      ))}
      <path d="M210 60 C 236 76 262 82 280 82 L280 140 C 280 174 250 196 210 212 C 170 196 140 174 140 140 L140 82 C 158 82 184 76 210 60 Z" fill="url(#shd)" />
      <path d="M181 133 L203 156 L241 112" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const PRIVACY = [
  { icon: UserRoundX, title: 'No names in clinical records', text: 'Identity stays on the login. Clinicians and admins never see it next to a diagnosis.' },
  { icon: KeyRound, title: 'Access by role, enforced by the server', text: 'Patients, clinicians and admins each get different doors. Hiding a button is not the safeguard.' },
  { icon: Timer, title: 'Short-lived, revocable QR access', text: 'Codes expire after 15 minutes and patients can cancel them sooner.' },
  { icon: ScrollText, title: 'Everything is logged', text: 'Sign-ins, record views and blocked attempts appear in the audit trail.' },
]

function Privacy() {
  return (
    <section id="privacy" className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <h2 className="font-display text-4xl font-medium tracking-tight text-ink-900">Your data. Your control.</h2>
        <p className="mt-3 max-w-lg text-ink-600">Intelligence can be shared. Identity cannot.</p>
        <ul className="mt-8 space-y-5">
          {PRIVACY.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine-100 text-wine-600">
                <Icon size={18} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink-900">{title}</h3>
                <p className="mt-0.5 max-w-md text-sm text-ink-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <LayeredShield />
    </section>
  )
}

function ClosingCta() {
  const { auth } = useAuth()
  return (
    <section className="mx-auto max-w-7xl px-3 pb-16 sm:px-8">
      <div className="rounded-[2rem] border border-wine-100 bg-white/70 px-6 py-14 text-center shadow-soft">
        <h2 className="font-display text-3xl font-medium tracking-tight text-ink-900 sm:text-4xl">See your own health record, clearly.</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-600">
          Patients can sign up now. Clinician and admin accounts are created by your organization.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={auth ? homeFor(auth.role) : '/signup'} className="btn-primary px-6 py-3">
            {auth ? 'Open dashboard' : 'Create patient account'}
          </Link>
          {!auth && (
            <Link to="/login" className="btn-outline px-6 py-3">
              Log in
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div>
      <PublicNav />
      <main>
        <Hero />
        <HowItWorks />
        <AiCore />
        <Privacy />
        <ClosingCta />
      </main>
      <footer className="border-t border-wine-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-ink-500 sm:px-8">
          <Logo />
          <p className="max-w-md">Demo build using synthetic patient data. MediSight provides decision support, not medical diagnoses.</p>
        </div>
      </footer>
    </div>
  )
}
