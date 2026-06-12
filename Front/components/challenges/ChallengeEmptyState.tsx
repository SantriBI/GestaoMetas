export function ChallengeEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center rounded-[24px] border border-dashed border-white/[0.07] bg-white/[0.015] px-8 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/25">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-bold text-white/70">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/35">{description}</p>
    </div>
  )
}
