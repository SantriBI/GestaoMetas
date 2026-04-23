"use client"

import { useState } from "react"
import { AlertTriangle, CheckCheck, Copy, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ChallengeModuleSetup } from "@/lib/challenges"

export function ChallengeInitializationWarning({
  setup,
  title = "Modulo de desafios ainda nao inicializado no banco.",
  description = "Execute o script SQL de criacao das tabelas para ativar o recurso e liberar a persistencia das campanhas.",
  compact = false,
}: {
  setup: ChallengeModuleSetup | null | undefined
  title?: string
  description?: string
  compact?: boolean
}) {
  const [showInstructions, setShowInstructions] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopyScript() {
    if (!setup?.sqlScript || typeof navigator === "undefined" || !navigator.clipboard) return
    await navigator.clipboard.writeText(setup.sqlScript)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  if (!setup || setup.ready) return null

  return (
    <section className={`rounded-[30px] border border-amber-300/16 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92))] shadow-[0_24px_70px_rgba(2,6,23,0.2)] ${compact ? "p-5" : "p-6 sm:p-7"}`}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/80">
            <AlertTriangle className="h-4 w-4" />
            Inicializacao pendente
          </div>
          <h3 className="mt-4 text-2xl font-black tracking-tight text-white">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-white/72">{description}</p>

          {setup.scriptPath ? (
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Script recomendado: {setup.scriptPath}
            </p>
          ) : null}

          {setup.missingTables?.length || setup.missingSequences?.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {setup.missingTables?.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/70">
                  Tabela: {item}
                </span>
              ))}
              {setup.missingSequences?.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/70">
                  Sequence: {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowInstructions((current) => !current)}
            className="h-11 rounded-2xl border-white/12 bg-white/5 text-white hover:bg-white/10"
          >
            <FileText className="mr-2 h-4 w-4" />
            {showInstructions ? "Ocultar instrucoes" : "Ver instrucoes"}
          </Button>

          {setup.sqlScript ? (
            <Button
              type="button"
              onClick={() => void handleCopyScript()}
              className="h-11 rounded-2xl bg-[linear-gradient(135deg,#f59e0b,#f97316)] text-black hover:opacity-95"
            >
              {copied ? <CheckCheck className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Script copiado" : "Copiar script SQL"}
            </Button>
          ) : null}
        </div>
      </div>

      {showInstructions ? (
        <div className="mt-6 space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
          {setup.instructions?.length ? (
            <div className="space-y-2 text-sm leading-7 text-white/70">
              {setup.instructions.map((instruction) => (
                <p key={instruction}>{instruction}</p>
              ))}
            </div>
          ) : null}

          {setup.sqlScript ? (
            <pre className="max-h-[320px] overflow-auto rounded-[20px] border border-white/10 bg-[#020817] p-4 text-xs leading-6 text-white/70">
              <code>{setup.sqlScript}</code>
            </pre>
          ) : (
            <p className="text-sm text-white/60">O script SQL nao ficou disponivel automaticamente nesta sessao.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
