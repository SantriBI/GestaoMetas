"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, LogOut,
  Plus, RefreshCw, Search, Trash2, UserCog, Users, Wifi, X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { clearStoredUser, getStoredUser } from "@/lib/user-session"
import { UserManagementPanel } from "@/components/users/UserManagementPanel"

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

interface Gerente {
  id_usuario: number
  nome_completo: string | null
  login: string
  cpf: string | null
  ativo: "S" | "N"
  empresa_id: number
  organizacao_nome: string
  ultimo_login: string | null
}

interface FuncionarioPreview {
  cpf: string
  nome: string
  loja: string | null
  cargo: string | null
  ativo: string
  role_sugerido: string
}

type Tab = "organizacoes" | "gerentes" | "usuarios"

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
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Org form state
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [editOrg, setEditOrg] = useState<(OrgFormState & { _id: number }) | null>(null)
  const [syncingOrg, setSyncingOrg] = useState<number | null>(null)

  // Gerente form state
  const [showGerenteForm, setShowGerenteForm] = useState(false)
  const [gerenteCpf, setGerenteCpf] = useState("")
  const [gerenteSenha, setGerenteSenha] = useState("")
  const [gerenteEmpresaId, setGerenteEmpresaId] = useState("")
  const [funcionarioPreview, setFuncionarioPreview] = useState<FuncionarioPreview | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [savingGerente, setSavingGerente] = useState(false)
  const [editGerente, setEditGerente] = useState<Gerente | null>(null)
  const [editGerenteNovaEmpresa, setEditGerenteNovaEmpresa] = useState("")
  const [editGerenteSenha, setEditGerenteSenha] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setGlobalError(null)
    try {
      const [orgsData, gerentesData] = await Promise.all([
        apiFetch<Org[]>("/api/superadmin/organizacoes"),
        apiFetch<Gerente[]>("/api/superadmin/gerentes"),
      ])
      setOrgs(orgsData)
      setGerentes(gerentesData)
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

  // ── Gerente actions ──────────────────────────────────────────────────────────

  async function onLookupFuncionario() {
    if (!gerenteCpf || !gerenteEmpresaId) { toast.error("Preencha CPF e organização."); return }
    setLookingUp(true)
    setFuncionarioPreview(null)
    try {
      const r = await apiFetch<FuncionarioPreview>("/api/superadmin/funcionario-lookup", { method: "POST", body: JSON.stringify({ cpf: gerenteCpf, empresaId: Number(gerenteEmpresaId) }) })
      setFuncionarioPreview(r)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLookingUp(false)
    }
  }

  async function onCreateGerente(e: React.FormEvent) {
    e.preventDefault()
    setSavingGerente(true)
    try {
      await apiFetch("/api/superadmin/gerentes", { method: "POST", body: JSON.stringify({ cpf: gerenteCpf, senha: gerenteSenha, empresaId: Number(gerenteEmpresaId), nome: funcionarioPreview?.nome }) })
      toast.success("Gerente cadastrado com sucesso!")
      setGerenteCpf(""); setGerenteSenha(""); setGerenteEmpresaId(""); setFuncionarioPreview(null); setShowGerenteForm(false)
      void fetchData()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingGerente(false)
    }
  }

  async function onSaveGerente() {
    if (!editGerente) return
    setSavingGerente(true)
    try {
      await apiFetch(`/api/superadmin/gerentes/${editGerente.id_usuario}?empresa_id=${editGerente.empresa_id}`, {
        method: "PATCH",
        body: JSON.stringify({ empresaId: editGerenteNovaEmpresa ? Number(editGerenteNovaEmpresa) : undefined, novaSenha: editGerenteSenha || undefined }),
      })
      toast.success("Gerente atualizado!")
      setEditGerente(null); setEditGerenteNovaEmpresa(""); setEditGerenteSenha("")
      void fetchData()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingGerente(false)
    }
  }

  async function onToggleGerente(g: Gerente) {
    const novoAtivo = g.ativo === "S" ? "N" : "S"
    await apiFetch(`/api/superadmin/gerentes/${g.id_usuario}/status?empresa_id=${g.empresa_id}`, { method: "PATCH", body: JSON.stringify({ ativo: novoAtivo }) })
    toast.success(`Gerente ${novoAtivo === "S" ? "ativado" : "desativado"}.`)
    void fetchData()
  }

  async function onDeleteGerente(g: Gerente) {
    if (!confirm(`Excluir gerente "${g.nome_completo ?? g.login}"?`)) return
    await apiFetch(`/api/superadmin/gerentes/${g.id_usuario}?empresa_id=${g.empresa_id}`, { method: "DELETE" })
    toast.success("Gerente removido.")
    void fetchData()
  }

  // ── Agrupamento de gerentes por org ──────────────────────────────────────────
  const gerentesPorOrg = gerentes.reduce<Record<string, { nome: string; items: Gerente[] }>>((acc, g) => {
    const key = String(g.empresa_id)
    if (!acc[key]) acc[key] = { nome: g.organizacao_nome, items: [] }
    acc[key].items.push(g)
    return acc
  }, {})

  const activeOrgs = orgs.filter((o) => o.ativo === "S")

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
        <div className="mb-6 flex gap-2">
          {(["organizacoes", "gerentes", "usuarios"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === t ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {t === "organizacoes" ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {t === "organizacoes" ? "Organizações" : t === "gerentes" ? "Gerentes e Senhas" : "Usuarios"}
            </button>
          ))}
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="CPF" required>
                      <input className={inputCls} value={gerenteCpf} onChange={(e) => { setGerenteCpf(e.target.value); setFuncionarioPreview(null) }} placeholder="000.000.000-00" required />
                    </Field>
                    <Field label="Senha inicial" required>
                      <PasswordInput value={gerenteSenha} onChange={setGerenteSenha} placeholder="Mínimo 6 caracteres" />
                    </Field>
                    <Field label="Organização" required>
                      <select className={inputCls} value={gerenteEmpresaId} onChange={(e) => setGerenteEmpresaId(e.target.value)} required>
                        <option value="">Selecione...</option>
                        {activeOrgs.map((o) => <option key={o.id_organizacao} value={o.id_organizacao}>{o.nome}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={onLookupFuncionario} disabled={lookingUp} className={btnSecondary}>
                      {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Verificar CPF no Oracle
                    </button>
                    <button type="submit" disabled={savingGerente} className={btnPrimary}>
                      {savingGerente ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Cadastrar gerente
                    </button>
                    <button type="button" onClick={() => { setShowGerenteForm(false); setFuncionarioPreview(null) }} className={btnSecondary}>
                      <X className="h-4 w-4" />Cancelar
                    </button>
                  </div>

                  {funcionarioPreview && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                      <p className="font-semibold">{funcionarioPreview.nome}</p>
                      <p className="text-xs mt-1">Loja: {funcionarioPreview.loja || "-"}</p>
                      <p className="text-xs mt-0.5">Cargo: {funcionarioPreview.cargo || "-"}</p>
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
                    <select className={inputCls} value={editGerenteNovaEmpresa} onChange={(e) => setEditGerenteNovaEmpresa(e.target.value)}>
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
                <div className="mt-4 flex gap-3">
                  <button onClick={onSaveGerente} disabled={savingGerente} className={btnPrimary}>
                    {savingGerente ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Salvar
                  </button>
                  <button onClick={() => { setEditGerente(null); setEditGerenteNovaEmpresa(""); setEditGerenteSenha("") }} className={btnSecondary}>
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
                {Object.entries(gerentesPorOrg).map(([empresaId, { nome, items }]) => (
                  <div key={empresaId} className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#1c2940] px-4 py-3">
                      <span className="text-sm font-semibold text-foreground">{nome}</span>
                      <span className="text-xs text-muted-foreground">{items.length} gerente(s)</span>
                    </div>
                    <div className="divide-y divide-[#1c2940]/60">
                      {items.map((g) => (
                        <div key={g.id_usuario} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{g.nome_completo ?? g.login}</p>
                            <p className="text-xs text-muted-foreground">Login: {g.login}{g.cpf ? ` · CPF: ${g.cpf}` : ""}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge ativo={g.ativo} />
                            <button className={btnSecondary + " py-1.5 text-xs"} onClick={() => { setEditGerente(g); setEditGerenteNovaEmpresa(""); setEditGerenteSenha("") }}>
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
                  </div>
                ))}
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
      </main>
    </div>
  )
}
