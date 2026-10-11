import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  QrCode,
  ScanLine,
  BarChart3,
  ScrollText,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react'
import Logo from './Logo.jsx'
import { Avatar } from './ui.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { useAuth } from '../lib/auth.jsx'

const NAV = {
  patient: [
    { to: '/patient', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/patient/records', label: 'Health records', icon: FileText },
    { to: '/patient/insights', label: 'AI insights', icon: Sparkles },
    { to: '/patient/share', label: 'Share access', icon: QrCode },
  ],
  clinician: [{ to: '/dashboard', label: 'Scan patient', icon: ScanLine, match: ['/dashboard', '/patients'] }],
  representative: [{ to: '/representative', label: 'Access requests', icon: ShieldCheck, end: true }],
  admin: [
    { to: '/admin', label: 'Population', icon: BarChart3, end: true },
    { to: '/admin/audit', label: 'Audit & access', icon: ScrollText },
  ],
}

const ROLE_NOTE = {
  patient: 'Your record is tied to your login. Clinicians open it with a short-lived QR code, and every access is logged.',
  clinician: 'Every record you open is written to the audit log.',
  admin: 'You see aggregates only. Groups under 5 people are hidden by the server.',
  representative: 'Only patients who explicitly designate you can appear here. Emergency access is time-limited and audited.',
}

function SidebarContent({ role, onNavigate }) {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = NAV[role] || []

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-6 pt-2">
        <Logo to="/" tone="dark" />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1">
        {items.map(({ to, label, icon: Icon, end, match }) => {
          const forced = match?.some((m) => location.pathname.startsWith(m))
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  isActive || forced ? 'bg-wine-600 text-white shadow-lg shadow-wine-900/40' : 'text-ink-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          )
        })}
      </nav>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-wine-300">
          <ShieldCheck size={14} aria-hidden="true" /> Privacy
        </div>
        <p className="text-xs leading-relaxed text-ink-300">{ROLE_NOTE[role]}</p>
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 px-1 pt-4">
        <Avatar name={auth?.fullName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{auth?.fullName}</p>
          <p className="text-xs capitalize text-ink-400">{role}</p>
        </div>
        <ThemeToggle variant="dark" />
        <button
          onClick={handleLogout}
          className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default function AppShell() {
  const { auth } = useAuth()
  const role = auth?.role
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname])

  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar: a floating dark panel, like the reference. */}
      <aside className="fixed bottom-3 left-3 top-3 z-30 hidden w-60 rounded-3xl bg-ink-900 p-4 shadow-lift lg:block">
        <SidebarContent role={role} />
      </aside>

      {/* Mobile drawer */}
      {open && <div className="fixed inset-0 z-40 bg-ink-950/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        className={`fixed bottom-2 left-2 top-2 z-50 w-72 max-w-[85vw] rounded-3xl bg-ink-900 p-4 shadow-lift transition-transform duration-200 lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-[110%]'
        }`}
        aria-hidden={!open}
      >
        <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-ink-300 hover:bg-white/10" aria-label="Close menu">
          <X size={18} />
        </button>
        <SidebarContent role={role} onNavigate={() => setOpen(false)} />
      </aside>

      <div className="lg:pl-[16.5rem]">
        <header className="flex items-center justify-between px-4 pt-4 sm:px-8 sm:pt-6 lg:pr-8">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-wine-100 bg-white p-2.5 text-ink-700 shadow-soft dark:border-ink-700 dark:bg-ink-800 dark:text-blush-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs font-semibold text-ink-500 dark:text-ink-400 sm:block">{today}</span>
            <ThemeToggle />
            <Avatar name={auth?.fullName} size={38} />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
