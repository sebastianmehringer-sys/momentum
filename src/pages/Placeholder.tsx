export default function Placeholder({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="card mt-2 flex flex-col items-center gap-2 py-12 text-center">
      <div className="text-4xl">{emoji}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  )
}
