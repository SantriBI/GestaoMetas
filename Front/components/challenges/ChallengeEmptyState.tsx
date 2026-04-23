export function ChallengeEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[30px] border border-dashed border-white/12 bg-white/4 p-10 text-center">
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/60">{description}</p>
    </div>
  )
}
