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
  sk_cliente: number | string | null
  nome_cliente: string | null
  telefone: string | null
  classificacao_rfv: string | null
  ultima_compra: string | number | null
  valor_potencial: number
  valor_orcamento: number | null
  data_orcamento: string | number | null
  origem: "rfv" | "orcamento"
  possui_telefone: boolean
  mensagem_final: string
  whatsapp_link: string | null
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
  clientes: ActivationClient[]
}

export interface ActivationCampaignResponse {
  persisted?: boolean
  campanha: {
    id: number | string | null
    segmento: string
    template_id?: number | string | null
    mensagem_base: string
    total_clientes: number
    total_com_telefone: number
    total_sem_telefone: number
    valor_potencial_carteira?: number
    clientes: ActivationClient[]
  }
}

export interface ActivationSendResponse {
  webhook_status: string
  campanha: {
    id: number | string | null
    segmento: string | null
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
      ultima_compra: string | number | null
      valor_orcamento: number | null
      data_orcamento: string | number | null
      mensagem_final: string
      whatsapp_link: string | null
    }>
  }
}

export interface ActivationScope {
  role: ActivationUserRole
  sk_vendedor?: number | string | null
  empresa_id?: number | string | null
}
