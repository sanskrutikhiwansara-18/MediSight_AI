import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Logo from './Logo.jsx'
import NeuralOrb from './NeuralOrb.jsx'
import ThemeToggle from './ThemeToggle.jsx'

/** Split layout shared by sign-in and sign-up: dark brand panel + form. */
export default function AuthShell({ children, panelTitle = 'Your health, our priority.', panelText }) {
  return (
    <div className="min-h-screen p-3 lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:gap-3">
      <aside className="relative hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink-900 via-[#240B14] to-wine-900 p-10 text-white lg:flex lg:flex-col">
        <Logo tone="dark" />
        <NeuralOrb seed={31} count={220} showBlob={false} className="pointer-events-none absolute left-1/2 top-[46%] w-[125%] -translate-x-1/2 -translate-y-1/2 opacity-90" />
        <div className="relative mt-auto">
          <h2 className="font-display text-4xl font-medium leading-tight">{panelTitle}</h2>
          {panelText && <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">{panelText}</p>}
        </div>
      </aside>

      <main className="flex min-h-[calc(100vh-1.5rem)] flex-col">
        <div className="flex items-center justify-between px-3 py-3 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-wine-600 dark:text-ink-300">
            <ArrowLeft size={16} aria-hidden="true" /> Back to home
          </Link>
          <Logo className="lg:hidden" />
          <ThemeToggle className="hidden lg:inline-flex" />
        </div>
        <div className="flex flex-1 items-center justify-center px-3 py-6 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  )
}
