"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowRight, CheckCircle2, MessageCircle, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"
import {
  formatActivationDate,
  getNegotiationCenter,
  postNegotiationEvent,
} from "@/lib/activation-service"
import { ActivationNegotiationCenter } from "@/lib/activation-types"

const DEMO_TOKEN = "demo"
const DEMO_CENTER: ActivationNegotiationCenter = {
  token: DEMO_TOKEN,
  campanha_id: 99901,
  campanha_cliente_id: 9990101,
  cliente_id: 8344,
  cliente: {
    nome: "Casa Aurora Materiais",
    telefone: "5511999999999",
    classificacao_rfv: "Campeoes",
    mensagem_personalizada:
      "Ola Casa Aurora Materiais, tudo bem?\n\nSeparei condicoes especiais para sua proxima compra e posso te atender rapidamente pelo WhatsApp para montar a melhor opcao.",
  },
  vendedor: {
    id: 14,
    nome: "Marina Costa",
    foto_url: null,
    whatsapp: "5511988887777",
    whatsapp_link:
      "https://wa.me/5511988887777?text=Ola%20Marina%2C%20quero%20falar%20sobre%20as%20condicoes%20especiais.",
  },
  campanha: {
    segmento: "Campeoes",
    data_confirmacao: new Date().toISOString(),
    status_envio: "LIDO",
  },
  link: {
    total_cliques: 4,
    primeiro_clique: new Date().toISOString(),
    ultimo_clique: new Date().toISOString(),
    converteu: false,
    valor_conversao: null,
    url: "https://sip.com.br/n/demo",
  },
  cards: [
    {
      id: "promocoes",
      badge: "Condicoes especiais",
      title: "Ofertas preparadas para o seu perfil",
      description: "Veja oportunidades com atendimento mais rapido e foco no que faz sentido para a sua compra.",
      tone: "emerald",
      eyebrow: "Atendimento consultivo",
    },
    {
      id: "orcamento",
      badge: "Orcamento rapido",
      title: "Peça uma proposta sem complicacao",
      description: "Conte o que precisa e receba apoio direto para montar o melhor pedido.",
      tone: "slate",
      eyebrow: "Resposta agil",
    },
    {
      id: "atendimento",
      badge: "Contato direto",
      title: "Fale com sua consultora no WhatsApp",
      description: "Um canal simples para tirar duvidas, negociar e seguir com atendimento humano.",
      tone: "emerald",
      eyebrow: "Suporte comercial",
    },
  ],
}

function buildWhatsappLink(phone: string | null, message: string) {
  if (!phone) return null
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

function getFirstName(name: string | null | undefined) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] ?? "consultor"
}

function FeatureCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <div className="inline-flex rounded-2xl border border-emerald-300/18 bg-emerald-400/10 p-2 text-emerald-100">
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <h3 className="mt-4 text-lg font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-white/68">{description}</p>
    </article>
  )
}

function ActionButton({
  tone = "primary",
  title,
  subtitle,
  disabled,
  onClick,
}: {
  tone?: "primary" | "secondary" | "ghost"
  title: string
  subtitle?: string
  disabled?: boolean
  onClick: () => void
}) {
  const classes =
    tone === "primary"
      ? "border-emerald-300/20 bg-emerald-400/14 text-emerald-50 hover:bg-emerald-400/20"
      : tone === "secondary"
        ? "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]"
        : "border-transparent bg-transparent text-white/72 hover:bg-white/[0.04]"

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-[24px] border px-5 py-4 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      <div>
        <p className="text-lg font-black tracking-tight">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-current/70">{subtitle}</p> : null}
      </div>
      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
    </button>
  )
}

export default function NegotiationCenterPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token ?? "")
  const isDemo = token.toLowerCase() === DEMO_TOKEN
  const [data, setData] = useState<ActivationNegotiationCenter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTracking, setIsTracking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    let active = true

    async function bootstrap() {
      try {
        setIsLoading(true)
        setError(null)

        if (isDemo) {
          if (!active) return
          setData(DEMO_CENTER)
          return
        }

        const payload = await getNegotiationCenter(token)
        if (!active) return
        setData(payload)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Nao foi possivel carregar a pagina.")
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [isDemo, token])

  const sellerFirstName = useMemo(() => getFirstName(data?.vendedor.nome), [data?.vendedor.nome])
  const contactMessage = useMemo(
    () => `Ola ${sellerFirstName}, acessei a pagina de condicoes especiais e quero falar sobre a minha compra.`,
    [sellerFirstName]
  )

  async function handleTrackedAction(action: string, button: string, message: string, fallback?: () => void) {
    if (!token || !data) return

    try {
      setIsTracking(button)

      if (!isDemo) {
        await postNegotiationEvent(token, { action, button, source: "central-publica" })
      }

      const whatsappLink = buildWhatsappLink(data.vendedor.whatsapp, message)
      if (whatsappLink) {
        window.open(whatsappLink, "_blank", "noopener,noreferrer")
        return
      }

      fallback?.()
      toast.message("Recebemos seu interesse", {
        description: "O time SIP deve seguir o atendimento pelo canal configurado.",
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel registrar sua interacao.")
    } finally {
      setIsTracking(null)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#071018] text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-8 py-6 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">SIP</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">Preparando seu atendimento</h1>
            <p className="mt-3 text-sm text-white/62">Estamos carregando suas condicoes especiais.</p>
          </div>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#071018] text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
          <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 p-8 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-rose-100/70">Link indisponivel</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">{error ?? "Pagina nao encontrada."}</h1>
            <p className="mt-3 text-sm text-rose-50/72">
              Se precisar, fale com o time que enviou a campanha para receber um novo acesso.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#071018] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.14),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(125,211,252,0.12),transparent_20%),linear-gradient(180deg,#08131c_0%,#061019_100%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_28px_120px_rgba(2,6,23,0.35)] backdrop-blur-xl sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                <Sparkles className="h-3.5 w-3.5" />
                Condicao especial SIP
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
                {data.cliente.nome}, separamos uma condicao especial para sua proxima compra.
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-8 text-white/72">
                Tudo foi pensado para ser simples: entenda rapidamente a oferta e fale direto com seu vendedor pelo WhatsApp.
              </p>

              <div className="mt-6 rounded-[26px] border border-white/10 bg-[#0a1624] p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Mensagem do seu consultor</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/80">{data.cliente.mensagem_personalizada}</p>
              </div>

              <div className="mt-6 space-y-3">
                <ActionButton
                  tone="primary"
                  title={`Falar com ${sellerFirstName} no WhatsApp`}
                  subtitle="Atendimento rapido para tirar duvidas e negociar"
                  disabled={isTracking !== null}
                  onClick={() =>
                    void handleTrackedAction(
                      "whatsapp",
                      "FALAR_NO_WHATSAPP",
                      contactMessage
                    )
                  }
                />

                <ActionButton
                  tone="secondary"
                  title="Solicitar orçamento"
                  subtitle="Peça uma proposta personalizada"
                  disabled={isTracking !== null}
                  onClick={() =>
                    void handleTrackedAction(
                      "orcamento",
                      "SOLICITAR_ORCAMENTO",
                      `Ola ${sellerFirstName}, quero solicitar um orcamento personalizado.`
                    )
                  }
                />

                <ActionButton
                  tone="ghost"
                  title="Quero atendimento"
                  subtitle="Falar com um consultor agora"
                  disabled={isTracking !== null}
                  onClick={() =>
                    void handleTrackedAction(
                      "atendimento",
                      "QUERO_ATENDIMENTO",
                      `Ola ${sellerFirstName}, quero atendimento para seguir com a negociacao.`
                    )
                  }
                />
              </div>
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-[#0a1624] p-5">
              <div className="flex items-center gap-4">
                <img
                  src={
                    data.vendedor.foto_url ??
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(data.vendedor.nome)}&background=0f172a&color=f8fafc`
                  }
                  alt={data.vendedor.nome}
                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/12"
                />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Seu vendedor</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{data.vendedor.nome}</h2>
                  <p className="mt-1 text-sm text-white/62">
                    {data.vendedor.whatsapp ? `WhatsApp ${data.vendedor.whatsapp}` : "Canal comercial disponivel"}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[22px] border border-emerald-300/14 bg-emerald-400/8 p-4">
                <div className="inline-flex rounded-2xl border border-emerald-300/18 bg-emerald-400/10 p-2 text-emerald-100">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-white">Atendimento direto e sem complicacao</h3>
                <p className="mt-2 text-sm leading-7 text-white/70">
                  Fale com {sellerFirstName} para entender as condicoes, pedir orçamento e seguir com a sua compra.
                </p>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/75">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-white">Oferta preparada para voce</h3>
                <p className="mt-2 text-sm leading-7 text-white/68">
                  Esta pagina foi criada para facilitar seu contato e acelerar sua negociacao com o time comercial.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">O que voce encontra aqui</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Tudo o que voce precisa para decidir rapido</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {data.cards.slice(0, 3).map((card) => (
              <FeatureCard key={card.id} title={card.title} description={card.description} />
            ))}
          </div>
        </section>

        <div className="mt-6 text-center text-sm text-white/46">
          Atendimento preparado em {formatActivationDate(data.campanha.data_confirmacao)}.
        </div>
      </div>
    </main>
  )
}
