export function ChallengeEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/[0.08] bg-white/[0.025] p-10 text-center">
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/52">{description}</p>
    </div>
  )
}
