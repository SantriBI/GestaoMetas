"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  ChevronRight,
  Eye,
  LayoutDashboard,
  Loader2,
  Search,
  UserRound,
  Users,
} from "lucide-react"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { AuthUser, getStoredUser, setStoredUser } from "@/lib/user-session"

type Organizacao = {
  id_organizacao: number | string
  nome: string
  codigo?: string | null
  descricao?: string | null
}

type Vendedor = {
  sk_vendedor: number | string
  nome: string
  origem?: string
}

async function readApiError(response: Response) {
  try {
    const payload = await response.json()
    return payload?.error || payload?.message || `Erro ${response.status}`
  } catch {
    return `Erro ${response.status}`
  }
}

export default function GerenteSistemasPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("")
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [selectedSeller, setSelectedSeller] = useState<string>("")
  const [sellerSearch, setSellerSearch] = useState("")
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [loadingSellers, setLoadingSellers] = useState(false)
  const [entering, setEntering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedOrg = useMemo(
    () => organizacoes.find((org) => String(org.id_organizacao) === selectedEmpresaId) ?? null,
    [organizacoes, selectedEmpresaId]
  )

  const filteredSellers = useMemo(() => {
    const term = sellerSearch.trim().toLowerCase()
    if (!term) return vendedores

    return vendedores.filter((seller) =>
      String(seller.nome ?? "").toLowerCase().includes(term)
      || String(seller.sk_vendedor ?? "").includes(term)
    )
  }, [sellerSearch, vendedores])

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      router.push("/login")
      return
    }

    if (stored.role !== "GERENTE_SISTEMAS") {
      router.push("/login")
      return
    }

    const currentUser = stored
    setUser(currentUser)

    async function loadOrganizations() {
      setLoadingOrgs(true)
      setError(null)
      try {
        const response = await fetch("/api/gerente-sistemas/organizacoes", {
          credentials: "include",
          cache: "no-store",
        })
        if (!response.ok) throw new Error(await readApiError(response))

        const payload = await response.json()
        const data: Organizacao[] = payload?.data ?? []
        setOrganizacoes(data)
        if (data.length === 1) {
          setSelectedEmpresaId(String(data[0].id_organizacao))
        } else if (currentUser.empresa_id) {
          setSelectedEmpresaId(String(currentUser.empresa_id))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar organizacoes.")
      } finally {
        setLoadingOrgs(false)
      }
    }

    void loadOrganizations()
  }, [router])

  useEffect(() => {
    if (!selectedEmpresaId) {
      setVendedores([])
      setSelectedSeller("")
      return
    }

    async function loadSellers() {
      setLoadingSellers(true)
      setError(null)
      try {
        const response = await fetch(`/api/gerente-sistemas/organizacoes/${selectedEmpresaId}/vendedores`, {
          credentials: "include",
          cache: "no-store",
        })
        if (!response.ok) throw new Error(await readApiError(response))

        const payload = await response.json()
        const data: Vendedor[] = payload?.data ?? []
        setVendedores(data)
        setSelectedSeller("")
      } catch (err) {
        setVendedores([])
        setError(err instanceof Error ? err.message : "Erro ao carregar vendedores.")
      } finally {
        setLoadingSellers(false)
      }
    }

    void loadSellers()
  }, [selectedEmpresaId])

  function buildBaseSession(view: "GERENTE" | "VENDEDOR") {
    if (!user || !selectedOrg) return null

    return {
      ...user,
      empresa_id: selectedOrg.id_organizacao,
      sk_empresa: selectedOrg.id_organizacao,
      organizacao_nome: selectedOrg.nome,
      gerente_sistemas_view: view,
      gerente_sistemas_original_role: "GERENTE_SISTEMAS" as const,
    }
  }

  async function registerEntry(view: "GERENTE" | "VENDEDOR", skVendedor?: string | number | null) {
    const response = await fetch("/api/gerente-sistemas/entrar", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa_id: selectedOrg?.id_organizacao,
        view,
        sk_vendedor: skVendedor ?? null,
      }),
    })
    if (!response.ok) throw new Error(await readApiError(response))
  }

  async function openManagerView() {
    const nextUser = buildBaseSession("GERENTE")
    if (!nextUser) return

    setEntering(true)
    setError(null)
    try {
      await registerEntry("GERENTE")
      setStoredUser({ ...nextUser, sk_vendedor: null })
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel abrir a visao de gerente.")
    } finally {
      setEntering(false)
    }
  }

  async function openSellerView() {
    const nextUser = buildBaseSession("VENDEDOR")
    const seller = vendedores.find((item) => String(item.sk_vendedor) === selectedSeller)
    if (!nextUser || !seller) return

    setEntering(true)
    setError(null)
    try {
      await registerEntry("VENDEDOR", seller.sk_vendedor)
      setStoredUser({
        ...nextUser,
        sk_vendedor: seller.sk_vendedor,
        vendedor_nome_visualizado: seller.nome,
      })
      router.push("/vendedor")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel abrir a visao de vendedor.")
    } finally {
      setEntering(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-mobile-tabbar">
      <AppShellNav user={user} />
      <MobileTabBar user={user} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <section className="rounded-2xl border border-emerald-200/70 bg-card p-5 shadow-sm dark:border-emerald-500/20 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                <Eye className="h-3.5 w-3.5" />
                Acesso multi-organizacao
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Gerente de Sistemas
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Escolha a organizacao e abra a visao gerencial ou a visao de um vendedor liberado.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Usuario: <span className="font-semibold text-foreground">{user?.nome ?? user?.login ?? "-"}</span>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Organizacao</h2>
                <p className="text-sm text-muted-foreground">Selecione o cliente que sera apresentado.</p>
              </div>
            </div>

            {loadingOrgs ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando organizacoes...
              </div>
            ) : organizacoes.length === 0 ? (
              <div className="rounded-xl border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                Nenhuma organizacao foi liberada para este usuario.
              </div>
            ) : (
              <div className="space-y-2">
                {organizacoes.map((org) => {
                  const active = String(org.id_organizacao) === selectedEmpresaId
                  return (
                    <button
                      key={org.id_organizacao}
                      type="button"
                      onClick={() => setSelectedEmpresaId(String(org.id_organizacao))}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-emerald-400 bg-emerald-500/10 text-foreground"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{org.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {org.codigo ? `Codigo ${org.codigo}` : `ID ${org.id_organizacao}`}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid gap-5">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-300">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Tela de gerente</h2>
                  <p className="text-sm text-muted-foreground">Abrir indicadores, ranking e visao geral da equipe.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={openManagerView}
                disabled={!selectedOrg || entering}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {entering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Abrir visao de gerente
              </button>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-300">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Tela de vendedor</h2>
                  <p className="text-sm text-muted-foreground">Escolha um vendedor da organizacao selecionada.</p>
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={sellerSearch}
                  onChange={(event) => setSellerSearch(event.target.value)}
                  placeholder="Buscar vendedor"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <select
                value={selectedSeller}
                onChange={(event) => setSelectedSeller(event.target.value)}
                disabled={!selectedOrg || loadingSellers || vendedores.length === 0}
                className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {loadingSellers ? "Carregando vendedores..." : "Selecione um vendedor"}
                </option>
                {filteredSellers.map((seller) => (
                  <option key={String(seller.sk_vendedor)} value={String(seller.sk_vendedor)}>
                    {seller.nome} - {seller.sk_vendedor}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={openSellerView}
                disabled={!selectedOrg || !selectedSeller || entering}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {entering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                Abrir visao de vendedor
              </button>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}
