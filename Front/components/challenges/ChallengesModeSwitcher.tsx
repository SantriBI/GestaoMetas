"use client"

import type { ReactNode } from "react"
import { Eye, PlusCircle } from "lucide-react"

type ChallengesMode = "create" | "list"

export function ChallengesModeSwitcher({
  mode,
  activeCount,
  totalCount,
  onChange,
}: {
  mode: ChallengesMode
  activeCount: number
  totalCount: number
  onChange: (mode: ChallengesMode) => void
}) {
  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="inline-flex rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-1.5">
        <ModePill
          title="Nova campanha"
          icon={<PlusCircle className="h-5 w-5" />}
          active={mode === "create"}
          onClick={() => onChange("create")}
        />
        <ModePill
          title="Campanhas"
          icon={<Eye className="h-5 w-5" />}
          active={mode === "list"}
          onClick={() => onChange("list")}
        />
      </div>
      <p className="text-sm font-medium text-white/46">{activeCount} ativa(s) | {totalCount} total</p>
    </section>
  )
}

function ModePill({
  title,
  icon,
  active,
  onClick,
}: {
  title: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 min-w-[164px] items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-semibold transition ${
        active
          ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "text-white/52 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <span className={`inline-flex h-5 w-5 items-center justify-center ${active ? "text-white" : "text-white/52"}`}>{icon}</span>
      <span>{title}</span>
    </button>
  )
}
