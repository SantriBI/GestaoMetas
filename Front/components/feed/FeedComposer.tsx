"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Lock, Loader2, Rocket, Search, Sparkles, Users, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import type { FeedRecipient, FeedVisibility } from "@/lib/feed-types"
import { getUserAvatarSrc, getUserInitials, type AuthUser } from "@/lib/user-session"

interface FeedComposerProps {
  user: AuthUser
  isSubmitting?: boolean
  onSubmit: (input: { message: string; recipient?: FeedRecipient | null }) => Promise<void> | void
  onSearchRecipients: (term: string) => Promise<FeedRecipient[]>
}

const EMOJI_SUGGESTIONS = ["🚀", "🔥", "👏", "💪", "🎯", "🏆"]

function getRoleLabel(role: string) {
  return role === "GERENTE" ? "Gerente" : "Vendedor"
}

export function FeedComposer({
  user,
  isSubmitting = false,
  onSubmit,
  onSearchRecipients,
}: FeedComposerProps) {
  const [message, setMessage] = useState("")
  const [visibility, setVisibility] = useState<FeedVisibility>("PUBLICO")
  const [recipientQuery, setRecipientQuery] = useState("")
  const [selectedRecipient, setSelectedRecipient] = useState<FeedRecipient | null>(null)
  const [recipientOptions, setRecipientOptions] = useState<FeedRecipient[]>([])
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false)
  const [recipientSearchError, setRecipientSearchError] = useState<string | null>(null)
  const searchRecipientsRef = useRef(onSearchRecipients)
  const trimmed = message.trim()
  const canSubmit = trimmed.length > 0 && !isSubmitting
  const helperText = useMemo(() => {
    if (trimmed.length === 0) {
      return visibility === "PRIVADO"
        ? "Sua mensagem ficara visivel apenas para voce e o destinatario."
        : "Compartilhe um resultado, incentivo ou aprendizado com o time."
    }

    return `${trimmed.length}/1000 caracteres`
  }, [trimmed, visibility])

  useEffect(() => {
    searchRecipientsRef.current = onSearchRecipients
  }, [onSearchRecipients])

  useEffect(() => {
    if (visibility === "PRIVADO") return

    setRecipientQuery("")
    setSelectedRecipient(null)
    setRecipientOptions([])
    setRecipientSearchError(null)
    setIsLoadingRecipients(false)
  }, [visibility])

  useEffect(() => {
    if (visibility !== "PRIVADO") return

    const term = recipientQuery.trim()
    if (!term) {
      setRecipientOptions([])
      setRecipientSearchError(null)
      setIsLoadingRecipients(false)
      return
    }

    if (selectedRecipient && term === selectedRecipient.nome.trim()) {
      setRecipientOptions([])
      setRecipientSearchError(null)
      setIsLoadingRecipients(false)
      return
    }

    let cancelled = false
    setIsLoadingRecipients(true)
    setRecipientSearchError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchRecipientsRef.current(term)

        if (cancelled) return
        setRecipientOptions(results)
      } catch (error) {
        if (cancelled) return
        setRecipientOptions([])
        setRecipientSearchError(
          error instanceof Error ? error.message : "Erro ao buscar usuarios."
        )
      } finally {
        if (!cancelled) {
          setIsLoadingRecipients(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [recipientQuery, selectedRecipient, visibility])

  async function handleSubmit() {
    if (!canSubmit) return

    if (visibility === "PRIVADO" && !selectedRecipient) {
      toast({
        title: "Escolha o destinatario",
        description: "Selecione quem vai receber a mensagem privada antes de enviar.",
        variant: "destructive",
      })
      return
    }

    await onSubmit({
      message: trimmed,
      recipient: visibility === "PRIVADO" ? selectedRecipient : null,
    })

    setMessage("")
    setVisibility("PUBLICO")
    setRecipientQuery("")
    setSelectedRecipient(null)
    setRecipientOptions([])
    setRecipientSearchError(null)
  }

  function insertEmoji(emoji: string) {
    setMessage((current) => `${current}${current ? " " : ""}${emoji}`.slice(0, 1000))
  }

  function handleRecipientQueryChange(value: string) {
    setRecipientQuery(value)
    setRecipientSearchError(null)

    if (selectedRecipient && value.trim() !== selectedRecipient.nome.trim()) {
      setSelectedRecipient(null)
    }
  }

  function selectRecipient(recipient: FeedRecipient) {
    setSelectedRecipient(recipient)
    setRecipientQuery(recipient.nome)
    setRecipientOptions([])
    setRecipientSearchError(null)
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

          <div className="mb-4">
            <p className="mb-3 text-xs uppercase tracking-[0.16em] text-white/45">Destino da publicacao</p>
            <RadioGroup
              value={visibility}
              onValueChange={(value) => setVisibility(value as FeedVisibility)}
              className="grid gap-3 lg:grid-cols-2"
            >
              <label
                htmlFor="feed-visibility-public"
                className={`cursor-pointer rounded-2xl border px-4 py-4 transition-colors ${
                  visibility === "PUBLICO"
                    ? "border-emerald-400/35 bg-emerald-500/10"
                    : "border-white/8 bg-white/[0.03] hover:border-white/14"
                }`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    id="feed-visibility-public"
                    value="PUBLICO"
                    className="mt-1 border-white/30 text-emerald-300"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Users className="h-4 w-4 text-emerald-200" />
                      Publico
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#8da2c3]">
                      A mensagem aparece no feed da equipe inteira.
                    </p>
                  </div>
                </div>
              </label>

              <label
                htmlFor="feed-visibility-private"
                className={`cursor-pointer rounded-2xl border px-4 py-4 transition-colors ${
                  visibility === "PRIVADO"
                    ? "border-cyan-400/35 bg-cyan-500/10"
                    : "border-white/8 bg-white/[0.03] hover:border-white/14"
                }`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    id="feed-visibility-private"
                    value="PRIVADO"
                    className="mt-1 border-white/30 text-cyan-300"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Lock className="h-4 w-4 text-cyan-200" />
                      Privado
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#8da2c3]">
                      Fica visivel apenas para voce e o usuario escolhido.
                    </p>
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {visibility === "PRIVADO" ? (
            <div className="mb-4 rounded-2xl border border-cyan-400/12 bg-cyan-500/[0.05] px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Search className="h-4 w-4 text-cyan-200" />
                Enviar para...
              </div>
              <p className="mt-1 text-xs leading-5 text-[#8da2c3]">
                Busque por nome, login ou papel para escolher o destinatario da mensagem privada.
              </p>

              <Input
                value={recipientQuery}
                onChange={(event) => handleRecipientQueryChange(event.target.value)}
                placeholder="Digite o nome do vendedor ou gerente"
                className="mt-3 h-11 rounded-xl border-[#21405d] bg-[#0d1626] text-sm text-white placeholder:text-[#6f84a6] focus-visible:ring-cyan-400/40"
              />

              {selectedRecipient ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{selectedRecipient.nome}</p>
                    <p className="text-xs text-emerald-100/80">
                      {getRoleLabel(selectedRecipient.tipoUsuario)}
                      {selectedRecipient.login ? ` - ${selectedRecipient.login}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecipient(null)
                      setRecipientQuery("")
                      setRecipientOptions([])
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#9cb0cd] transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Limpar destinatario"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {isLoadingRecipients ? (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#9db1cf]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando usuarios...
                </div>
              ) : null}

              {!isLoadingRecipients && recipientSearchError ? (
                <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {recipientSearchError}
                </div>
              ) : null}

              {!isLoadingRecipients && !recipientSearchError && recipientQuery.trim() && !selectedRecipient ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-white/8 bg-[#09111d]">
                  {recipientOptions.length ? (
                    recipientOptions.map((recipient) => (
                      <button
                        key={recipient.id}
                        type="button"
                        onClick={() => selectRecipient(recipient)}
                        className="flex w-full items-center justify-between gap-3 border-b border-white/6 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">
                            {recipient.nome}
                          </span>
                          <span className="block truncate text-xs text-[#8da2c3]">
                            {getRoleLabel(recipient.tipoUsuario)}
                            {recipient.login ? ` - ${recipient.login}` : ""}
                          </span>
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9bb0cd]">
                          {recipient.tipoUsuario === "GERENTE" ? "Gerente" : "Vendedor"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-[#8da2c3]">
                      Nenhum usuario encontrado para esse termo.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

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
              {isSubmitting ? "Enviando..." : visibility === "PRIVADO" ? "Enviar mensagem" : "Publicar"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
