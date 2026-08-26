import type { RiskBand } from './types'

export const BAND_COLOR: Record<RiskBand, string> = {
  Low: 'var(--color-low)',
  Moderate: 'var(--color-moderate)',
  Elevated: 'var(--color-elevated)',
  High: 'var(--color-high)',
  Critical: 'var(--color-critical)',
}

export function bandFromScore(score: number): RiskBand {
  if (score <= 20) return 'Low'
  if (score <= 40) return 'Moderate'
  if (score <= 60) return 'Elevated'
  if (score <= 80) return 'High'
  return 'Critical'
}

/** Couleur pour un score 0-100 (santé, SPOF…). */
export function scoreColor(score: number): string {
  return BAND_COLOR[bandFromScore(score)]
}

/** Couleur inverse pour un score « positif » (health : haut = bon). */
export function healthColor(score: number): string {
  if (score >= 75) return 'var(--color-low)'
  if (score >= 50) return 'var(--color-moderate)'
  if (score >= 30) return 'var(--color-elevated)'
  return 'var(--color-critical)'
}
