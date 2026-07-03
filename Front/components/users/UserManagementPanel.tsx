"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, KeyRound, Loader2, LogOut, Power, PowerOff, RefreshCw, Search, Users, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type ManagedUser = {
  id_usuario: number | string
  nome: string | null
  nome_completo?: string | null
  login: string
  role: string
  empresa_id: number | string | null
  organizacao_nome?: string | null
  cpf?: string | null
  ativo: "S" | "N"
  ultimo_login?: string | null
}

type OrganizationOption = {
  id_organizacao: number | string
  nome: string
  ativo?: "S" | "N"
}

type UserManagementPanelProps = {
  title?: string
  description?: string
  empresaId?: string | number | null
  organizations?: OrganizationOption[]
  allowOrganizationSelect?: boolean
  allowGlobalLogoff?: boolean
  className?: string
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/45"
const selectCls =
  `${inputCls} bg-slate-950/70 text-slate-100 [color-scheme:dark] [&>option]:bg-slate-950 [&>option]:text-slate-100`
const optionStyle = { backgroundColor: "#020617", color: "#f8fafc" }
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"

function apiUrl(path: string, empresaId?: string | number | null) {
  const params = new URLSearchParams()
  if (empresaId !== null && empresaId !== undefined && String(empresaId).trim()) {
    params.set("empresa_id", String(empresaId))
  }
  const query = params.toString()
  return `${path}${query ? `?${query}` : ""}`
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  })
  const json = await response.json().catch(() => null)
  if (!response.ok) throw new Error(json?.error ?? `Erro ${response.status}`)
  return json as T
}

function displayName(user: ManagedUser) {
  return String(user.nome_completo ?? user.nome ?? user.login ?? "Usuario").trim()
}

function onlyDigits(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeSearch(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function matchesUserSearch(user: ManagedUser, search: string) {
  const text = normalizeSearch(search)
  const digits = onlyDigits(search)
  if (!text && !digits) return true

  const name = normalizeSearch(`${user.nome ?? ""} ${user.nome_completo ?? ""}`)
  const cpf = onlyDigits(user.cpf ?? user.login)

  return (!!text && name.includes(text)) || (!!digits && cpf.includes(digits))
}

function formatCpf(value: string | number | null | undefined) {
  const digits = onlyDigits(value)
  if (digits.length !== 11) return String(value ?? "").trim()
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

function statusClass(ativo: "S" | "N") {
  return ativo === "S"
    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
    : "border-red-400/25 bg-red-500/10 text-red-200"
}

export function UserManagementPanel({
  title = "Gerenciar usuarios",
  description = "Controle acesso, senha e sessoes dos usuarios no seu escopo.",
  empresaId = null,
  organizations = [],
  allowOrganizationSelect = false,
  allowGlobalLogoff = true,
  className,
}: UserManagementPanelProps) {
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(empresaId ? String(empresaId) : "")
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const effectiveEmpresaId = allowOrganizationSelect ? selectedEmpresaId : empresaId
  const canGlobalLogoff = allowGlobalLogoff && !!effectiveEmpresaId
  const activeOrganizations = useMemo(
    () => organizations.filter((org) => !org.ativo || org.ativo === "S"),
    [organizations]
  )
  const filteredUsers = useMemo(
    () => users.filter((user) => matchesUserSearch(user, searchTerm)),
    [users, searchTerm]
  )

  async function loadUsers() {
    setLoading(true)
    try {
      const payload = await apiFetch<{ data: ManagedUser[] }>(
        apiUrl("/api/usuarios/gerenciamento", effectiveEmpresaId)
      )
      setUsers(payload.data ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar usuarios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [effectiveEmpresaId])

  async function runAction(key: string, action: () => Promise<void>) {
    setActionKey(key)
    try {
      await action()
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Acao nao concluida")
    } finally {
      setActionKey(null)
    }
  }

  async function changePassword(user: ManagedUser) {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Informe uma senha com pelo menos 6 caracteres.")
      return
    }

    await runAction(`senha-${user.id_usuario}`, async () => {
      await apiFetch(apiUrl(`/api/usuarios/gerenciamento/${user.id_usuario}/senha`, user.empresa_id), {
        method: "PATCH",
        body: JSON.stringify({ nova_senha: newPassword, empresa_id: user.empresa_id }),
      })
      toast.success("Senha alterada e sessoes antigas desconectadas.")
      setPasswordUserId(null)
      setNewPassword("")
    })
  }

  async function toggleStatus(user: ManagedUser) {
    const ativo = user.ativo === "S" ? "N" : "S"
    await runAction(`status-${user.id_usuario}`, async () => {
      await apiFetch(apiUrl(`/api/usuarios/gerenciamento/${user.id_usuario}/status`, user.empresa_id), {
        method: "PATCH",
        body: JSON.stringify({ ativo, empresa_id: user.empresa_id }),
      })
      toast.success(`Usuario ${ativo === "S" ? "ativado" : "inativado"}.`)
    })
  }

  async function logoutUser(user: ManagedUser) {
    await runAction(`logoff-${user.id_usuario}`, async () => {
      await apiFetch(apiUrl(`/api/usuarios/gerenciamento/${user.id_usuario}/logoff`, user.empresa_id), {
        method: "POST",
        body: JSON.stringify({ empresa_id: user.empresa_id }),
      })
      toast.success("Usuario desconectado.")
    })
  }

  async function logoutAll() {
    if (!canGlobalLogoff) {
      toast.error("Selecione uma organizacao para executar logoff geral.")
      return
    }

    if (!confirm("Desconectar todos os usuarios deste escopo?")) return

    await runAction("logoff-geral", async () => {
      const payload = await apiFetch<{ total?: number }>(
        apiUrl("/api/usuarios/gerenciamento/logoff-geral", effectiveEmpresaId),
        {
          method: "POST",
          body: JSON.stringify({ empresa_id: effectiveEmpresaId }),
        }
      )
      toast.success(`Logoff geral aplicado em ${payload.total ?? 0} usuario(s).`)
    })
  }

  return (
    <section className={cn("rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(10,15,28,0.88))] p-5", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1 sm:w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              className={cn(inputCls, "h-full pl-9 pr-9")}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar nome ou CPF"
              aria-label="Pesquisar usuario por nome ou CPF"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-200"
                aria-label="Limpar pesquisa"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {allowOrganizationSelect ? (
            <select
              className={cn(selectCls, "w-[260px]")}
              value={selectedEmpresaId}
              onChange={(event) => setSelectedEmpresaId(event.target.value)}
            >
              <option value="" style={optionStyle}>Todas as organizacoes</option>
              {activeOrganizations.map((org) => (
                <option key={org.id_organizacao} value={org.id_organizacao} style={optionStyle}>{org.nome}</option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className={cn(btnBase, "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
          {allowGlobalLogoff ? (
            <button
              type="button"
              onClick={logoutAll}
              disabled={!canGlobalLogoff || actionKey === "logoff-geral"}
              className={cn(btnBase, "border-amber-400/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/18")}
            >
              {actionKey === "logoff-geral" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Logoff geral
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-white/[0.03]">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Perfil</th>
                {allowOrganizationSelect ? <th className="px-4 py-3">Organizacao</th> : null}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {loading ? (
                <tr>
                  <td colSpan={allowOrganizationSelect ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                    Carregando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={allowOrganizationSelect ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={allowOrganizationSelect ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                    Nenhum usuario encontrado para a pesquisa.
                  </td>
                </tr>
              ) : filteredUsers.map((user) => {
                const editingPassword = passwordUserId === String(user.id_usuario)
                const cpf = formatCpf(user.cpf ?? user.login)
                return (
                  <tr key={`${user.empresa_id}-${user.id_usuario}`} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{displayName(user)}</p>
                      <p className="mt-1 text-xs text-slate-500">Login: {user.login}</p>
                      {cpf ? <p className="mt-1 text-xs text-slate-500">CPF: {cpf}</p> : null}
                      {editingPassword ? (
                        <div className="mt-3 flex gap-2">
                          <input
                            type="password"
                            className={cn(inputCls, "max-w-[220px]")}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Nova senha"
                          />
                          <button
                            type="button"
                            onClick={() => changePassword(user)}
                            disabled={actionKey === `senha-${user.id_usuario}`}
                            className={cn(btnBase, "border-emerald-400/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/18")}
                          >
                            {actionKey === `senha-${user.id_usuario}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Salvar
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{user.role}</td>
                    {allowOrganizationSelect ? <td className="px-4 py-3 text-slate-300">{user.organizacao_nome ?? user.empresa_id ?? "-"}</td> : null}
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-semibold", statusClass(user.ativo))}>
                        {user.ativo === "S" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordUserId(editingPassword ? null : String(user.id_usuario))
                            setNewPassword("")
                          }}
                          className={cn(btnBase, "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10")}
                        >
                          <KeyRound className="h-4 w-4" />
                          Senha
                        </button>
                        <button
                          type="button"
                          onClick={() => logoutUser(user)}
                          disabled={actionKey === `logoff-${user.id_usuario}`}
                          className={cn(btnBase, "border-amber-400/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/18")}
                        >
                          {actionKey === `logoff-${user.id_usuario}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                          Logoff
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(user)}
                          disabled={actionKey === `status-${user.id_usuario}`}
                          className={cn(
                            btnBase,
                            user.ativo === "S"
                              ? "border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/18"
                              : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/18"
                          )}
                        >
                          {actionKey === `status-${user.id_usuario}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.ativo === "S" ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                          {user.ativo === "S" ? "Inativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
