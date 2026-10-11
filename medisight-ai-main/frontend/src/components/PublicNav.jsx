import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo.jsx'
import { useAuth } from '../lib/auth.jsx'
import { homeFor } from '../lib/roles.js'

const LINKS = [
  { href: '/#top', label: 'Home' },
  { href: '/#features', label: 'Features' },
  { href: '/#how', label: 'How it works' },
  { href: '/#privacy', label: 'Privacy' },
]

export default function PublicNav() {
  const { auth } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-semibold text-ink-700 transition-colors hover:text-wine-600">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {auth ? (
            <Link to={homeFor(auth.role)} className="btn-rose">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-3 text-sm font-semibold text-ink-700 hover:text-wine-600">
                Log in
              </Link>
              <Link to="/signup" className="btn-rose">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-xl border border-wine-100 bg-white/80 p-2.5 text-ink-700 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="mx-5 rounded-2xl border border-wine-100 bg-white p-4 shadow-lift md:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-wine-50">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex gap-2 border-t border-wine-100 pt-3">
            {auth ? (
              <Link to={homeFor(auth.role)} className="btn-rose flex-1">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-outline flex-1">
                  Log in
                </Link>
                <Link to="/signup" className="btn-rose flex-1">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
