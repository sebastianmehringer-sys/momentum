import type { ReactNode } from 'react'

/** Fortschrittsring. ratio = 0 bis 1. In die Mitte kommt standardmäßig die Prozentzahl. */
export default function Ring({
  ratio,
  color = '#6366f1',
  size = 72,
  stroke = 7,
  children,
}: {
  ratio: number
  color?: string
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const clamped = Math.min(1, Math.max(0, ratio))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent = Math.round(clamped * 100)

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center text-sm font-semibold tabular-nums">
        {children ?? `${percent} %`}
      </div>
    </div>
  )
}
