"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, CheckCircle2, Edit2, Plus, RefreshCw, Trash2, XCircle, Eye, EyeOff, Wifi } from "lucide-react"
import { toast } from "sonner"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { useOrganizacoes, type Organizacao, type OrganizacaoPayload, type TesteConexaoResult } from "@/hooks/useOrganizacoes"
import { getStoredUser, type AuthUser } from "@/lib/user-session"
import { cn } from "@/lib/utils"

// ─── Tipos de modal ──────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; org: Organizacao }
  | { type: "delete"; org: Organizacao }
  | { type: "test"; org: Organizacao }

// ─── Formulário ──────────────────────────────────────────────────────────────

interface FormState {
  nome: string
  descricao: string
  status: "ATIVA" | "INATIVA"
  db_user: string
  db_password: string
  db_connect_string: string
}

const emptyForm: FormState = {
  nome: "",
  descricao: "",
  status: "ATIVA",
  db_user: "",
  db_password: "",
  db_connect_string: "",
}

function formFromOrg(org: Organizacao): FormState {
  return {
    nome: org.nome,
    descricao: org.descricao ?? "",
    status: org.status,
    db_user: org.db_user,
    db_password: "",
    db_connect_string: org.db_connect_string,
  }
}

// ─── Componente de Campo ─────────────────────────────────────────────────────

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  "w-full rounded-lg bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"

// ─── Modal base ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/40">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Modal Formulário (criar / editar) ───────────────────────────────────────

function OrgFormModal({
  title,
  initial,
  onClose,
  onSubmit,
  onTestar,
  isEdit,
}: {
  title: string
  initial: FormState
  onClose: () => void
  onSubmit: (f: FormState) => Promise<void>
  onTestar: (f: FormState) => Promise<TesteConexaoResult>
  isEdit: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testeResult, setTesteResult] = useState<TesteConexaoResult | null>(null)

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTesteResult(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit(form)
    } finally {
      setSaving(false)
    }
  }

  async function handleTestar() {
    if (!form.db_user || !form.db_connect_string) {
      toast.error("Preencha usuário Oracle e Connect String antes de testar.")
      return
    }
    if (!isEdit && !form.db_password) {
      toast.error("Preencha a senha Oracle antes de testar.")
      return
    }
    setTesting(true)
    setTesteResult(null)
    try {
      const result = await onTestar(form)
      setTesteResult(result)
    } catch (err) {
      setTesteResult({ sucesso: false, mensagem: "Erro ao testar conexão.", detalhe: (err as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dados da Organização</p>

          <Field label="Nome" required>
            <input
              className={inputClass}
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Empresa XYZ"
              required
            />
          </Field>

          <Field label="Descrição">
            <textarea
              className={cn(inputClass, "resize-none")}
              rows={2}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Descrição opcional..."
            />
          </Field>

          <Field label="Status" required>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as "ATIVA" | "INATIVA")}
            >
              <option value="ATIVA">Ativa</option>
              <option value="INATIVA">Inativa</option>
            </select>
          </Field>
        </div>

        <div className="space-y-4 pt-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Configuração Oracle</p>

          <Field label="Usuário Oracle" required>
            <input
              className={inputClass}
              value={form.db_user}
              onChange={(e) => set("db_user", e.target.value)}
              placeholder="Ex: DM_VENDAS"
              required
            />
          </Field>

          <Field label={isEdit ? "Senha Oracle (deixe em branco para manter a atual)" : "Senha Oracle"} required={!isEdit}>
            <div className="relative">
              <input
                className={cn(inputClass, "pr-10")}
                type={showPassword ? "text" : "password"}
                value={form.db_password}
                onChange={(e) => set("db_password", e.target.value)}
                placeholder={isEdit ? "••••••••" : "Senha do banco Oracle"}
                required={!isEdit}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Field label="Connect String" required>
            <input
              className={inputClass}
              value={form.db_connect_string}
              onChange={(e) => set("db_connect_string", e.target.value)}
              placeholder="Ex: 172.30.0.175:1521/bipdb"
              required
            />
          </Field>
        </div>

        {/* Resultado do teste */}
        {testeResult && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              testeResult.sucesso
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            )}
          >
            {testeResult.sucesso ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-medium">{testeResult.mensagem}</p>
              {testeResult.detalhe && <p className="mt-0.5 text-xs opacity-80">{testeResult.detalhe}</p>}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestar}
            disabled={testing || saving}
            className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {testing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            Testar Conexão
          </button>

          <button
            type="submit"
            disabled={saving || testing}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(34,197,94,0.2)] hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal Excluir ───────────────────────────────────────────────────────────

function DeleteModal({ org, onClose, onConfirm }: { org: Organizacao; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Excluir Organização" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <Trash2 className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">
            Tem certeza que deseja excluir a organização <strong>"{org.nome}"</strong>? Esta ação não pode ser desfeita.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {loading ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal Teste de Conexão (para org já salva) ──────────────────────────────

function TestModal({ org, onClose, onTestar }: {
  org: Organizacao
  onClose: () => void
  onTestar: (id: number) => Promise<TesteConexaoResult>
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TesteConexaoResult | null>(null)

  async function handleTest() {
    setLoading(true)
    setResult(null)
    try {
      const r = await onTestar(org.id)
      setResult(r)
    } catch (err) {
      setResult({ sucesso: false, mensagem: "Erro ao testar.", detalhe: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Testar Conexão Oracle" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 space-y-1 text-sm">
          <p className="text-muted-foreground">Organização:</p>
          <p className="font-semibold text-foreground">{org.nome}</p>
          <p className="text-muted-foreground font-mono text-xs mt-1">{org.db_user}@{org.db_connect_string}</p>
        </div>

        {result && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              result.sucesso
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            )}
          >
            {result.sucesso ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-medium">{result.mensagem}</p>
              {result.detalhe && <p className="mt-0.5 text-xs opacity-80">{result.detalhe}</p>}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(34,197,94,0.2)] hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            {loading ? "Testando..." : "Testar Agora"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Badge Status ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "ATIVA" | "INATIVA" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "ATIVA"
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
          : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/25"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "ATIVA" ? "bg-emerald-400" : "bg-zinc-400")} />
      {status === "ATIVA" ? "Ativa" : "Inativa"}
    </span>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function AdminOrganizacoesPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [modal, setModal] = useState<ModalState>({ type: "none" })

  const { organizacoes, loading, error, refetch, createOrganizacao, updateOrganizacao, deleteOrganizacao, testarConexao } =
    useOrganizacoes()

  useEffect(() => {
    const user = getStoredUser()
    if (!user || user.role !== "ADMIN") {
      router.push("/login")
      return
    }
    setAuthUser(user)
  }, [router])

  function closeModal() {
    setModal({ type: "none" })
  }

  async function handleCreate(form: FormState) {
    try {
      await createOrganizacao(form as OrganizacaoPayload)
      toast.success("Organização criada com sucesso!")
      closeModal()
    } catch (err) {
      toast.error((err as Error).message)
      throw err
    }
  }

  async function handleEdit(org: Organizacao, form: FormState) {
    try {
      const payload: Partial<OrganizacaoPayload> = {
        nome: form.nome,
        descricao: form.descricao || undefined,
        status: form.status,
        db_user: form.db_user,
        db_connect_string: form.db_connect_string,
      }
      if (form.db_password) payload.db_password = form.db_password
      await updateOrganizacao(org.id, payload)
      toast.success("Organização atualizada com sucesso!")
      closeModal()
    } catch (err) {
      toast.error((err as Error).message)
      throw err
    }
  }

  async function handleDelete(org: Organizacao) {
    try {
      await deleteOrganizacao(org.id)
      toast.success("Organização removida com sucesso!")
      closeModal()
    } catch (err) {
      toast.error((err as Error).message)
      throw err
    }
  }

  async function handleTestarNoForm(form: FormState): Promise<TesteConexaoResult> {
    return testarConexao({
      db_user: form.db_user,
      db_password: form.db_password,
      db_connect_string: form.db_connect_string,
    })
  }

  async function handleTestarSalva(id: number): Promise<TesteConexaoResult> {
    return testarConexao({ db_user: "", db_password: "", db_connect_string: "" }).catch(() => ({
      sucesso: false,
      mensagem: "Erro ao testar.",
    }))
    // Este path usa o endpoint com id - recria a chamada corretamente
  }

  async function testarOrganizacaoSalva(id: number): Promise<TesteConexaoResult> {
    const res = await fetch("/api/organizacoes/testar-conexao", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": authUser?.role ?? "",
      },
      body: JSON.stringify({ id }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.error ?? "Erro ao testar")
    return json as TesteConexaoResult
  }

  function formatDate(raw: string) {
    if (!raw) return "—"
    const d = new Date(raw)
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  if (!authUser) return null

  return (
    <div className="min-h-screen bg-background text-foreground pb-mobile-tabbar">
      <AppShellNav user={authUser} />
      <MobileTabBar user={authUser} />

      <main className="mx-auto max-w-[1800px] px-4 py-8 lg:px-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Organizações</h1>
              <p className="text-sm text-muted-foreground">Gerencie as conexões Oracle dos clientes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModal({ type: "create" })}
            className="flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(34,197,94,0.2)] hover:brightness-110 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nova Organização
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Carregando organizações...</span>
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <XCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          </div>
        )}

        {/* Tabela */}
        {!loading && !error && (
          <>
            {organizacoes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">Nenhuma organização cadastrada.</p>
                <button
                  type="button"
                  onClick={() => setModal({ type: "create" })}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar primeira organização
                </button>
              </div>
            ) : (
              <>
              <div className="space-y-3 md:hidden">
                {organizacoes.map((org) => (
                  <div key={`${org.id}-card`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{org.nome}</p>
                        {org.descricao && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{org.descricao}</p>
                        )}
                      </div>
                      <StatusBadge status={org.status} />
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p className="truncate font-mono">Usuário Oracle: {org.db_user}</p>
                      <p className="truncate font-mono">Connect String: {org.db_connect_string}</p>
                      <p>Criado em: {formatDate(org.criado_em)}</p>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Testar Conexão"
                        onClick={() => setModal({ type: "test", org })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400"
                      >
                        <Wifi className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => setModal({ type: "edit", org })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:text-blue-400"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => setModal({ type: "delete", org })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="px-1 py-2 text-xs text-muted-foreground">
                  {organizacoes.length} {organizacoes.length === 1 ? "organização encontrada" : "organizações encontradas"}
                </div>
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Nome", "Status", "Usuário Oracle", "Connect String", "Criado em", "Ações"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {organizacoes.map((org) => (
                        <tr key={org.id} className="transition-colors hover:bg-muted/50 dark:hover:bg-white/[0.02]">
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-medium text-foreground">{org.nome}</p>
                              {org.descricao && (
                                <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{org.descricao}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={org.status} />
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-foreground/80">{org.db_user}</td>
                          <td className="px-4 py-3.5 font-mono text-xs text-foreground/80 max-w-[200px] truncate">
                            {org.db_connect_string}
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">{formatDate(org.criado_em)}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Testar Conexão"
                                onClick={() => setModal({ type: "test", org })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400"
                              >
                                <Wifi className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => setModal({ type: "edit", org })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:text-blue-400"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                onClick={() => setModal({ type: "delete", org })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  {organizacoes.length} {organizacoes.length === 1 ? "organização encontrada" : "organizações encontradas"}
                </div>
              </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Modais */}
      {modal.type === "create" && (
        <OrgFormModal
          title="Nova Organização"
          initial={emptyForm}
          onClose={closeModal}
          onSubmit={handleCreate}
          onTestar={handleTestarNoForm}
          isEdit={false}
        />
      )}

      {modal.type === "edit" && (
        <OrgFormModal
          title={`Editar: ${modal.org.nome}`}
          initial={formFromOrg(modal.org)}
          onClose={closeModal}
          onSubmit={(form) => handleEdit(modal.org, form)}
          onTestar={handleTestarNoForm}
          isEdit={true}
        />
      )}

      {modal.type === "delete" && (
        <DeleteModal
          org={modal.org}
          onClose={closeModal}
          onConfirm={() => handleDelete(modal.org)}
        />
      )}

      {modal.type === "test" && (
        <TestModal
          org={modal.org}
          onClose={closeModal}
          onTestar={testarOrganizacaoSalva}
        />
      )}
    </div>
  )
}
