import React, { useId, useMemo } from 'react'

// Small seeded PRNG so the network looks the same on every render and
// between server/client passes.
function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildNetwork(seed, count, radius, cx, cy) {
  const rand = mulberry32(seed)
  const nodes = []
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2
    // Denser toward the middle, like a knot of connections.
    const r = radius * Math.pow(rand(), 0.7)
    nodes.push({
      x: cx + Math.cos(angle) * r * 1.08,
      y: cy + Math.sin(angle) * r * 0.92,
      size: 1 + rand() * 2.4,
      glow: rand() > 0.78,
    })
  }
  const edges = new Set()
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((n) => n.j !== i && n.d < radius * 0.3)
      .sort((p, q) => p.d - q.d)
      .slice(0, 4)
    near.forEach((n) => edges.add(i < n.j ? `${i}-${n.j}` : `${n.j}-${i}`))
  })
  return { nodes, edges: [...edges].map((e) => e.split('-').map(Number)) }
}

/**
 * A knot of glowing connections on a dark, organic shape. Used in the
 * landing hero and the "AI at the core" section. `showBlob={false}` draws
 * only the network so it can sit on another dark surface.
 */
export default function NeuralOrb({ seed = 7, count = 260, showBlob = true, showBadge = true, className = '' }) {
  const uid = useId().replace(/:/g, '')
  const { nodes, edges } = useMemo(() => buildNetwork(seed, count, 205, 300, 280), [seed, count])

  return (
    <svg viewBox="0 0 600 560" className={className} style={{ overflow: showBlob ? 'visible' : undefined }} role="img" aria-label="Illustration of an AI network connecting health data">
      <defs>
        <radialGradient id={`${uid}-blob`} cx="46%" cy="52%" r="70%">
          <stop offset="0" stopColor="#4A1224" />
          <stop offset="0.55" stopColor="#2A0B16" />
          <stop offset="1" stopColor="#160509" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#E0808A" stopOpacity="0.42" />
          <stop offset="1" stopColor="#E0808A" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {showBlob && (
        <g>
          <path
            d="M112 118 C 178 24, 330 -14, 452 30 C 566 70, 632 176, 596 292 C 566 390, 626 466, 520 524 C 424 576, 304 520, 206 548 C 104 576, 14 474, 26 350 C 34 268, 14 186, 112 118 Z"
            fill={`url(#${uid}-blob)`}
          />
          <path
            d="M84 132 C 170 4, 470 -26, 580 140 C 650 250, 585 430, 462 512"
            fill="none"
            stroke="#E0808A"
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
          <path
            d="M70 190 C 60 90, 250 -30, 470 18"
            fill="none"
            stroke="#E0808A"
            strokeOpacity="0.16"
            strokeWidth="1"
          />
        </g>
      )}

      <circle cx="300" cy="280" r="230" fill={`url(#${uid}-halo)`} className="motion-safe:animate-breathe" />

      <g className="origin-[300px_280px] motion-safe:animate-drift">
        <g stroke="#F0919C" strokeOpacity="0.42" strokeWidth="0.8">
          {edges.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />
          ))}
        </g>
        <g fill="#FFB3BB">
          {nodes.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={n.size}
              opacity={n.glow ? 1 : 0.7}
              filter={n.glow ? `url(#${uid}-glow)` : undefined}
            />
          ))}
        </g>
      </g>

      {showBadge && (
        <g>
          <circle cx="300" cy="280" r="46" fill="#5E1229" stroke="#E0808A" strokeOpacity="0.7" strokeWidth="1.5" />
          <circle cx="300" cy="280" r="58" fill="none" stroke="#E0808A" strokeOpacity="0.25" />
          <text
            x="300"
            y="291"
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, serif"
            fontSize="32"
            fontWeight="500"
            fill="#fff"
          >
            AI
          </text>
        </g>
      )}
    </svg>
  )
}
