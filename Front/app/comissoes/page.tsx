"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, Percent, Save } from "lucide-react"
import { toast } from "sonner"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"
import {
  fetchGruposPercentualPremiacao,
  salvarPercentualPremiacao,
  ParametrosPremiacaoApiError,
  type GrupoPercentualPremiacao,
  type NivelGrupoPremiacao,
} from "@/lib/parametros-premiacao"

const NIVEIS: Array<{ value: NivelGrupoPremiacao; label: string }> = [
  { value: 1, label: "Nível 1" },
  { value: 2, label: "Nível 2" },
  { value: 3, label: "Nível 3" },
]

function formatVigenteDesde(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("pt-BR")
}

export default function ComissoesPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [nivel, setNivel] = useState<NivelGrupoPremiacao>(3)
  const [grupos, setGrupos] = useState<GrupoPercentualPremiacao[]>([])
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [salvandoGrupo, setSalvandoGrupo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [featureIndisponivel, setFeatureIndisponivel] = useState(false)

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      router.push("/login")
      return
    }

    const isManager = user.role === "GERENTE"
    const isSystemManagerViewingManager =
      user.role === "GERENTE_SISTEMAS" && user.gerente_sistemas_view === "GERENTE" && !!user.empresa_id

    if (!isManager && !isSystemManagerViewingManager) {
      router.push(user.role === "GERENTE_SISTEMAS" ? "/gerente-sistemas" : "/login")
      return
    }

    setStoredUser(user)
    setAuthUser(user)

    if (!user.featureComissoesHabilitada) {
      setFeatureIndisponivel(true)
      setLoading(false)
    }
  }, [router])

  const carregarGrupos = useCallback(async (nivelAtual: NivelGrupoPremiacao) => {
    setLoading(true)
    setErro(null)
    try {
      const data = await fetchGruposPercentualPremiacao(nivelAtual)
      setGrupos(data)
      setRascunhos(
        Object.fromEntries(data.map((grupo) => [grupo.nomeGrupo, grupo.percentual != null ? String(grupo.percentual) : ""]))
      )
    } catch (error) {
      if (error instanceof ParametrosPremiacaoApiError && error.status === 403) {
        setFeatureIndisponivel(true)
        return
      }
      setErro(error instanceof ParametrosPremiacaoApiError ? error.message : "Erro ao carregar os grupos de premiação.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authUser || featureIndisponivel) return
    carregarGrupos(nivel)
  }, [authUser, nivel, featureIndisponivel, carregarGrupos])

  async function handleSalvar(nomeGrupo: string) {
    const valorDigitado = rascunhos[nomeGrupo] ?? ""
    const percentual = Number(valorDigitado.replace(",", "."))

    if (!valorDigitado.trim() || !Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      toast.error("Informe um percentual válido entre 0 e 100.")
      return
    }

    setSalvandoGrupo(nomeGrupo)
    try {
      const atualizado = await salvarPercentualPremiacao(nivel, nomeGrupo, percentual)
      setGrupos((current) =>
        current.map((grupo) =>
          grupo.nomeGrupo === nomeGrupo
            ? { ...grupo, percentual: atualizado.percentual, vigenteDesde: atualizado.vigenteDesde }
            : grupo
        )
      )
      toast.success(`Percentual de "${nomeGrupo}" atualizado com sucesso.`)
    } catch (error) {
      toast.error(error instanceof ParametrosPremiacaoApiError ? error.message : "Erro ao salvar o percentual.")
    } finally {
      setSalvandoGrupo(null)
    }
  }

  if (!authUser) return null

  if (featureIndisponivel) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] pb-mobile-tabbar">
        <AppShellNav user={authUser} />
        <MobileTabBar user={authUser} />

        <main className="mx-auto max-w-[1000px] px-4 py-8 lg:px-6">
          <div className="flex flex-col items-center gap-3 rounded-[16px] border border-white/10 bg-white/5 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/60">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold text-white">Funcionalidade não disponível</h1>
            <p className="max-w-md text-sm text-white/60">
              O cadastro de percentual de premiação por grupo ainda não foi habilitado para a sua organização.
              Fale com o suporte se acredita que isso é um engano.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-mobile-tabbar">
      <AppShellNav user={authUser} />
      <MobileTabBar user={authUser} />

      <main className="mx-auto max-w-[1000px] px-4 py-8 lg:px-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Percentual de premiação por grupo</h1>
              <p className="text-sm text-white/60">
                Defina o % de premiação por grupo de produto, no nível da hierarquia que fizer sentido.
              </p>
            </div>
          </div>

          <Tabs value={String(nivel)} onValueChange={(value) => setNivel(Number(value) as NivelGrupoPremiacao)}>
            <TabsList>
              {NIVEIS.map((item) => (
                <TabsTrigger key={item.value} value={String(item.value)}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {NIVEIS.map((item) => (
              <TabsContent key={item.value} value={String(item.value)}>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando grupos...
                  </div>
                ) : erro ? (
                  <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-5 text-red-100">{erro}</div>
                ) : grupos.length === 0 ? (
                  <div className="rounded-[16px] border border-white/10 bg-white/5 p-5 text-white/60">
                    Nenhum grupo de produto encontrado neste nível.
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-white/10 bg-white/5">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Vigente desde</TableHead>
                          <TableHead>Percentual (%)</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grupos.map((grupo) => (
                          <TableRow key={grupo.nomeGrupo}>
                            <TableCell className="font-medium text-white">{grupo.nomeGrupo}</TableCell>
                            <TableCell className="text-white/60">
                              {formatVigenteDesde(grupo.vigenteDesde) ?? "Sem cadastro"}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                className="w-28"
                                value={rascunhos[grupo.nomeGrupo] ?? ""}
                                onChange={(event) =>
                                  setRascunhos((current) => ({ ...current, [grupo.nomeGrupo]: event.target.value }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleSalvar(grupo.nomeGrupo)}
                                disabled={salvandoGrupo === grupo.nomeGrupo}
                              >
                                {salvandoGrupo === grupo.nomeGrupo ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                Salvar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  )
}
