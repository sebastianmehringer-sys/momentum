export default function ProgressBar({ ratio, color = '#6366f1' }: { ratio: number; color?: string }) {
  const percent = Math.round(ratio * 100)
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
        {percent} %
      </span>
    </div>
  )
}
