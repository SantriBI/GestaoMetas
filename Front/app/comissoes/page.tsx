"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Gauge, Loader2, Lock, Percent, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/lib/types"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"
import {
  fetchGruposPercentualPremiacao,
  salvarPercentualPremiacao,
  ParametrosPremiacaoApiError,
  type GrupoPercentualPremiacao,
  type NivelGrupoPremiacao,
} from "@/lib/parametros-premiacao"
import {
  fetchFaixasAcelerador,
  salvarFaixasAcelerador as postFaixasAcelerador,
  PremiacaoSimuladorApiError,
  type FaixaAcelerador,
} from "@/lib/premiacao-simulador"

const NIVEIS: Array<{ value: NivelGrupoPremiacao; label: string }> = [
  { value: 1, label: "Nível 1" },
  { value: 2, label: "Nível 2" },
  { value: 3, label: "Nível 3" },
]

interface FaixaEdit {
  limiteSuperior: string
  percAcelerador: string
  bonusFixoAdicional: string
}

function faixasParaEdit(faixas: FaixaAcelerador[]): FaixaEdit[] {
  return faixas.map((faixa) => ({
    limiteSuperior: faixa.limiteSuperior != null ? String(faixa.limiteSuperior) : "",
    percAcelerador: String(faixa.percAcelerador * 100),
    bonusFixoAdicional: String(faixa.bonusFixoAdicional),
  }))
}

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

  const [secaoAtual, setSecaoAtual] = useState<"percentual" | "faixas">("percentual")
  const [faixasEdit, setFaixasEdit] = useState<FaixaEdit[]>([])
  const [loadingFaixas, setLoadingFaixas] = useState(true)
  const [salvandoFaixas, setSalvandoFaixas] = useState(false)
  const [erroFaixas, setErroFaixas] = useState<string | null>(null)

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

  const carregarFaixas = useCallback(async () => {
    setLoadingFaixas(true)
    setErroFaixas(null)
    try {
      const data = await fetchFaixasAcelerador()
      setFaixasEdit(faixasParaEdit(data))
    } catch (error) {
      if (error instanceof PremiacaoSimuladorApiError && error.status === 403) {
        setFeatureIndisponivel(true)
        return
      }
      setErroFaixas(error instanceof PremiacaoSimuladorApiError ? error.message : "Erro ao carregar as faixas do acelerador.")
    } finally {
      setLoadingFaixas(false)
    }
  }, [])

  useEffect(() => {
    if (!authUser || featureIndisponivel || secaoAtual !== "faixas") return
    carregarFaixas()
  }, [authUser, featureIndisponivel, secaoAtual, carregarFaixas])

  function limiteInferiorDaLinha(index: number): number {
    if (index === 0) return 0
    return Number(faixasEdit[index - 1]?.limiteSuperior?.replace(",", ".") ?? 0)
  }

  function atualizarFaixa(index: number, campo: keyof FaixaEdit, valor: string) {
    setFaixasEdit((current) => current.map((faixa, i) => (i === index ? { ...faixa, [campo]: valor } : faixa)))
  }

  function adicionarFaixa() {
    setFaixasEdit((current) => {
      if (current.length > 0) {
        const ultimo = { ...current[current.length - 1] }
        if (!ultimo.limiteSuperior.trim()) {
          toast.error("Preencha o limite superior da ultima faixa antes de adicionar outra.")
          return current
        }
      }
      return [...current, { limiteSuperior: "", percAcelerador: "0", bonusFixoAdicional: "0" }]
    })
  }

  function removerFaixa(index: number) {
    setFaixasEdit((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current))
  }

  async function handleSalvarFaixas() {
    if (faixasEdit.length === 0) {
      toast.error("Cadastre ao menos uma faixa.")
      return
    }

    const payload = faixasEdit.map((faixa, index) => {
      const limiteInferior = limiteInferiorDaLinha(index)
      const ehUltima = index === faixasEdit.length - 1
      const limiteSuperiorTexto = faixa.limiteSuperior.trim().replace(",", ".")
      const limiteSuperior = ehUltima && !limiteSuperiorTexto ? null : Number(limiteSuperiorTexto)
      const percAcelerador = Number(faixa.percAcelerador.replace(",", ".")) / 100
      const bonusFixoAdicional = Number(faixa.bonusFixoAdicional.replace(",", ".") || "0")

      return { limiteInferior, limiteSuperior, percAcelerador, bonusFixoAdicional }
    })

    for (const [index, faixa] of payload.entries()) {
      const ehUltima = index === payload.length - 1
      if (!ehUltima && (faixa.limiteSuperior == null || !Number.isFinite(faixa.limiteSuperior))) {
        toast.error(`Faixa ${index + 1}: informe o limite superior (obrigatorio, exceto na ultima faixa).`)
        return
      }
      if (!Number.isFinite(faixa.percAcelerador) || faixa.percAcelerador < 0) {
        toast.error(`Faixa ${index + 1}: percentual de acelerador invalido.`)
        return
      }
    }

    setSalvandoFaixas(true)
    try {
      const atualizado = await postFaixasAcelerador(payload)
      setFaixasEdit(faixasParaEdit(atualizado))
      toast.success("Escada de faixas do acelerador atualizada com sucesso.")
    } catch (error) {
      toast.error(error instanceof PremiacaoSimuladorApiError ? error.message : "Erro ao salvar a escada de faixas.")
    } finally {
      setSalvandoFaixas(false)
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
          <Tabs value={secaoAtual} onValueChange={(value) => setSecaoAtual(value as "percentual" | "faixas")}>
            <TabsList>
              <TabsTrigger value="percentual">Percentual por grupo</TabsTrigger>
              <TabsTrigger value="faixas">Faixas do acelerador</TabsTrigger>
            </TabsList>

            <TabsContent value="percentual" className="space-y-6">
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
            </TabsContent>

            <TabsContent value="faixas" className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Faixas do acelerador</h1>
                  <p className="text-sm text-white/60">
                    Cadastre a escada completa de margem+frete: cada faixa herda o limite inferior da anterior, entao
                    edite os limites superiores de cima para baixo. A ultima faixa pode ficar sem limite superior.
                  </p>
                </div>
              </div>

              {loadingFaixas ? (
                <div className="flex items-center justify-center gap-2 py-16 text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando faixas...
                </div>
              ) : erroFaixas ? (
                <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 p-5 text-red-100">{erroFaixas}</div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[16px] border border-white/10 bg-white/5">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Margem+frete de</TableHead>
                          <TableHead>até</TableHead>
                          <TableHead>Acelerador (%)</TableHead>
                          <TableHead>Bônus fixo (R$)</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {faixasEdit.map((faixa, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-white/60">{formatCurrency(limiteInferiorDaLinha(index))}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-32"
                                placeholder={index === faixasEdit.length - 1 ? "Sem teto" : ""}
                                value={faixa.limiteSuperior}
                                onChange={(event) => atualizarFaixa(index, "limiteSuperior", event.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-24"
                                value={faixa.percAcelerador}
                                onChange={(event) => atualizarFaixa(index, "percAcelerador", event.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-28"
                                value={faixa.bonusFixoAdicional}
                                onChange={(event) => atualizarFaixa(index, "bonusFixoAdicional", event.target.value)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removerFaixa(index)}
                                disabled={faixasEdit.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="outline" onClick={adicionarFaixa}>
                      <Plus className="h-4 w-4" />
                      Adicionar faixa
                    </Button>
                    <Button size="sm" onClick={() => void handleSalvarFaixas()} disabled={salvandoFaixas}>
                      {salvandoFaixas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar escada completa
                    </Button>
                  </div>

                  <p className="text-xs leading-5 text-white/40">
                    Salvar substitui a escada inteira vigente por esta (fecha a vigência atual e cria uma nova) -
                    revise todas as linhas antes de confirmar.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
