"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getStoredUser } from "@/lib/user-session"

export interface Organizacao {
  id: number
  nome: string
  descricao: string | null
  status: "ATIVA" | "INATIVA"
  db_user: string
  db_connect_string: string
  criado_em: string
  atualizado_em: string
}

export interface OrganizacaoPayload {
  nome: string
  descricao?: string
  status: "ATIVA" | "INATIVA"
  db_user: string
  db_password: string
  db_connect_string: string
}

export interface TesteConexaoResult {
  sucesso: boolean
  mensagem: string
  detalhe?: string
}

function adminHeaders(): HeadersInit {
  const user = getStoredUser()
  return {
    "Content-Type": "application/json",
    "x-user-role": user?.role ?? "",
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...adminHeaders(), ...(options?.headers ?? {}) } })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(json?.error ?? `Erro ${res.status}`)
  }
  return json as T
}

export function useOrganizacoes() {
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchOrganizacoes = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Organizacao[]>("/api/organizacoes", { signal: abortRef.current.signal })
      setOrganizacoes(data)
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOrganizacoes()
    return () => { abortRef.current?.abort() }
  }, [fetchOrganizacoes])

  async function createOrganizacao(payload: OrganizacaoPayload): Promise<Organizacao> {
    const data = await apiFetch<Organizacao>("/api/organizacoes", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    await fetchOrganizacoes()
    return data
  }

  async function updateOrganizacao(id: number, payload: Partial<OrganizacaoPayload>): Promise<Organizacao> {
    const data = await apiFetch<Organizacao>(`/api/organizacoes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
    await fetchOrganizacoes()
    return data
  }

  async function deleteOrganizacao(id: number): Promise<void> {
    await apiFetch(`/api/organizacoes/${id}`, { method: "DELETE" })
    await fetchOrganizacoes()
  }

  async function testarConexao(params: {
    db_user: string
    db_password: string
    db_connect_string: string
  }): Promise<TesteConexaoResult> {
    return apiFetch<TesteConexaoResult>("/api/organizacoes/testar-conexao", {
      method: "POST",
      body: JSON.stringify(params),
    })
  }

  return {
    organizacoes,
    loading,
    error,
    refetch: fetchOrganizacoes,
    createOrganizacao,
    updateOrganizacao,
    deleteOrganizacao,
    testarConexao,
  }
}
