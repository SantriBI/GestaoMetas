import { PhoneCall, PhoneOff, Target, Users } from "lucide-react"
import { ActivationSummary } from "@/lib/activation-types"
import { formatActivationCurrency } from "@/lib/activation-service"

const ITEMS = [
  { key: "total_clientes", label: "Clientes encontrados", icon: Users, tone: "cyan" },
  { key: "total_com_telefone", label: "Com telefone válido", icon: PhoneCall, tone: "emerald" },
  { key: "total_sem_telefone", label: "Sem telefone", icon: PhoneOff, tone: "amber" },
  { key: "valor_potencial_carteira", label: "Valor potencial da carteira", icon: Target, tone: "violet" },
] as const

export function ImpactCards({ summary }: { summary: ActivationSummary | null }) {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const isCurrency = item.key === "valor_potencial_carteira"
        const rawValue = summary?.[item.key] ?? 0
        const value = isCurrency ? formatActivationCurrency(Number(rawValue)) : String(rawValue)

        return (
          <article
            key={item.key}
            className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,30,0.95),rgba(7,10,18,0.92))] p-5 shadow-[0_22px_60px_rgba(2,6,23,0.22)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{item.label}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/82">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}
