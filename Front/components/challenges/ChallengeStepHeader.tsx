"use client"

import { Fragment } from "react"
import { Check } from "lucide-react"

const steps = [
  { label: "Identidade", hint: "Defina o nome, o contexto e o escopo da campanha." },
  { label: "Metas", hint: "Estruture metas claras para o time executar com foco." },
  { label: "Prazo", hint: "Escolha a janela ideal para gerar ritmo e urgencia." },
  { label: "Impacto", hint: "Entenda custo, retorno e revise tudo antes de publicar." },
]

export function ChallengeStepHeader({
  currentStep,
}: {
  currentStep: number
}) {
  const progressWidth = `${((currentStep + 1) / steps.length) * 100}%`
  const current = steps[currentStep]

  return (
    <section className="shrink-0 px-4 pt-4 sm:px-6 lg:px-7">
      <div className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_26%),radial-gradient(circle_at_88%_12%,rgba(244,114,182,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_26px_90px_rgba(2,6,23,0.22)] sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  Fluxo guiado
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  Etapa {currentStep + 1} de {steps.length}
                </span>
              </div>

              <h2 className="mt-3 text-[1.7rem] font-black tracking-tight text-white sm:text-[2rem]">
                Montagem do desafio
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">{current.hint}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px] xl:min-w-[390px]">
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                  <span>Progresso</span>
                  <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#f472b6)] shadow-[0_0_24px_rgba(96,165,250,0.35)]"
                    style={{ width: progressWidth }}
                  />
                </div>
                <p className="mt-3 text-sm text-white/52">Estado salvo entre etapas para voce ajustar tudo com calma.</p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">Agora</p>
                <p className="mt-3 text-base font-semibold text-white">{current.label}</p>
                <p className="mt-1 text-sm text-white/46">Foco principal da tela atual.</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-3 pr-2 xl:min-w-0 xl:gap-4">
              {steps.map((step, index) => {
                const isActive = currentStep === index
                const isDone = index < currentStep

                return (
                  <Fragment key={step.label}>
                    <div
                      className={`flex min-w-[210px] items-center gap-4 rounded-[22px] border px-4 py-4 transition xl:min-w-0 xl:flex-1 ${
                        isActive
                          ? "border-cyan-300/30 bg-cyan-300/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.06)]"
                          : isDone
                            ? "border-emerald-300/24 bg-emerald-400/[0.09]"
                            : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                          isActive
                            ? "border-cyan-300/45 bg-cyan-300/14 text-cyan-100"
                            : isDone
                              ? "border-emerald-300/40 bg-emerald-400 text-black"
                              : "border-white/10 bg-white/5 text-white/52"
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isActive || isDone ? "text-white" : "text-white/66"}`}>
                          {step.label}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/34">
                          {isActive ? "Em andamento" : isDone ? "Concluida" : "A seguir"}
                        </p>
                      </div>
                    </div>

                    {index < steps.length - 1 ? (
                      <div
                        className={`h-px w-10 shrink-0 rounded-full xl:w-12 ${
                          index < currentStep ? "bg-emerald-300/45" : "bg-white/10"
                        }`}
                      />
                    ) : null}
                  </Fragment>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
