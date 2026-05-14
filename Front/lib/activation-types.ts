export type ActivationUserRole = "VENDEDOR" | "GERENTE"

export interface ActivationSegment {
  id: string
  titulo: string
  descricao: string
  classificacao: string
  audienceType: "rfv" | "orcamento"
  template_padrao: string
}

export interface MessageTemplate {
  id: number | string | null
  nome_template: string | null
  tipo: string | null
  classificacao_rfv: string | null
  mensagem: string | null
  escopo: string | null
  vendedor_id?: number | string | null
  empresa_id?: number | string | null
  origem?: "default" | "banco"
}

export interface ActivationSummary {
  segmento: string
  total_clientes: number
  total_com_telefone: number
  total_sem_telefone: number
  valor_potencial_carteira: number
}

export interface ActivationClient {
  id: string
  campanha_cliente_id?: number | string | null
  sk_cliente: number | string | null
  nome_cliente: string | null
  telefone: string | null
  classificacao_rfv: string | null
  ultima_compra: string | number | null
  total_compras: number | null
  valor_potencial: number
  valor_orcamento: number | null
  data_orcamento: string | number | null
  origem: "rfv" | "orcamento"
  possui_telefone: boolean
  mensagem_final: string
  whatsapp_link: string | null
  link_token?: string | null
  link_url?: string | null
  status_envio?: string | null
  message_id?: string | null
  total_cliques?: number
  converteu?: boolean
  valor_conversao?: number | null
  erro_envio?: string | null
  ultimo_evento_em?: string | Date | null
  ultimo_evento_tipo?: string | null
}

export interface ActivationPreviewResponse {
  segmento: string
  resumo: ActivationSummary
  clientes: ActivationClient[]
}

export interface ActivationCampaignPayload {
  segmento: string
  template_id?: number | string | null
  mensagem_base: string
  role: ActivationUserRole
  sk_vendedor?: number | string | null
  empresa_id?: number | string | null
  id_usuario?: number | string | null
  nome_usuario?: string | null
  clientes: ActivationClient[]
}

export interface ActivationCampaignResponse {
  persisted?: boolean
  downloaded?: boolean
  file_name?: string | null
  campanha: {
    id: number | string | null
    segmento: string
    template_id?: number | string | null
    mensagem_base: string
    data_confirmacao?: string | Date | null
    id_usuario_confirmacao?: number | string | null
    nome_usuario_confirmacao?: string | null
    warning?: string | null
    total_clientes: number
    total_com_telefone: number
    total_sem_telefone: number
    valor_potencial_carteira?: number
    clientes: ActivationClient[]
  }
}

export interface ActivationCampaignDashboardClient {
  id: string
  sk_cliente: number | string | null
  nome_cliente: string | null
  telefone: string | null
  status_envio: string
  message_id: string | null
  data_envio_zapi: string | Date | null
  erro_envio: string | null
  link_token: string | null
  link_url: string | null
  total_cliques: number
  converteu: boolean
  valor_conversao: number | null
  ultimo_evento_tipo: string | null
  ultimo_evento_em: string | Date | null
}

export interface ActivationCampaignDashboard {
  campanha: {
    id: number | string | null
    segmento: string | null
    template_id: number | string | null
    mensagem_base: string | null
    vendedor_id: number | string | null
    empresa_id: number | string | null
    data_confirmacao: string | Date | null
    nome_usuario_confirmacao: string | null
    data_criacao: string | Date | null
    total_clientes: number
    pendentes: number
    falhas: number
    warning: string | null
  }
  kpis: {
    enviados: number
    entregues: number
    lidos: number
    responderam: number
    abriram_link: number
    iniciaram_negociacao: number
    solicitaram_orcamento: number
    converteram: number
    receita_gerada: number
    pendentes: number
    falhas: number
    total_cliques: number
  }
  funil: Array<{
    id: string
    label: string
    value: number
  }>
  clientes: ActivationCampaignDashboardClient[]
}

export interface ActivationSendResponse {
  webhook_status: string
  warning?: string | null
  envio_status?: string
  job?: {
    campanha_id: number | string
    status: string
    started_at: string
    finished_at: string | null
    processed: number
    total: number
    success: number
    failed: number
    skipped: number
    batch_size: number
    batch_pause_ms: number
    delay_range_ms: number[]
    error: string | null
  }
  dashboard?: ActivationCampaignDashboard
  campanha: {
    id: number | string | null
    segmento: string | null
    data_confirmacao?: string | Date | null
    id_usuario_confirmacao?: number | string | null
    nome_usuario_confirmacao?: string | null
  }
  clientes: ActivationClient[]
  payload_n8n: {
    campanha_id: number | string
    segmento: string | null
    vendedor_id: number | string | null
    mensagem_base: string | null
    clientes: Array<{
      nome_cliente: string | null
      telefone: string | null
      classificacao_rfv?: string | null
      mensagem_final: string
      whatsapp_link: string | null
      link_token?: string | null
      link_url?: string | null
      message_id?: string | null
    }>
  }
}

export interface ActivationScope {
  role: ActivationUserRole
  sk_vendedor?: number | string | null
  empresa_id?: number | string | null
  id_usuario?: number | string | null
  nome_usuario?: string | null
}

export interface ActivationNegotiationCenter {
  token: string
  campanha_id: number | string | null
  campanha_cliente_id: number | string | null
  cliente_id: number | string | null
  cliente: {
    nome: string
    telefone: string | null
    classificacao_rfv: string | null
    mensagem_personalizada: string
  }
  vendedor: {
    id: number | string | null
    nome: string
    foto_url: string | null
    whatsapp: string | null
    whatsapp_link: string | null
  }
  campanha: {
    segmento: string | null
    data_confirmacao: string | Date | null
    status_envio: string
  }
  link: {
    total_cliques: number
    primeiro_clique: string | Date | null
    ultimo_clique: string | Date | null
    converteu: boolean
    valor_conversao: number | null
    url: string
  }
  cards: Array<{
    id: string
    badge: string
    title: string
    description: string
    tone: string
    eyebrow: string
  }>
}
