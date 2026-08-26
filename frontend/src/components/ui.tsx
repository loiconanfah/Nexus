import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </h2>
      {hint && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</span>}
    </div>
  )
}

export function StatTile({ label, value, sub, color }: { label: string; value: ReactNode; sub?: string; color?: string }) {
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums" style={{ color: color ?? 'var(--color-text-strong)' }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>}
    </Card>
  )
}

export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color: color ?? 'var(--color-text)',
        background: color ? `color-mix(in srgb, ${color} 18%, transparent)` : 'var(--color-surface-2)',
        border: `1px solid ${color ? `color-mix(in srgb, ${color} 40%, transparent)` : 'var(--color-border)'}`,
      }}
    >
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'ghost'
  type?: 'button' | 'submit'
}) {
  const primary = variant === 'primary'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
      style={{
        background: primary ? 'var(--color-brand)' : 'var(--color-surface-2)',
        color: primary ? '#fff' : 'var(--color-text)',
        border: `1px solid ${primary ? 'var(--color-brand)' : 'var(--color-border)'}`,
      }}
    >
      {children}
    </button>
  )
}

export function ScoreRing({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="rotate-90 tabular-nums"
        style={{ fill: 'var(--color-text-strong)', fontSize: size * 0.26, fontWeight: 600, transformOrigin: 'center' }}
      >
        {Math.round(score)}
      </text>
    </svg>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden
      />
      {label}
    </div>
  )
}
