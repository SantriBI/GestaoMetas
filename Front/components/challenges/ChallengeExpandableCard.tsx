"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { ChallengeCard } from "@/components/challenges/ChallengeCard"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import type { Challenge } from "@/lib/challenges"

export function ChallengeExpandableCard({
  challenge,
  mode,
  isOpen,
  isLoading = false,
  anchorId,
  detailEyebrow,
  detailTitle,
  detailActions,
  detailContent,
  onToggle,
  onClose,
  onAccept,
  onDismiss,
}: {
  challenge: Challenge
  mode: "manager" | "seller"
  isOpen: boolean
  isLoading?: boolean
  anchorId?: string
  detailEyebrow: string
  detailTitle: string
  detailActions?: ReactNode
  detailContent?: ReactNode
  onToggle: (challenge: Challenge) => void
  onClose: () => void
  onAccept?: (challenge: Challenge) => void
  onDismiss?: (challenge: Challenge) => void
}) {
  const expanded = isOpen || isLoading

  return (
    <Collapsible open={expanded}>
      <div id={anchorId} className="space-y-3">
        <ChallengeCard
          challenge={challenge}
          mode={mode}
          onOpen={onToggle}
          onAccept={onAccept}
          onDismiss={onDismiss}
          detailsState={isLoading ? "loading" : isOpen ? "open" : "closed"}
        />

        <CollapsibleContent
          forceMount
          className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden"
        >
          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,24,0.98),rgba(15,23,42,0.98))] p-5 shadow-[0_28px_90px_rgba(2,6,23,0.24)] sm:p-6">
            <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{detailEyebrow}</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-white">{detailTitle}</h3>
              </div>

              <div className="flex flex-wrap gap-3">
                {detailActions}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-white/12 bg-white/5 text-white hover:bg-white/10"
                  onClick={onClose}
                >
                  <X className="mr-2 h-4 w-4" />
                  Fechar
                </Button>
              </div>
            </div>

            <div className="pt-5">
              {isLoading ? (
                <div className="space-y-4">
                  <div className="h-28 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
                  <div className="h-52 animate-pulse rounded-[24px] border border-white/8 bg-white/5" />
                </div>
              ) : (
                detailContent
              )}
            </div>
          </section>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
