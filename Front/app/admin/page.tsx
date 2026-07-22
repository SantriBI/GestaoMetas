"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, LogOut,
  MessageSquareText, Plus, RefreshCw, Search, Trash2, UserCog, Users, Wifi, Wrench, X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { clearStoredUser, getStoredUser } from "@/lib/user-session"
import { UserManagementPanel } from "@/components/users/UserManagementPanel"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Org {
  id_organizacao: number
  nome: string
  codigo: string
  ativo: "S" | "N"
  oracle_user: string | null
  oracle_connect_string: string | null
  db_name: string | null
  criado_em: string
}

interface OracleSchemaProvisionResult {
  ok: boolean
  tables: { created: string[]; skipped: string[] }
  sequences: { created: string[]; skipped: string[] }
  indexes: { created: string[]; skipped: string[] }
  comments: number
  triggers: string[]
  failed: { type: string; name: string | null; error: string }[]
}

interface OracleViewsProvisionResult {
  ok: boolean
  created: string[]
  updated: string[]
}

interface ProvisionSchemaResponse {
  message: string
  oracle_schema: OracleSchemaProvisionResult
  oracle_views: OracleViewsProvisionResult
}

interface Gerente {
  id_usuario: number
  nome_completo: string | null
  login: string
  cpf: string | null
  ativo: "S" | "N"
  empresa_id: number
  organizacao_nome: string
  ultimo_login: string | null
  source?: "tenant" | "central"
}

interface GerenteSistemaOrganizacao {
  id_organizacao: number
  nome: string
  codigo?: string | null
}

interface GerenteSistema {
  id_usuario: number
  nome: string | null
  nome_completo: string | null
  login: string
  cpf: string | null
  ativo: "S" | "N"
  ultimo_login: string | null
  role: "GERENTE_SISTEMAS"
  organizacoes: GerenteSistemaOrganizacao[]
}

interface LojaOpcao {
  empresaAcesso: string
  nomeResumido: string
}

interface FuncionarioPreview {
  cpf: string
  nome: string
  loja: string | null
  cargo: string | null
  ativo: string
  role_sugerido: string
  empresa_id: number
  organizacao_nome: string
  lojasPadrao: LojaOpcao[]
}

interface FeedbackUsuario {
  id_feedback: number
  id_usuario: number | null
  empresa_id: number | null
  organizacao_nome: string | null
  sk_vendedor: number | null
  nome_usuario: string | null
  login_usuario: string | null
  tipo_usuario: string | null
  feedback: string
  criado_em: string
}

type Tab = "organizacoes" | "gerentes" | "gerentes_sistemas" | "usuarios" | "feedbacks"

// ─── API helper ───────────────────────────────────────────────────────────────

function getRole() {
  try {
    const u = getStoredUser()
    return u?.role ?? ""
  } catch { return "" }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-role": getRole(),
      ...(options?.headers ?? {}),
    },
    credentials: "include",
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`)
  return json as T
}

function normalizeConnectString(raw: string) {
  const s = raw.trim()
  if (!s.includes(":") && s.includes("/")) {
    return `${s.split("/")[0]}:1521/${s.split("/").slice(1).join("/")}`
  }
  return s
}

function buildOrgCode(nome: string, current?: string) {
  const value = (current || nome || "ORG")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50)

  return value || "ORG"
}

// ─── Shared components ────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
const btnPrimary = "flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
const btnSecondary = "flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
const btnDanger = "flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/25 transition-colors disabled:opacity-50"
const btnWarn = "flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
const btnSuccess = "flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"

function Badge({ ativo }: { ativo: "S" | "N" }) {
  return (
    <span className={cn(
      "rounded-full px-2 py-0.5 text-xs font-medium",
      ativo === "S" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
    )}>
      {ativo === "S" ? "Ativo" : "Inativo"}
    </span>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}{required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} className={cn(inputCls, "pr-10")} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "••••••••"} />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function LojasLiberadasField({
  lojas,
  lojasPadrao,
  selecionadas,
  onToggle,
  loading,
  placeholder,
  emptyMessage,
}: {
  lojas: LojaOpcao[]
  lojasPadrao: string[]
  selecionadas: string[]
  onToggle: (codigo: string) => void
  loading: boolean
  placeholder: string
  emptyMessage: string
}) {
  const ordenadas = [...lojas].sort((a, b) => {
    const aPadrao = lojasPadrao.includes(a.empresaAcesso)
    const bPadrao = lojasPadrao.includes(b.empresaAcesso)
    if (aPadrao !== bPadrao) return aPadrao ? -1 : 1
    return a.nomeResumido.localeCompare(b.nomeResumido)
  })

  const resumo = loading
    ? "Carregando lojas..."
    : selecionadas.length === 0
    ? placeholder
    : selecionadas.length === 1
    ? (lojas.find((l) => l.empresaAcesso === selecionadas[0])?.nomeResumido ?? "1 loja selecionada")
    : `${selecionadas.length} lojas selecionadas`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={loading || lojas.length === 0}
          className={cn(inputCls, "flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60")}
        >
          <span className="truncate">{resumo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto p-0">
        {ordenadas.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="divide-y divide-[#1c2940]/60">
            {ordenadas.map((loja) => {
              const isPadrao = lojasPadrao.includes(loja.empresaAcesso)
              return (
                <label
                  key={loja.empresaAcesso}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted",
                    isPadrao && "cursor-default bg-emerald-500/10"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={selecionadas.includes(loja.empresaAcesso)}
                    disabled={isPadrao}
                    onChange={() => onToggle(loja.empresaAcesso)}
                  />
                  <span className="flex-1 font-medium text-foreground">{loja.nomeResumido}</span>
                  {isPadrao && <span className="text-xs text-emerald-400">Padrão</span>}
                </label>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─── Org Form ─────────────────────────────────────────────────────────────────

interface OrgFormState {
  nome: string; codigo: string; oracleUser: string; oraclePassword: string; oracleConnectString: string; ativo: "S" | "N"
}

const emptyOrgForm: OrgFormState = { nome: "", codigo: "", oracleUser: "", oraclePassword: "", oracleConnectString: "", ativo: "S" }

function OrgForm({
  initial, isEdit, onSave, onCancel, orgs,
}: {
  initial: OrgFormState; isEdit: boolean; onSave: (f: OrgFormState, id?: number) => Promise<void>; onCancel: () => void; orgs: Org[]
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testeResult, setTesteResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null)
  const editId = (initial as OrgFormState & { _id?: number })._id

  function set(k: keyof OrgFormState, v: string) {
    setForm((p) => ({ ...p, [k]: v }))
    setTesteResult(null)
  }

  async function handleTest() {
    if (!form.oracleUser || !form.oraclePassword || !form.oracleConnectString) {
      toast.error("Preencha usuário Oracle, senha e Connect String para testar.")
      return
    }
    setTesting(true)
    setTesteResult(null)
    try {
      const r = await apiFetch<{ ok: boolean; message?: string; error?: string }>("/api/superadmin/organizacoes/test-conexao", {
        method: "POST",
        body: JSON.stringify({ oracleUser: form.oracleUser, oraclePassword: form.oraclePassword, oracleConnectString: normalizeConnectString(form.oracleConnectString) }),
      })
      setTesteResult(r)
    } catch (err) {
      setTesteResult({ ok: false, error: (err as Error).message })
    } finally {
      setTesting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...form, oracleConnectString: normalizeConnectString(form.oracleConnectString) }, editId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.98),rgba(10,14,22,0.99))] p-6">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{isEdit ? "Editar Organização" : "Nova Organização"}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" required><input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome da organização" required /></Field>
          <Field label="Usuário Oracle" required><input className={inputCls} value={form.oracleUser} onChange={(e) => set("oracleUser", e.target.value)} placeholder="Ex: DM_VENDAS" required /></Field>
          <Field label={isEdit ? "Senha Oracle (vazio = manter)" : "Senha Oracle"} required={!isEdit}>
            <PasswordInput value={form.oraclePassword} onChange={(v) => set("oraclePassword", v)} placeholder={isEdit ? "••••••••" : "Senha Oracle"} />
          </Field>
          <Field label="Connect String" required>
            <input className={inputCls} value={form.oracleConnectString} onChange={(e) => set("oracleConnectString", e.target.value)} onBlur={(e) => set("oracleConnectString", normalizeConnectString(e.target.value))} placeholder="172.30.0.175:1521/bipdb" required />
          </Field>
          {isEdit && (
            <Field label="Status">
              <select className={inputCls} value={form.ativo} onChange={(e) => set("ativo", e.target.value as "S" | "N")}>
                <option value="S">Ativo</option>
                <option value="N">Inativo</option>
              </select>
            </Field>
          )}
        </div>

        {testeResult && (
          <div className={cn("rounded-lg border px-4 py-3 text-sm", testeResult.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300")}>
            {testeResult.ok ? `✅ ${testeResult.message}` : `❌ ${testeResult.error}`}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleTest} disabled={testing || saving} className={btnSecondary}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            Testar conexão Oracle
          </button>
          <button type="submit" disabled={saving || testing} className={btnPrimary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar organização"}
          </button>
          <button type="button" onClick={onCancel} className={btnSecondary}><X className="h-4 w-4" />Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("organizacoes")
  const [orgs, setOrgs] = useState<Org[]>([])
  const [gerentes, setGerentes] = useState<Gerente[]>([])
  const [gerentesSistemas, setGerentesSistemas] = useState<GerenteSistema[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Org form state
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [editOrg, setEditOrg] = useState<(OrgFormState & { _id: number }) | null>(null)
  const [syncingOrg, setSyncingOrg] = useState<number | null>(null)
  const [provisioningOrg, setProvisioningOrg] = useState<number | null>(null)

  // Gerente form state
  const [showGerenteForm, setShowGerenteForm] = useState(false)
  const [gerenteCpf, setGerenteCpf] = useState("")
  const [gerenteNome, setGerenteNome] = useState("")
  const [gerenteSenha, setGerenteSenha] = useState("")
  const [gerenteEmpresaId, setGerenteEmpresaId] = useState("")
  const [funcionarioPreview, setFuncionarioPreview] = useState<FuncionarioPreview | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [savingGerente, setSavingGerente] = useState(false)
  const [editGerente, setEditGerente] = useState<Gerente | null>(null)
  const [editGerenteNovaEmpresa, setEditGerenteNovaEmpresa] = useState("")
  const [editGerenteSenha, setEditGerenteSenha] = useState("")
  const [expandedGerenteOrgs, setExpandedGerenteOrgs] = useState<Record<string, boolean>>({})

  // Lojas liberadas (checkboxes DIM_EMPRESAS) - form de criacao
  const [lojasDisponiveis, setLojasDisponiveis] = useState<LojaOpcao[]>([])
  const [lojasPadrao, setLojasPadrao] = useState<string[]>([])
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([])
  const [loadingLojas, setLoadingLojas] = useState(false)

  // Lojas liberadas - form de edicao
  const [editLojasDisponiveis, setEditLojasDisponiveis] = useState<LojaOpcao[]>([])
  const [editLojasPadrao, setEditLojasPadrao] = useState<string[]>([])
  const [editLojasSelecionadas, setEditLojasSelecionadas] = useState<string[]>([])
  const [loadingEditLojas, setLoadingEditLojas] = useState(false)

  // Gerente de Sistemas form state
  const [showGerenteSistemaForm, setShowGerenteSistemaForm] = useState(false)
  const [gerenteSistemaLogin, setGerenteSistemaLogin] = useState("")
  const [gerenteSistemaNome, setGerenteSistemaNome] = useState("")
  const [gerenteSistemaCpf, setGerenteSistemaCpf] = useState("")
  const [gerenteSistemaSenha, setGerenteSistemaSenha] = useState("")
  const [gerenteSistemaOrgIds, setGerenteSistemaOrgIds] = useState<number[]>([])
  const [savingGerenteSistema, setSavingGerenteSistema] = useState(false)
  const [editGerenteSistema, setEditGerenteSistema] = useState<GerenteSistema | null>(null)
  const [editGerenteSistemaSenha, setEditGerenteSistemaSenha] = useState("")
  const [editGerenteSistemaOrgIds, setEditGerenteSistemaOrgIds] = useState<number[]>([])

  // Feedback filters
  const [feedbackEmpresaId, setFeedbackEmpresaId] = useState("")
  const [feedbackTipoUsuario, setFeedbackTipoUsuario] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setGlobalError(null)
    try {
      const [orgsData, gerentesData, gerentesSistemasData, feedbacksData] = await Promise.all([
        apiFetch<Org[]>("/api/superadmin/organizacoes"),
        apiFetch<Gerente[]>("/api/superadmin/gerentes"),
        apiFetch<{ data: GerenteSistema[] }>("/api/superadmin/gerentes-sistemas"),
        apiFetch<{ data: FeedbackUsuario[] }>("/api/superadmin/feedbacks?limit=500"),
      ])
      setOrgs(orgsData)
      setGerentes(gerentesData)
      setGerentesSistemas(gerentesSistemasData.data ?? [])
      setFeedbacks(feedbacksData.data ?? [])
    } catch (err) {
      setGlobalError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const user = getStoredUser()
    if (!user || user.role !== "SUPERADMIN") {
      router.push("/login")
      return
    }
    void fetchData()
  }, [router, fetchData])

  useEffect(() => {
    if (!gerenteEmpresaId) { setLojasDisponiveis([]); return }
    let cancelled = false
    setLoadingLojas(true)
    apiFetch<{ data: LojaOpcao[] }>(`/api/superadmin/lojas?empresa_id=${gerenteEmpresaId}`)
      .then((r) => { if (!cancelled) setLojasDisponiveis(r.data) })
      .catch((err) => { if (!cancelled) toast.error((err as Error).message) })
      .finally(() => { if (!cancelled) setLoadingLojas(false) })
    return () => { cancelled = true }
  }, [gerenteEmpresaId])

  function toggleLojaGerente(codigo: string, editing = false) {
    const padrao = editing ? editLojasPadrao : lojasPadrao
    if (padrao.includes(codigo)) return
    const setter = editing ? setEditLojasSelecionadas : setLojasSelecionadas
    setter((current) => (current.includes(codigo) ? current.filter((c) => c !== codigo) : [...current, codigo]))
  }

  async function startEditGerente(g: Gerente) {
    setEditGerente(g)
    setEditGerenteNovaEmpresa("")
    setEditGerenteSenha("")
    setEditLojasDisponiveis([])
    setEditLojasPadrao([])
    setEditLojasSelecionadas([])

    if (g.source === "central") return // gerentes legados (central) ainda nao suportam lojas manuais

    setLoadingEditLojas(true)
    try {
      const [lojasResp, gerenteLojasResp] = await Promise.all([
        apiFetch<{ data: LojaOpcao[] }>(`/api/superadmin/lojas?empresa_id=${g.empresa_id}`),
        apiFetch<{ lojasPadrao: LojaOpcao[]; lojasManuais: LojaOpcao[] }>(
          `/api/superadmin/gerentes/${g.id_usuario}/lojas?empresa_id=${g.empresa_id}&cpf=${g.cpf ?? ""}`
        ),
      ])
      const padraoCodes = gerenteLojasResp.lojasPadrao.map((l) => l.empresaAcesso)
      const manuaisCodes = gerenteLojasResp.lojasManuais.map((l) => l.empresaAcesso)
      setEditLojasDisponiveis(lojasResp.data)
      setEditLojasPadrao(padraoCodes)
      setEditLojasSelecionadas([...new Set([...padraoCodes, ...manuaisCodes])])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingEditLojas(false)
    }
  }

  async function handleMoverGerenteOrg(novaEmpresaId: string) {
    setEditGerenteNovaEmpresa(novaEmpresaId)
    if (!editGerente || editGerente.source === "central") return

    const empresaAlvo = novaEmpresaId || editGerente.empresa_id
    setLoadingEditLojas(true)
    try {
      const lojasResp = await apiFetch<{ data: LojaOpcao[] }>(`/api/superadmin/lojas?empresa_id=${empresaAlvo}`)
      setEditLojasDisponiveis(lojasResp.data)
      if (novaEmpresaId) {
        // organizacao diferente = codigos de loja diferentes; sem padrao conhecido ainda,
        // admin escolhe manualmente as lojas na organizacao de destino
        setEditLojasPadrao([])
        setEditLojasSelecionadas([])
      } else {
        void startEditGerente(editGerente)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingEditLojas(false)
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {})
    clearStoredUser()
    router.push("/login")
  }

  // ── Org actions ──────────────────────────────────────────────────────────────

  async function onCreateOrg(form: OrgFormState) {
    await apiFetch("/api/superadmin/organizacoes", { method: "POST", body: JSON.stringify({ nome: form.nome, codigo: buildOrgCode(form.nome, form.codigo), oracleUser: form.oracleUser, oraclePassword: form.oraclePassword, oracleConnectString: form.oracleConnectString }) })
    toast.success("Organização criada com sucesso!")
    setShowOrgForm(false)
    void fetchData()
  }

  async function onSaveOrg(form: OrgFormState, id?: number) {
    if (id) {
      await apiFetch(`/api/superadmin/organizacoes/${id}`, { method: "PATCH", body: JSON.stringify({ nome: form.nome, codigo: buildOrgCode(form.nome, form.codigo), oracleUser: form.oracleUser, oraclePassword: form.oraclePassword || undefined, oracleConnectString: form.oracleConnectString, ativo: form.ativo }) })
      toast.success("Organização atualizada!")
    } else {
      await onCreateOrg(form)
    }
    setEditOrg(null)
    void fetchData()
  }

  async function onToggleOrgStatus(org: Org) {
    const novoAtivo = org.ativo === "S" ? "N" : "S"
    await apiFetch(`/api/superadmin/organizacoes/${org.id_organizacao}`, {
      method: "PATCH",
      body: JSON.stringify({ nome: org.nome, codigo: org.codigo, oracleUser: org.oracle_user ?? "", oracleConnectString: org.oracle_connect_string ?? "", ativo: novoAtivo }),
    })
    toast.success(`Organização ${novoAtivo === "S" ? "ativada" : "desativada"}.`)
    void fetchData()
  }

  async function onDeleteOrg(org: Org) {
    if (!confirm(`Tem certeza que deseja excluir a organização "${org.nome}"? Ela sairá desta lista.`)) return
    await apiFetch(`/api/superadmin/organizacoes/${org.id_organizacao}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmacao: `EXCLUIR_ORGANIZACAO_${org.id_organizacao}` }),
    })
    toast.success("Organização removida.")
    void fetchData()
  }

  async function onSyncOrg(org: Org) {
    setSyncingOrg(org.id_organizacao)
    try {
      const r = await apiFetch<Record<string, unknown>>(`/api/superadmin/organizacoes/${org.id_organizacao}/sync-vendedores`, { method: "POST" })
      toast.success(`Sync concluído: ${r.inseridos ?? 0} novos, ${r.atualizados ?? 0} atualizados, ${r.desativados_sem_meta ?? 0} desativados.`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSyncingOrg(null)
    }
  }

  async function onProvisionSchema(org: Org) {
    setProvisioningOrg(org.id_organizacao)
    try {
      const r = await apiFetch<ProvisionSchemaResponse>(`/api/superadmin/organizacoes/${org.id_organizacao}/provisionar-schema`, { method: "POST" })
      const s = r.oracle_schema
      const v = r.oracle_views

      const createdParts: string[] = []
      if (s.tables.created.length) createdParts.push(`${s.tables.created.length} tabela(s)`)
      if (s.sequences.created.length) createdParts.push(`${s.sequences.created.length} sequence(s)`)
      if (s.indexes.created.length) createdParts.push(`${s.indexes.created.length} índice(s)`)
      if (s.triggers.length) createdParts.push(`${s.triggers.length} trigger(s)`)
      if (v.created.length) createdParts.push(`${v.created.length} view(s)`)

      if (s.failed.length > 0) {
        console.error("Falhas ao provisionar schema Oracle:", s.failed)
        toast.error(
          `${s.failed.length} objeto(s) falharam ao criar` +
          (createdParts.length ? ` (mas criou: ${createdParts.join(", ")})` : "") +
          `. Detalhes no console.`
        )
      } else if (createdParts.length === 0) {
        toast.success(`Tudo em dia — nenhuma tabela, sequence, índice, trigger ou view faltando (${v.updated.length} view(s) revalidada(s)).`)
      } else {
        toast.success(`Banco atualizado: criado ${createdParts.join(", ")}.`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setProvisioningOrg(null)
    }
  }

  // ── Gerente actions ──────────────────────────────────────────────────────────

  async function onLookupFuncionario() {
    if (!gerenteCpf) { toast.error("Preencha o CPF."); return }
    setLookingUp(true)
    setFuncionarioPreview(null)
    try {
      const r = await apiFetch<FuncionarioPreview>("/api/superadmin/funcionario-lookup", {
        method: "POST",
        body: JSON.stringify({ cpf: gerenteCpf, empresaId: gerenteEmpresaId ? Number(gerenteEmpresaId) : undefined }),
      })
      setGerenteNome(r.nome)
      setGerenteEmpresaId(String(r.empresa_id))
      setFuncionarioPreview(r)
      const padraoCodes = (r.lojasPadrao ?? []).map((l) => l.empresaAcesso)
      setLojasPadrao(padraoCodes)
      setLojasSelecionadas((current) => [...new Set([...current, ...padraoCodes])])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLookingUp(false)
    }
  }

  function resetGerenteLojasForm() {
    setLojasDisponiveis([]); setLojasPadrao([]); setLojasSelecionadas([])
  }

  async function onCreateGerente(e: React.FormEvent) {
    e.preventDefault()
    if (!gerenteEmpresaId) { toast.error("Selecione a organização."); return }
    if (!gerenteNome.trim()) { toast.error("Informe o nome do gerente."); return }
    if (!lojasSelecionadas.length) { toast.error("Selecione pelo menos uma loja/empresa."); return }
    setSavingGerente(true)
    try {
      await apiFetch("/api/superadmin/gerentes", {
        method: "POST",
        body: JSON.stringify({
          cpf: gerenteCpf,
          senha: gerenteSenha,
          empresaId: Number(gerenteEmpresaId),
          nome: gerenteNome.trim(),
          lojasLiberadas: lojasSelecionadas,
        }),
      })
      toast.success("Gerente cadastrado com sucesso!")
      setGerenteCpf(""); setGerenteNome(""); setGerenteSenha(""); setGerenteEmpresaId(""); setFuncionarioPreview(null); setShowGerenteForm(false)
      resetGerenteLojasForm()
      void fetchData()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingGerente(false)
    }
  }

  async function onSaveGerente() {
    if (!editGerente) return
    if (editGerente.source !== "central" && !editLojasSelecionadas.length) {
      toast.error("Selecione pelo menos uma loja/empresa.")
      return
    }
    setSavingGerente(true)
    try {
      await apiFetch(`/api/superadmin/gerentes/${editGerente.id_usuario}${gerenteQuery(editGerente)}`, {
        method: "PATCH",
        body: JSON.stringify({
          empresaId: editGerenteNovaEmpresa ? Number(editGerenteNovaEmpresa) : undefined,
          novaSenha: editGerenteSenha || undefined,
          lojasLiberadas: editGerente.source === "central" ? undefined : editLojasSelecionadas,
        }),
      })
      toast.success("Gerente atualizado!")
      setEditGerente(null); setEditGerenteNovaEmpresa(""); setEditGerenteSenha("")
      setEditLojasDisponiveis([]); setEditLojasPadrao([]); setEditLojasSelecionadas([])
      void fetchData()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingGerente(false)
    }
  }

  async function onToggleGerente(g: Gerente) {
    const novoAtivo = g.ativo === "S" ? "N" : "S"
    await apiFetch(`/api/superadmin/gerentes/${g.id_usuario}/status${gerenteQuery(g)}`, { method: "PATCH", body: JSON.stringify({ ativo: novoAtivo }) })
    toast.success(`Gerente ${novoAtivo === "S" ? "ativado" : "desativado"}.`)
    void fetchData()
  }

  async function onDeleteGerente(g: Gerente) {
    if (!confirm(`Excluir gerente "${g.nome_completo ?? g.login}"?`)) return
    await apiFetch(`/api/superadmin/gerentes/${g.id_usuario}${gerenteQuery(g)}`, { method: "DELETE" })
    toast.success("Gerente removido.")
    void fetchData()
  }

  // ── Agrupamento de gerentes por org ──────────────────────────────────────────
  function toggleGerenteSistemaOrg(empresaId: number, editing = false) {
    const setter = editing ? setEditGerenteSistemaOrgIds : setGerenteSistemaOrgIds
    setter((current) =>
      current.includes(empresaId)
        ? current.filter((id) => id !== empresaId)
        : [...current, empresaId]
    )
  }

  function clearGerenteSistemaForm() {
    setGerenteSistemaLogin("")
    setGerenteSistemaNome("")
    setGerenteSistemaCpf("")
    setGerenteSistemaSenha("")
    setGerenteSistemaOrgIds([])
  }

  async function onCreateGerenteSistema(e: React.FormEvent) {
    e.preventDefault()
    if (!gerenteSistemaLogin.trim()) { toast.error("Informe o login."); return }
    if (!gerenteSistemaNome.trim()) { toast.error("Informe o nome."); return }
    if (gerenteSistemaSenha.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres."); return }
    if (!gerenteSistemaOrgIds.length) { toast.error("Selecione pelo menos uma organizacao."); return }

    setSavingGerenteSistema(true)
    try {
      await apiFetch("/api/superadmin/gerentes-sistemas", {
        method: "POST",
        body: JSON.stringify({
          login: gerenteSistemaLogin.trim(),
          senha: gerenteSistemaSenha,
          nome: gerenteSistemaNome.trim(),
          cpf: gerenteSistemaCpf.trim() || undefined,
          organizacoes: gerenteSistemaOrgIds,
        }),
      })
      toast.success("Gerente de Sistemas cadastrado com sucesso!")
      clearGerenteSistemaForm()
      setShowGerenteSistemaForm(false)
      void fetchData()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingGerenteSistema(false)
    }
  }

  function startEditGerenteSistema(item: GerenteSistema) {
    setEditGerenteSistema(item)
    setEditGerenteSistemaSenha("")
    setEditGerenteSistemaOrgIds(item.organizacoes.map((org) => Number(org.id_organizacao)).filter(Boolean))
    setShowGerenteSistemaForm(false)
  }

  async function onSaveGerenteSistema() {
    if (!editGerenteSistema) return
    if (!editGerenteSistemaOrgIds.length) { toast.error("Selecione pelo menos uma organizacao."); return }
    if (editGerenteSistemaSenha && editGerenteSistemaSenha.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres."); return }

    setSavingGerenteSistema(true)
    try {
      await apiFetch(`/api/superadmin/gerentes-sistemas/${editGerenteSistema.id_usuario}`, {
        method: "PATCH",
        body: JSON.stringify({
          nome: editGerenteSistema.nome_completo ?? editGerenteSistema.nome ?? editGerenteSistema.login,
          novaSenha: editGerenteSistemaSenha || undefined,
          organizacoes: editGerenteSistemaOrgIds,
        }),
      })
      toast.success("Gerente de Sistemas atualizado!")
      setEditGerenteSistema(null)
      setEditGerenteSistemaSenha("")
      setEditGerenteSistemaOrgIds([])
      void fetchData()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingGerenteSistema(false)
    }
  }

  async function onToggleGerenteSistema(item: GerenteSistema) {
    const novoAtivo = item.ativo === "S" ? "N" : "S"
    await apiFetch(`/api/superadmin/gerentes-sistemas/${item.id_usuario}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo: novoAtivo }),
    })
    toast.success(`Gerente de Sistemas ${novoAtivo === "S" ? "ativado" : "desativado"}.`)
    void fetchData()
  }

  function gerenteQuery(g: Gerente) {
    const params = new URLSearchParams()
    if (g.empresa_id) params.set("empresa_id", String(g.empresa_id))
    if (g.source === "central") params.set("source", "central")
    const query = params.toString()
    return query ? `?${query}` : ""
  }

  const gerentesPorOrg = orgs.reduce<Record<string, { nome: string; items: Gerente[] }>>((acc, org) => {
    acc[String(org.id_organizacao)] = { nome: org.nome, items: [] }
    return acc
  }, {})

  gerentes.reduce<Record<string, { nome: string; items: Gerente[] }>>((acc, g) => {
    const key = String(g.empresa_id)
    if (!acc[key]) acc[key] = { nome: g.organizacao_nome, items: [] }
    acc[key].items.push(g)
    return acc
  }, gerentesPorOrg)

  const activeOrgs = orgs.filter((o) => o.ativo === "S")
  const filteredFeedbacks = feedbacks.filter((item) => {
    const matchesEmpresa = feedbackEmpresaId
      ? String(item.empresa_id ?? "") === feedbackEmpresaId
      : true
    const matchesTipo = feedbackTipoUsuario
      ? String(item.tipo_usuario ?? "").toUpperCase() === feedbackTipoUsuario
      : true

    return matchesEmpresa && matchesTipo
  })

  const feedbacksHoje = feedbacks.filter((item) => {
    const date = new Date(item.criado_em)
    return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString()
  }).length
  const feedbacksComOrganizacao = feedbacks.filter((item) => item.empresa_id != null).length
  const feedbackTipos = Array.from(new Set(feedbacks.map((item) => String(item.tipo_usuario ?? "").toUpperCase()).filter(Boolean))).sort()

  function formatDateTime(raw: string) {
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return "-"

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#1c2940] bg-[#08130f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-foreground">Admin Global</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} disabled={loading} className={btnSecondary}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </button>
            <button onClick={handleLogout} className={btnSecondary}><LogOut className="h-4 w-4" />Sair</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-8">
        {globalError && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <X className="h-4 w-4 shrink-0" />
            {globalError}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(["organizacoes", "gerentes", "gerentes_sistemas", "usuarios"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === t ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {t === "organizacoes" ? <Building2 className="h-4 w-4" /> : t === "gerentes_sistemas" ? <UserCog className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {t === "organizacoes" ? "Organizações" : t === "gerentes" ? "Gerentes e Senhas" : t === "gerentes_sistemas" ? "Gerente de Sistemas" : "Usuarios"}
            </button>
          ))}
          <button
            onClick={() => setTab("feedbacks")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === "feedbacks" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            <MessageSquareText className="h-4 w-4" />
            Feedbacks
          </button>
        </div>

        {/* ── Tab Organizações ── */}
        {tab === "organizacoes" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Organizações</h2>
              <button onClick={() => { setShowOrgForm(true); setEditOrg(null) }} className={btnPrimary}>
                <Plus className="h-4 w-4" />Nova organização
              </button>
            </div>

            {(showOrgForm && !editOrg) && (
              <OrgForm initial={emptyOrgForm} isEdit={false} orgs={orgs}
                onSave={async (f) => { await onSaveOrg(f); setShowOrgForm(false) }}
                onCancel={() => setShowOrgForm(false)} />
            )}

            {editOrg && (
              <OrgForm initial={editOrg} isEdit orgs={orgs}
                onSave={async (f, id) => { await onSaveOrg(f, id); setEditOrg(null) }}
                onCancel={() => setEditOrg(null)} />
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] overflow-hidden">
                <div className="space-y-3 p-4 md:hidden">
                  {orgs.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma organização cadastrada.</p>
                  )}
                  {orgs.map((org) => (
                    <div key={`${org.id_organizacao}-card`} className="rounded-xl border border-[#1c2940] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{org.nome}</p>
                          {org.db_name && <p className="text-xs text-muted-foreground font-mono">{org.db_name}</p>}
                          <p className="mt-1 font-mono text-xs text-muted-foreground">ID {org.id_organizacao}</p>
                        </div>
                        <Badge ativo={org.ativo} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button className={btnSuccess} onClick={() => onSyncOrg(org)} disabled={syncingOrg === org.id_organizacao}>
                          {syncingOrg === org.id_organizacao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Sync
                        </button>
                        <button
                          className={btnSecondary + " py-1.5 text-xs"}
                          onClick={() => onProvisionSchema(org)}
                          disabled={provisioningOrg === org.id_organizacao}
                          title="Cria no Oracle da organização as tabelas, sequences, índices, triggers e views que estiverem faltando"
                        >
                          {provisioningOrg === org.id_organizacao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}Atualizar banco
                        </button>
                        <button className={btnSecondary + " py-1.5 text-xs"} onClick={() => {
                          setEditOrg({ nome: org.nome, codigo: org.codigo, oracleUser: org.oracle_user ?? "", oraclePassword: "", oracleConnectString: org.oracle_connect_string ?? "", ativo: org.ativo, _id: org.id_organizacao } as OrgFormState & { _id: number })
                          setShowOrgForm(false)
                        }}>
                          <UserCog className="h-3.5 w-3.5" />Editar
                        </button>
                        <button className={btnWarn} onClick={() => onToggleOrgStatus(org).catch((e) => toast.error((e as Error).message))}>
                          {org.ativo === "S" ? "Desativar" : "Ativar"}
                        </button>
                        <button className={btnDanger} onClick={() => onDeleteOrg(org).catch((e) => toast.error((e as Error).message))}>
                          <Trash2 className="h-3.5 w-3.5" />Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-center text-xs text-muted-foreground">{orgs.length} organização(ões)</p>
                </div>

                <div className="hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-[#1c2940]">
                          {["ID", "Nome", "Status", "Ações"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c2940]/60">
                        {orgs.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nenhuma organização cadastrada.</td></tr>
                        )}
                        {orgs.map((org) => (
                          <tr key={org.id_organizacao} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{org.id_organizacao}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{org.nome}</p>
                              {org.db_name && <p className="text-xs text-muted-foreground font-mono">{org.db_name}</p>}
                            </td>
                            <td className="px-4 py-3"><Badge ativo={org.ativo} /></td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                <button className={btnSuccess} onClick={() => onSyncOrg(org)} disabled={syncingOrg === org.id_organizacao}>
                                  {syncingOrg === org.id_organizacao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Sync
                                </button>
                                <button
                                  className={btnSecondary + " py-1.5 text-xs"}
                                  onClick={() => onProvisionSchema(org)}
                                  disabled={provisioningOrg === org.id_organizacao}
                                  title="Cria no Oracle da organização as tabelas, sequences, índices, triggers e views que estiverem faltando"
                                >
                                  {provisioningOrg === org.id_organizacao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}Atualizar banco
                                </button>
                                <button className={btnSecondary + " py-1.5 text-xs"} onClick={() => {
                                  setEditOrg({ nome: org.nome, codigo: org.codigo, oracleUser: org.oracle_user ?? "", oraclePassword: "", oracleConnectString: org.oracle_connect_string ?? "", ativo: org.ativo, _id: org.id_organizacao } as OrgFormState & { _id: number })
                                  setShowOrgForm(false)
                                }}>
                                  <UserCog className="h-3.5 w-3.5" />Editar
                                </button>
                                <button className={btnWarn} onClick={() => onToggleOrgStatus(org).catch((e) => toast.error((e as Error).message))}>
                                  {org.ativo === "S" ? "Desativar" : "Ativar"}
                                </button>
                                <button className={btnDanger} onClick={() => onDeleteOrg(org).catch((e) => toast.error((e as Error).message))}>
                                  <Trash2 className="h-3.5 w-3.5" />Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-[#1c2940] px-4 py-2 text-xs text-muted-foreground">{orgs.length} organização(ões)</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Gerentes ── */}
        {tab === "gerentes" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Gerentes e Senhas</h2>
              <button onClick={() => setShowGerenteForm((v) => !v)} className={btnPrimary}>
                <Plus className="h-4 w-4" />{showGerenteForm ? "Fechar" : "Cadastrar gerente"}
              </button>
            </div>

            {showGerenteForm && (
              <div className="mb-6 rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.98),rgba(10,14,22,0.99))] p-6">
                <h3 className="mb-4 text-sm font-semibold">Novo Gerente por CPF</h3>
                <form onSubmit={onCreateGerente} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Field label="CPF" required>
                      <input className={inputCls} value={gerenteCpf} onChange={(e) => { setGerenteCpf(e.target.value); setFuncionarioPreview(null) }} placeholder="000.000.000-00" required />
                    </Field>
                    <Field label="Nome do gerente" required>
                      <input className={inputCls} value={gerenteNome} onChange={(e) => setGerenteNome(e.target.value)} placeholder="Nome completo" required />
                    </Field>
                    <Field label="Senha inicial" required>
                      <PasswordInput value={gerenteSenha} onChange={setGerenteSenha} placeholder="Mínimo 6 caracteres" />
                    </Field>
                    <Field label="Organização" required>
                      <select
                        className={inputCls}
                        value={gerenteEmpresaId}
                        onChange={(e) => { setGerenteEmpresaId(e.target.value); setFuncionarioPreview(null); resetGerenteLojasForm() }}
                        required
                      >
                        <option value="">Selecione...</option>
                        {activeOrgs.map((o) => <option key={o.id_organizacao} value={o.id_organizacao}>{o.nome}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Lojas liberadas" required>
                    <LojasLiberadasField
                      lojas={lojasDisponiveis}
                      lojasPadrao={lojasPadrao}
                      selecionadas={lojasSelecionadas}
                      onToggle={toggleLojaGerente}
                      loading={loadingLojas}
                      placeholder={!gerenteEmpresaId ? "Selecione a organização primeiro" : "Selecione as lojas..."}
                      emptyMessage="Nenhuma loja encontrada em DIM_EMPRESAS para esta organização."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verifique o CPF no Oracle para marcar a loja padrão automaticamente. As demais lojas marcadas aqui ficam liberadas manualmente.
                    </p>
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={onLookupFuncionario} disabled={lookingUp} className={btnSecondary}>
                      {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Verificar CPF no Oracle
                    </button>
                    <button type="submit" disabled={savingGerente} className={btnPrimary}>
                      {savingGerente ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Cadastrar gerente
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowGerenteForm(false); setGerenteNome(""); setGerenteEmpresaId(""); setFuncionarioPreview(null); resetGerenteLojasForm() }}
                      className={btnSecondary}
                    >
                      <X className="h-4 w-4" />Cancelar
                    </button>
                  </div>

                  {funcionarioPreview && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                      <p className="font-semibold">{funcionarioPreview.nome}</p>
                      <p className="text-xs mt-1">Loja: {funcionarioPreview.loja || "-"}</p>
                      <p className="text-xs mt-0.5">Cargo: {funcionarioPreview.cargo || "-"}</p>
                      <p className="text-xs mt-0.5">Organização: {funcionarioPreview.organizacao_nome}</p>
                      <p className="text-xs mt-0.5">CPF: {funcionarioPreview.cpf} · Status: {funcionarioPreview.ativo === "S" ? "Ativo" : "Inativo"} · Role sugerida: {funcionarioPreview.role_sugerido}</p>
                    </div>
                  )}
                </form>
                <p className="mt-4 text-xs text-muted-foreground">Login de vendedores: CPF | Senha inicial: <code>sip123</code></p>
              </div>
            )}

            {/* Edit gerente form */}
            {editGerente && (
              <div className="mb-6 rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.98),rgba(10,14,22,0.99))] p-6">
                <h3 className="mb-4 text-sm font-semibold">Editar: {editGerente.nome_completo ?? editGerente.login}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Mover para outra organização">
                    <select className={inputCls} value={editGerenteNovaEmpresa} onChange={(e) => void handleMoverGerenteOrg(e.target.value)}>
                      <option value="">Manter organização atual</option>
                      {activeOrgs.filter((o) => o.id_organizacao !== editGerente.empresa_id).map((o) => (
                        <option key={o.id_organizacao} value={o.id_organizacao}>{o.nome}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nova senha (vazio = manter)">
                    <PasswordInput value={editGerenteSenha} onChange={setEditGerenteSenha} />
                  </Field>
                </div>

                {editGerente.source === "central" ? (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Este gerente usa um cadastro legado (central) e ainda não suporta liberação manual de lojas.
                  </p>
                ) : (
                  <Field label="Lojas liberadas" required>
                    <LojasLiberadasField
                      lojas={editLojasDisponiveis}
                      lojasPadrao={editLojasPadrao}
                      selecionadas={editLojasSelecionadas}
                      onToggle={(codigo) => toggleLojaGerente(codigo, true)}
                      loading={loadingEditLojas}
                      placeholder="Selecione as lojas..."
                      emptyMessage="Nenhuma loja encontrada em DIM_EMPRESAS para esta organização."
                    />
                    {editGerenteNovaEmpresa && (
                      <p className="mt-1 text-xs text-amber-400">
                        Organização de destino: selecione manualmente as lojas do gerente lá, o padrão anterior não se aplica.
                      </p>
                    )}
                  </Field>
                )}

                <div className="mt-4 flex gap-3">
                  <button onClick={onSaveGerente} disabled={savingGerente} className={btnPrimary}>
                    {savingGerente ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Salvar
                  </button>
                  <button
                    onClick={() => {
                      setEditGerente(null); setEditGerenteNovaEmpresa(""); setEditGerenteSenha("")
                      setEditLojasDisponiveis([]); setEditLojasPadrao([]); setEditLojasSelecionadas([])
                    }}
                    className={btnSecondary}
                  >
                    <X className="h-4 w-4" />Cancelar
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : Object.entries(gerentesPorOrg).length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">Nenhum gerente cadastrado.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(gerentesPorOrg).map(([empresaId, { nome, items }]) => {
                  const isExpanded = expandedGerenteOrgs[empresaId] ?? false

                  return (
                  <div key={empresaId} className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedGerenteOrgs((current) => ({ ...current, [empresaId]: !isExpanded }))}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
                        isExpanded && "border-b border-[#1c2940]"
                      )}
                    >
                      <span className="text-sm font-semibold text-foreground">{nome}</span>
                        <span className="flex items-center gap-3">
                          {isExpanded && <span className="text-xs text-muted-foreground">{items.length} gerente(s)</span>}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </span>
                    </button>
                    {isExpanded && (
                    <div className="divide-y divide-[#1c2940]/60">
                      {items.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-muted-foreground">Nenhum gerente cadastrado nesta organização.</div>
                      ) : items.map((g) => (
                        <div key={`${g.source ?? "tenant"}-${g.empresa_id}-${g.id_usuario}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{g.nome_completo ?? g.login}</p>
                            <p className="text-xs text-muted-foreground">Login: {g.login}{g.cpf ? ` · CPF: ${g.cpf}` : ""}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge ativo={g.ativo} />
                            <button className={btnSecondary + " py-1.5 text-xs"} onClick={() => void startEditGerente(g)}>
                              <UserCog className="h-3.5 w-3.5" />Editar
                            </button>
                            <button className={btnWarn} onClick={() => onToggleGerente(g).catch((e) => toast.error((e as Error).message))}>
                              {g.ativo === "S" ? "Desativar" : "Ativar"}
                            </button>
                            <button className={btnDanger} onClick={() => onDeleteGerente(g).catch((e) => toast.error((e as Error).message))}>
                              <Trash2 className="h-3.5 w-3.5" />Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === "gerentes_sistemas" && (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Gerente de Sistemas</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cadastre usuarios com acesso de visualizacao a multiplas organizacoes.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowGerenteSistemaForm((value) => !value)
                  setEditGerenteSistema(null)
                }}
                className={btnPrimary}
              >
                <Plus className="h-4 w-4" />
                {showGerenteSistemaForm ? "Fechar" : "Cadastrar gerente de sistemas"}
              </button>
            </div>

            {showGerenteSistemaForm && (
              <div className="mb-6 rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.98),rgba(10,14,22,0.99))] p-6">
                <h3 className="mb-4 text-sm font-semibold">Novo Gerente de Sistemas</h3>
                <form onSubmit={onCreateGerenteSistema} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Field label="Login" required>
                      <input className={inputCls} value={gerenteSistemaLogin} onChange={(e) => setGerenteSistemaLogin(e.target.value)} placeholder="Ex: chefe" required />
                    </Field>
                    <Field label="Nome" required>
                      <input className={inputCls} value={gerenteSistemaNome} onChange={(e) => setGerenteSistemaNome(e.target.value)} placeholder="Nome completo" required />
                    </Field>
                    <Field label="CPF">
                      <input className={inputCls} value={gerenteSistemaCpf} onChange={(e) => setGerenteSistemaCpf(e.target.value)} placeholder="Opcional" />
                    </Field>
                    <Field label="Senha inicial" required>
                      <PasswordInput value={gerenteSistemaSenha} onChange={setGerenteSistemaSenha} placeholder="Minimo 6 caracteres" />
                    </Field>
                  </div>

                  <Field label="Organizacoes liberadas" required>
                    <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-[#1c2940] bg-background/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {activeOrgs.map((org) => (
                        <label key={org.id_organizacao} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm transition-colors hover:bg-muted">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-emerald-500"
                            checked={gerenteSistemaOrgIds.includes(org.id_organizacao)}
                            onChange={() => toggleGerenteSistemaOrg(org.id_organizacao)}
                          />
                          <span>
                            <span className="block font-medium text-foreground">{org.nome}</span>
                            <span className="block text-xs text-muted-foreground">ID {org.id_organizacao}</span>
                          </span>
                        </label>
                      ))}
                      {activeOrgs.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhuma organizacao ativa encontrada.</p>
                      )}
                    </div>
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={savingGerenteSistema} className={btnPrimary}>
                      {savingGerenteSistema ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Cadastrar gerente de sistemas
                    </button>
                    <button type="button" onClick={() => { setShowGerenteSistemaForm(false); clearGerenteSistemaForm() }} className={btnSecondary}>
                      <X className="h-4 w-4" />Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {editGerenteSistema && (
              <div className="mb-6 rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.98),rgba(10,14,22,0.99))] p-6">
                <h3 className="mb-4 text-sm font-semibold">Editar: {editGerenteSistema.nome_completo ?? editGerenteSistema.nome ?? editGerenteSistema.login}</h3>
                <div className="space-y-4">
                  <Field label="Nova senha (vazio = manter)">
                    <PasswordInput value={editGerenteSistemaSenha} onChange={setEditGerenteSistemaSenha} />
                  </Field>
                  <Field label="Organizacoes liberadas" required>
                    <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-[#1c2940] bg-background/40 p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {activeOrgs.map((org) => (
                        <label key={org.id_organizacao} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm transition-colors hover:bg-muted">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-emerald-500"
                            checked={editGerenteSistemaOrgIds.includes(org.id_organizacao)}
                            onChange={() => toggleGerenteSistemaOrg(org.id_organizacao, true)}
                          />
                          <span>
                            <span className="block font-medium text-foreground">{org.nome}</span>
                            <span className="block text-xs text-muted-foreground">ID {org.id_organizacao}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={onSaveGerenteSistema} disabled={savingGerenteSistema} className={btnPrimary}>
                      {savingGerenteSistema ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Salvar
                    </button>
                    <button onClick={() => { setEditGerenteSistema(null); setEditGerenteSistemaSenha(""); setEditGerenteSistemaOrgIds([]) }} className={btnSecondary}>
                      <X className="h-4 w-4" />Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : gerentesSistemas.length === 0 ? (
              <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] py-16 text-center text-muted-foreground">
                Nenhum Gerente de Sistemas cadastrado.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))]">
                <div className="space-y-3 p-4 md:hidden">
                  {gerentesSistemas.map((item) => (
                    <div key={`${item.id_usuario}-card`} className="rounded-xl border border-[#1c2940] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{item.nome_completo ?? item.nome ?? item.login}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Login: {item.login}{item.cpf ? ` - CPF: ${item.cpf}` : ""}</p>
                        </div>
                        <Badge ativo={item.ativo} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.organizacoes.length ? item.organizacoes.map((org) => (
                          <span key={org.id_organizacao} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
                            {org.nome}
                          </span>
                        )) : (
                          <span className="text-xs text-muted-foreground">Sem organizacoes vinculadas</span>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Ultimo login: {item.ultimo_login ? formatDateTime(item.ultimo_login) : "-"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className={btnSecondary + " py-1.5 text-xs"} onClick={() => startEditGerenteSistema(item)}>
                          <UserCog className="h-3.5 w-3.5" />Editar
                        </button>
                        <button className={btnWarn} onClick={() => onToggleGerenteSistema(item).catch((e) => toast.error((e as Error).message))}>
                          {item.ativo === "S" ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-center text-xs text-muted-foreground">{gerentesSistemas.length} Gerente(s) de Sistemas</p>
                </div>

                <div className="hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b border-[#1c2940]">
                          {["Usuario", "Status", "Organizacoes liberadas", "Ultimo login", "Acoes"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c2940]/60">
                        {gerentesSistemas.map((item) => (
                          <tr key={item.id_usuario} className="align-top hover:bg-white/[0.02]">
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.nome_completo ?? item.nome ?? item.login}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">Login: {item.login}{item.cpf ? ` - CPF: ${item.cpf}` : ""}</p>
                            </td>
                            <td className="px-4 py-3"><Badge ativo={item.ativo} /></td>
                            <td className="px-4 py-3">
                              <div className="flex max-w-xl flex-wrap gap-1.5">
                                {item.organizacoes.length ? item.organizacoes.map((org) => (
                                  <span key={org.id_organizacao} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
                                    {org.nome}
                                  </span>
                                )) : (
                                  <span className="text-xs text-muted-foreground">Sem organizacoes vinculadas</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{item.ultimo_login ? formatDateTime(item.ultimo_login) : "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button className={btnSecondary + " py-1.5 text-xs"} onClick={() => startEditGerenteSistema(item)}>
                                  <UserCog className="h-3.5 w-3.5" />Editar
                                </button>
                                <button className={btnWarn} onClick={() => onToggleGerenteSistema(item).catch((e) => toast.error((e as Error).message))}>
                                  {item.ativo === "S" ? "Desativar" : "Ativar"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-[#1c2940] px-4 py-3 text-xs text-muted-foreground">
                    {gerentesSistemas.length} Gerente(s) de Sistemas
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "usuarios" && (
          <UserManagementPanel
            organizations={orgs}
            allowOrganizationSelect
            title="Controle de usuarios por organizacao"
            description="Selecione uma organizacao para editar senha, aplicar logoff, ativar ou inativar usuarios."
          />
        )}

        {tab === "feedbacks" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Feedbacks</h2>
                <p className="mt-1 text-sm text-muted-foreground">Mensagens recebidas por organizacao, usuario e horario.</p>
              </div>
              <button onClick={fetchData} disabled={loading} className={btnSecondary}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total recebido</p>
                <p className="mt-2 text-2xl font-bold">{feedbacks.length}</p>
              </div>
              <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hoje</p>
                <p className="mt-2 text-2xl font-bold">{feedbacksHoje}</p>
              </div>
              <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Com organizacao</p>
                <p className="mt-2 text-2xl font-bold">{feedbacksComOrganizacao}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                <Field label="Organizacao">
                  <select className={inputCls} value={feedbackEmpresaId} onChange={(e) => setFeedbackEmpresaId(e.target.value)}>
                    <option value="">Todas as organizacoes</option>
                    {orgs.map((org) => (
                      <option key={org.id_organizacao} value={org.id_organizacao}>{org.nome}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Perfil">
                  <select className={inputCls} value={feedbackTipoUsuario} onChange={(e) => setFeedbackTipoUsuario(e.target.value)}>
                    <option value="">Todos os perfis</option>
                    {feedbackTipos.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </Field>
                <button
                  type="button"
                  onClick={() => { setFeedbackEmpresaId(""); setFeedbackTipoUsuario("") }}
                  className={btnSecondary}
                >
                  <X className="h-4 w-4" />
                  Limpar
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredFeedbacks.length === 0 ? (
              <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] py-16 text-center text-muted-foreground">
                Nenhum feedback encontrado.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))]">
                <div className="space-y-3 p-4 md:hidden">
                  {filteredFeedbacks.map((item) => (
                    <div key={`${item.id_feedback}-card`} className="rounded-xl border border-[#1c2940] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{item.organizacao_nome ?? "Sem organizacao"}</p>
                        <span className="shrink-0 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-200">
                          {item.tipo_usuario ?? "USUARIO"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.criado_em)}</p>
                      <p className="mt-2 text-sm font-medium">{item.nome_usuario ?? item.login_usuario ?? "Usuario nao identificado"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.login_usuario ? `Login: ${item.login_usuario}` : "Sem login"}
                        {item.sk_vendedor != null ? ` - SK: ${item.sk_vendedor}` : ""}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{item.feedback}</p>
                    </div>
                  ))}
                  <p className="text-center text-xs text-muted-foreground">{filteredFeedbacks.length} feedback(s) exibido(s)</p>
                </div>

                <div className="hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b border-[#1c2940]">
                          {["Data e hora", "Organizacao", "Quem enviou", "Perfil", "Mensagem"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c2940]/60">
                        {filteredFeedbacks.map((item) => (
                          <tr key={item.id_feedback} className="align-top hover:bg-white/[0.02]">
                            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(item.criado_em)}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.organizacao_nome ?? "Sem organizacao"}</p>
                              {item.empresa_id != null && <p className="mt-0.5 font-mono text-xs text-muted-foreground">ID {item.empresa_id}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.nome_usuario ?? item.login_usuario ?? "Usuario nao identificado"}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {item.login_usuario ? `Login: ${item.login_usuario}` : "Sem login"}
                                {item.sk_vendedor != null ? ` - SK: ${item.sk_vendedor}` : ""}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-200">
                                {item.tipo_usuario ?? "USUARIO"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-foreground/90">
                              <p className="max-w-[520px] whitespace-pre-wrap leading-relaxed">{item.feedback}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-[#1c2940] px-4 py-3 text-xs text-muted-foreground">
                    {filteredFeedbacks.length} feedback(s) exibido(s)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
