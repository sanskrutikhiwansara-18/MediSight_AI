// Palette shared by every admin chart, so a condition keeps the same color
// whether it's on the "by condition" bar chart or the trend line chart.
export const SERIES_COLORS = ['#7A1A36', '#C4566B', '#DA7580', '#E0A2AC', '#9A2445']

export function colorFor(index, name) {
  // The pooled total gets its own dark, neutral color so it reads as the
  // anchor line rather than just another condition in the palette.
  if (name === 'All conditions') return '#26141A'
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

/**
 * Turns raw disease-trend rows (one row per period, either the pooled
 * "All conditions" total or a single condition, individually
 * k-anonymity-suppressed) into a shape recharts' LineChart can plot: one
 * row per month, one column per series, values only for months that
 * cleared the privacy threshold.
 *
 * "All conditions" is always kept (it's the most privacy-robust line,
 * pooling across conditions). The remaining `limit - 1` slots go to the
 * individual conditions with the most shown volume, so the chart stays
 * readable instead of drawing a line per rare condition.
 */
export function pivotTrends(rows, limit = 5) {
  if (rows.length === 0) return { periods: [], conditions: [], data: [] }
  const shown = rows.filter((r) => !r.suppressed)

  const TOTAL = 'All conditions'
  const totals = new Map()
  for (const r of shown) {
    if (r.condition === TOTAL) continue
    totals.set(r.condition, (totals.get(r.condition) || 0) + r.count)
  }
  const hasTotal = shown.some((r) => r.condition === TOTAL)
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  const conditions = [...(hasTotal ? [TOTAL] : []), ...ranked.slice(0, hasTotal ? limit - 1 : limit)]

  // Every period in the raw data gets an axis slot, suppressed or not, so a
  // suppressed month shows as a real break in the line instead of quietly
  // vanishing from the timeline.
  const periods = [...new Set(rows.map((r) => r.period))].sort()
  const byPeriod = new Map(periods.map((p) => [p, { period: p }]))
  for (const r of shown) {
    if (!conditions.includes(r.condition)) continue
    byPeriod.get(r.period)[r.condition] = r.count
  }

  return { periods, conditions, data: periods.map((p) => byPeriod.get(p)) }
}

export function formatPeriod(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}
