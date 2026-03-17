import {
  ActivationCampaignPayload,
  ActivationCampaignResponse,
  ActivationPreviewResponse,
  ActivationScope,
  ActivationSegment,
  ActivationSendResponse,
  ActivationSummary,
  MessageTemplate,
} from "@/lib/activation-types"

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value))
    }
  })

  return search.toString()
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(payload?.error ?? `Falha na requisição ${response.status}`))
  }

  return payload as T
}

export async function getActivationSegments() {
  const payload = await fetchJson<{ data: ActivationSegment[] }>("/api/ativacao-clientes/segmentos")
  return payload.data
}

export async function getMessageTemplates(scope: ActivationScope) {
  const query = buildQuery({
    role: scope.role,
    sk_vendedor: scope.sk_vendedor ?? null,
    empresa_id: scope.empresa_id ?? null,
  })
  const payload = await fetchJson<{ data: MessageTemplate[] }>(`/api/templates-mensagens?${query}`)
  return payload.data
}

export async function getActivationSummary(
  segmento: string,
  scope: ActivationScope,
  mensagemBase?: string | null
) {
  const query = buildQuery({
    segmento,
    ...scope,
    mensagem_base: mensagemBase ?? undefined,
  })

  const payload = await fetchJson<{ data: ActivationSummary }>(`/api/ativacao-clientes/resumo?${query}`)
  return payload.data
}

export async function getActivationPreview(
  segmento: string,
  scope: ActivationScope,
  options?: {
    mensagemBase?: string | null
    search?: string
    sortBy?: string
    sortDir?: "asc" | "desc"
  }
) {
  const query = buildQuery({
    segmento,
    ...scope,
    mensagem_base: options?.mensagemBase ?? undefined,
    search: options?.search ?? undefined,
    sort_by: options?.sortBy ?? undefined,
    sort_dir: options?.sortDir ?? undefined,
  })

  const payload = await fetchJson<{ data: ActivationPreviewResponse }>(`/api/ativacao-clientes/preview?${query}`)
  return payload.data
}

export async function createActivationCampaign(payload: ActivationCampaignPayload) {
  return fetchJson<ActivationCampaignResponse>("/api/ativacao-clientes/campanhas", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function sendActivationCampaign(
  campanhaId: number | string,
  payload: Partial<ActivationCampaignPayload>
) {
  return fetchJson<ActivationSendResponse>(`/api/ativacao-clientes/campanhas/${campanhaId}/enviar`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function formatActivationDate(value?: string | number | Date | null) {
  if (!value) return "-"

  if (typeof value === "number") {
    const raw = String(value)
    if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR")
}

export function formatActivationCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

export function replaceActivationVariables(
  message: string,
  client: {
    nome_cliente?: string | null
    valor_orcamento?: number | null
    data_orcamento?: string | number | null
    ultima_compra?: string | number | null
  }
) {
  const variables: Record<string, string> = {
    nome_cliente: client.nome_cliente || "cliente",
    valor_orcamento:
      client.valor_orcamento !== null && client.valor_orcamento !== undefined
        ? formatActivationCurrency(client.valor_orcamento)
        : "não informado",
    data_orcamento: formatActivationDate(client.data_orcamento),
    ultima_compra: formatActivationDate(client.ultima_compra),
  }

  return String(message ?? "").replace(/\{([a-z_]+)\}/gi, (_, key) => variables[key] ?? "")
}
