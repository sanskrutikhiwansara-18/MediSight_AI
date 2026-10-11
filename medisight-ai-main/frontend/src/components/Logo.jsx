import React, { useId } from 'react'
import { Link } from 'react-router-dom'

// Five overlapping petals: the same mark as favicon.svg.
export function LogoMark({ size = 28, className = '' }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E0808A" />
          <stop offset="1" stopColor="#7A1A36" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`} transform="translate(16 16)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} rx="4.4" ry="10" transform={`rotate(${deg}) translate(0 -6.2)`} />
        ))}
      </g>
      <circle cx="16" cy="16" r="3" fill="#FDF5F5" />
    </svg>
  )
}

export default function Logo({ to = '/', tone = 'light', className = '' }) {
  const text = tone === 'dark' ? 'text-white' : 'text-ink-900 dark:text-blush-50'
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="MediSight AI home">
      <LogoMark />
      <span className={`font-display text-xl font-semibold tracking-tight ${text}`}>MediSight</span>
    </Link>
  )
}
