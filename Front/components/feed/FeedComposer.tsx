"use client"

import { useMemo, useState } from "react"
import { Rocket, Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getUserAvatarSrc, getUserInitials, type AuthUser } from "@/lib/user-session"

interface FeedComposerProps {
  user: AuthUser
  isSubmitting?: boolean
  onSubmit: (message: string) => Promise<void> | void
}

const EMOJI_SUGGESTIONS = ["🚀", "🔥", "👏", "💪", "🎯", "🏆"]

export function FeedComposer({ user, isSubmitting = false, onSubmit }: FeedComposerProps) {
  const [message, setMessage] = useState("")
  const trimmed = message.trim()
  const canSubmit = trimmed.length > 0 && !isSubmitting
  const helperText = useMemo(() => {
    if (trimmed.length === 0) return "Compartilhe um resultado, incentivo ou aprendizado com o time."
    return `${trimmed.length}/1000 caracteres`
  }, [trimmed])

  async function handleSubmit() {
    if (!canSubmit) return
    await onSubmit(trimmed)
    setMessage("")
  }

  function insertEmoji(emoji: string) {
    setMessage((current) => `${current}${current ? " " : ""}${emoji}`.slice(0, 1000))
  }

  return (
    <section className="rounded-[28px] border border-emerald-500/14 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,rgba(10,18,30,0.96),rgba(8,13,21,0.98))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="flex items-start gap-4">
        <Avatar className="size-11 border border-white/10">
          <AvatarImage src={getUserAvatarSrc(user)} alt={user.nome} />
          <AvatarFallback>{getUserInitials(user.nome)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{user.nome}</span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-200">
              {user.role === "GERENTE" ? "Gerente" : "Vendedor"}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[#8da2c3]">
              <Sparkles className="h-3.5 w-3.5" />
              Pronto para publicar
            </span>
          </div>

          <div className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Momento do feed</p>
            <p className="mt-2 text-sm leading-6 text-[#a8bbb0]">
              Compartilhe uma venda, um incentivo ou uma retomada importante. Quanto mais vivo o feed, mais forte a energia do time.
            </p>
          </div>

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
            placeholder="Compartilhe uma vitoria com o time..."
            className="min-h-[152px] resize-none rounded-2xl border-[#20304c] bg-[#0d1626] text-sm text-white placeholder:text-[#6f84a6] focus-visible:ring-emerald-400/50"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-[#7f95b7]">{helperText}</p>
              <div className="flex flex-wrap gap-2">
                {EMOJI_SUGGESTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-full border border-[#243652] bg-[#0c1422] px-3 py-1 text-sm transition-colors hover:border-emerald-400/35 hover:bg-[#13203a]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-11 rounded-xl bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-5 text-white shadow-[0_12px_28px_rgba(34,197,94,0.28)] hover:brightness-110 sm:min-w-[158px]"
            >
              <Rocket className="mr-2 h-4 w-4" />
              {isSubmitting ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

