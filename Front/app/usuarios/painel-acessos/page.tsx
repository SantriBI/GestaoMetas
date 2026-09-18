"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { AuthUser, getStoredUser } from "@/lib/user-session"

type PanoramaStatus = "em_dia" | "atencao" | "inativa" | "nunca_acessou"

interface PanoramaVendedor {
  nome: string | null
  login: string
  ultimo_login: string | null
  dias_sem_acesso: number | null
  status: PanoramaStatus
}

interface PanoramaResumo {
  total: number
  em_dia: number
  atencao: number
  inativa: number
  nunca_acessou: number
}

interface PanoramaResponse {
  resumo: PanoramaResumo
  vendedores: PanoramaVendedor[]
}

const STATUS_META: Record<PanoramaStatus, { label: string; cls: string }> = {
  em_dia: { label: "Em dia", cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  atencao: { label: "Atenção", cls: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  inativa: { label: "Inativa", cls: "border-red-500/25 bg-red-500/10 text-red-300" },
  nunca_acessou: { label: "Nunca acessou", cls: "border-slate-500/25 bg-slate-500/10 text-slate-300" },
}

function StatusBadge({ status }: { status: PanoramaStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.cls)}>
      {meta.label}
    </span>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return "Nunca acessou"
  try {
    return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return value
  }
}

function formatDiasSemAcesso(dias: number | null) {
  if (dias === null) return "-"
  if (dias <= 0) return "Hoje"
  if (dias === 1) return "1 dia"
  return `${dias} dias`
}

const KPI_CARDS: { key: keyof PanoramaResumo; label: string; cls: string }[] = [
  { key: "em_dia", label: "Em dia", cls: "text-emerald-300" },
  { key: "atencao", label: "Em atenção (2-5 dias)", cls: "text-amber-300" },
  { key: "inativa", label: "Inativos (+5 dias)", cls: "text-red-300" },
  { key: "nunca_acessou", label: "Nunca acessaram", cls: "text-slate-300" },
]

export default function PainelAcessosEquipePage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [data, setData] = useState<PanoramaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const currentUser = getStoredUser()
    if (!currentUser) {
      router.push("/login")
      return
    }

    const isManager = currentUser.role === "GERENTE"
    const isSystemManagerViewingManager =
      currentUser.role === "GERENTE_SISTEMAS" && currentUser.gerente_sistemas_view === "GERENTE" && !!currentUser.empresa_id

    if (!isManager && !isSystemManagerViewingManager) {
      router.push(currentUser.role === "GERENTE_SISTEMAS" ? "/gerente-sistemas" : "/login")
      return
    }

    setUser(currentUser)
  }, [router])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/usuarios/panorama-acesso/equipe", { credentials: "include" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`)
      setData(json as PanoramaResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar panorama de acessos da equipe.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) void carregar()
  }, [user, carregar])

  if (!user) return null

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.1),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f0fdf4_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,#050814_0%,#0b1220_100%)] dark:text-slate-50 pb-mobile-tabbar">
      <AppShellNav user={user} />
      <MobileTabBar user={user} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Painel de Acessos da Equipe</h1>
            <p className="text-sm text-muted-foreground">
              Último acesso dos seus vendedores liberados. Referência: 5 dias sem acesso indica vendedor inativo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {data && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {KPI_CARDS.map((card) => (
              <div key={card.key} className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className={cn("text-2xl font-bold", card.cls)}>{data.resumo[card.key]}</div>
                <div className="mt-1 text-xs text-muted-foreground">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando panorama...
            </div>
          ) : !data?.vendedores.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum vendedor encontrado no seu escopo.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="px-4 py-3">Último acesso</th>
                  <th className="px-4 py-3">Dias sem acesso</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.vendedores.map((vendedor) => (
                  <tr key={vendedor.login} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{vendedor.nome ?? vendedor.login}</td>
                    <td className="px-4 py-3 text-muted-foreground">{vendedor.login}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(vendedor.ultimo_login)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDiasSemAcesso(vendedor.dias_sem_acesso)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={vendedor.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
