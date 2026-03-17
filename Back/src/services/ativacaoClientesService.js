import { query } from "../db/oracle.js"

const DEFAULT_TEMPLATES = [
  {
    id: "default-campeoes",
    nome_template: "Campeões | Reativação premium",
    tipo: "PADRAO",
    classificacao_rfv: "Campeões",
    mensagem:
      "Olá {nome_cliente}, tudo bem?\n\nVocê é um cliente muito importante para nós.\nGostaria de te mostrar algumas novidades que podem te interessar.",
    escopo: "SISTEMA",
    vendedor_id: null,
    empresa_id: null,
    origem: "default",
  },
  {
    id: "default-fieis",
    nome_template: "Clientes Fiéis | Mix complementar",
    tipo: "PADRAO",
    classificacao_rfv: "Clientes Fiéis",
    mensagem:
      "Olá {nome_cliente}, tudo bem?\n\nSeparei algumas oportunidades que combinam com o seu histórico de compras.\nSe quiser, posso te enviar uma sugestão rápida.",
    escopo: "SISTEMA",
    vendedor_id: null,
    empresa_id: null,
    origem: "default",
  },
  {
    id: "default-promissores",
    nome_template: "Promissores | Próximo passo",
    tipo: "PADRAO",
    classificacao_rfv: "Promissores",
    mensagem:
      "Olá {nome_cliente}, tudo bem?\n\nVi que existe potencial para avançarmos em novas compras.\nSe fizer sentido, posso te apresentar algumas opções alinhadas ao seu momento.",
    escopo: "SISTEMA",
    vendedor_id: null,
    empresa_id: null,
    origem: "default",
  },
  {
    id: "default-risco",
    nome_template: "Em Risco | Recuperação",
    tipo: "PADRAO",
    classificacao_rfv: "Em Risco",
    mensagem:
      "Olá {nome_cliente}, tudo bem?\n\nSentimos sua falta por aqui.\nTemos algumas condições especiais que podem te interessar.",
    escopo: "SISTEMA",
    vendedor_id: null,
    empresa_id: null,
    origem: "default",
  },
  {
    id: "default-hibernando",
    nome_template: "Hibernando | Reabertura",
    tipo: "PADRAO",
    classificacao_rfv: "Hibernando",
    mensagem:
      "Olá {nome_cliente}, tudo bem?\n\nJá faz um tempo desde a sua última compra.\nQuero te mostrar algumas oportunidades para retomarmos o contato comercial.",
    escopo: "SISTEMA",
    vendedor_id: null,
    empresa_id: null,
    origem: "default",
  },
  {
    id: "default-orcamentos",
    nome_template: "Orçamentos em aberto | Follow-up",
    tipo: "PADRAO",
    classificacao_rfv: "Orçamentos em aberto",
    mensagem:
      "Olá {nome_cliente}, tudo bem?\n\nEstou passando para saber se você conseguiu avaliar o orçamento que fizemos em {data_orcamento} no valor de {valor_orcamento}.\nSe precisar ajustar algo ou incluir novos itens, posso te ajudar.",
    escopo: "SISTEMA",
    vendedor_id: null,
    empresa_id: null,
    origem: "default",
  },
]

const SEGMENTS = [
  {
    id: "campeoes",
    titulo: "Campeões",
    descricao: "Clientes de maior valor e frequência. Ideal para campanhas premium e novidades.",
    classificacao: "Campeões",
    audienceType: "rfv",
  },
  {
    id: "clientes_fieis",
    titulo: "Clientes Fiéis",
    descricao: "Base recorrente para aumentar ticket e ampliar mix de compra.",
    classificacao: "Clientes Fiéis",
    audienceType: "rfv",
  },
  {
    id: "promissores",
    titulo: "Promissores",
    descricao: "Clientes com potencial claro de avanço comercial no curto prazo.",
    classificacao: "Promissores",
    audienceType: "rfv",
  },
  {
    id: "em_risco",
    titulo: "Em Risco",
    descricao: "Clientes que esfriaram e pedem ação rápida de recuperação.",
    classificacao: "Em Risco",
    audienceType: "rfv",
  },
  {
    id: "hibernando",
    titulo: "Hibernando",
    descricao: "Carteira adormecida que precisa de reabertura estruturada.",
    classificacao: "Hibernando",
    audienceType: "rfv",
  },
  {
    id: "orcamentos_abertos",
    titulo: "Orçamentos em aberto",
    descricao: "Clientes com orçamento nos últimos 30 dias e maior chance de conversão imediata.",
    classificacao: "Orçamentos em aberto",
    audienceType: "orcamento",
  },
]

function normalizarLinha(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function texto(value) {
  return value === null || value === undefined ? null : String(value).trim()
}

function telefoneLimpo(value) {
  return String(value ?? "").replace(/\D/g, "")
}

function telefoneValido(value) {
  const limpo = telefoneLimpo(value)
  return limpo.length >= 10 ? limpo : null
}

function formatarDataCurta(value) {
  if (!value) return "-"

  const textoData = String(value).trim()
  if (/^\d{8}$/.test(textoData)) {
    return `${textoData.slice(6, 8)}/${textoData.slice(4, 6)}/${textoData.slice(0, 4)}`
  }

  const data = new Date(textoData)
  if (Number.isNaN(data.getTime())) return textoData
  return data.toLocaleDateString("pt-BR")
}

function parseOracleDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  if (/^\d{8}$/.test(raw)) {
    const parsed = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function escapeWhatsAppMessage(value) {
  return encodeURIComponent(value).replace(/%20/g, "+")
}

function montarWaLink(telefone, mensagemFinal) {
  const limpo = telefoneValido(telefone)
  if (!limpo) return null
  return `https://wa.me/55${limpo}?text=${escapeWhatsAppMessage(mensagemFinal)}`
}

function hasPlaceholder(message, placeholder) {
  return String(message ?? "").includes(`{${placeholder}}`)
}

export function substituirVariaveisMensagem(message, cliente) {
  const mapa = {
    nome_cliente: texto(cliente.nome_cliente) || "cliente",
    valor_orcamento: cliente.valor_orcamento ? formatCurrencyPtBr(cliente.valor_orcamento) : "não informado",
    data_orcamento: cliente.data_orcamento ? formatarDataCurta(cliente.data_orcamento) : "não informada",
    ultima_compra: cliente.ultima_compra ? formatarDataCurta(cliente.ultima_compra) : "não informada",
  }

  return String(message ?? "").replace(/\{([a-z_]+)\}/gi, (_, key) => mapa[key] ?? "")
}

function formatCurrencyPtBr(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(numero(value))
}

function getSegmentConfig(segmento) {
  const item = SEGMENTS.find((segment) => segment.id === segmento)
  if (!item) {
    throw new Error("Segmento de ativação inválido.")
  }
  return item
}

function buildAccessScope({ role, sk_vendedor }) {
  const perfil = String(role ?? "").toUpperCase()

  if (perfil !== "VENDEDOR" && perfil !== "GERENTE") {
    throw new Error("Perfil inválido para ativação de clientes.")
  }

  if (perfil === "VENDEDOR" && !sk_vendedor) {
    throw new Error("SK_VENDEDOR é obrigatório para o perfil vendedor.")
  }

  return {
    role: perfil,
    skVendedor: sk_vendedor ?? null,
    isGerente: perfil === "GERENTE",
  }
}

async function tableExists(tableName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: String(tableName ?? "").toUpperCase() }
  )

  return numero(rows[0]?.TOTAL ?? rows[0]?.total) > 0
}

async function nextTableId(tableName) {
  const rows = await query(`SELECT NVL(MAX(id), 0) + 1 AS next_id FROM ${tableName}`)
  return numero(rows[0]?.NEXT_ID ?? rows[0]?.next_id)
}

function buildRfvSource(scope) {
  if (scope.isGerente) {
    return {
      from: "DM_VENDAS.FATO_RFV_CLIENTE rfv",
      where: "1 = 1",
      binds: {},
    }
  }

  return {
    from: "DM_VENDAS.FATO_RFV_VENDEDOR rfv",
    where: "rfv.sk_vendedor = :sk_vendedor",
    binds: { sk_vendedor: scope.skVendedor },
  }
}

function classificacaoPredicate(segmentConfig) {
  switch (segmentConfig.id) {
    case "campeoes":
      return "UPPER(TRIM(rfv.classificacao)) LIKE 'CAMPE%'"
    case "clientes_fieis":
      return "UPPER(TRIM(rfv.classificacao)) LIKE 'CLIENTES FI%'"
    case "promissores":
      return "UPPER(TRIM(rfv.classificacao)) LIKE 'PROMISS%'"
    case "em_risco":
      return "UPPER(TRIM(rfv.classificacao)) = 'EM RISCO'"
    case "hibernando":
      return "UPPER(TRIM(rfv.classificacao)) LIKE 'HIBERN%'"
    default:
      throw new Error("Segmento RFV inválido.")
  }
}

async function fetchClientesRfv(segmentConfig, scope) {
  const source = buildRfvSource(scope)

  const rows = await query(
    `
    SELECT
      rfv.sk_cliente,
      rfv.nome_cliente,
      rfv.telefone,
      rfv.classificacao,
      rfv.ultima_compra,
      rfv.valor AS valor_potencial,
      CAST(NULL AS NUMBER) AS valor_orcamento,
      CAST(NULL AS NUMBER) AS data_orcamento
    FROM ${source.from}
    WHERE ${source.where}
      AND ${classificacaoPredicate(segmentConfig)}
    ORDER BY NVL(rfv.valor, 0) DESC, rfv.nome_cliente
    `,
    source.binds
  )

  return rows.map((row) => {
    const item = normalizarLinha(row)
    return {
      sk_cliente: item.sk_cliente ?? null,
      nome_cliente: texto(item.nome_cliente),
      telefone: texto(item.telefone),
      classificacao_rfv: texto(item.classificacao) || segmentConfig.titulo,
      ultima_compra: item.ultima_compra ?? null,
      valor_potencial: numero(item.valor_potencial),
      valor_orcamento: null,
      data_orcamento: null,
      origem: "rfv",
    }
  })
}

async function fetchClientesOrcamento(scope) {
  const whereScope = scope.isGerente ? "1 = 1" : "orc.vendedor_id = :vendedor_id"
  const binds = scope.isGerente ? {} : { vendedor_id: scope.skVendedor }
  const rfvBaseSource = scope.isGerente
    ? "DM_VENDAS.FATO_RFV_CLIENTE"
    : "DM_VENDAS.FATO_RFV_VENDEDOR"
  const rfvBaseWhere = scope.isGerente ? "" : "WHERE sk_vendedor = :vendedor_id"

  const rows = await query(
    `
    WITH rfv_base AS (
      SELECT
        sk_cliente,
        nome_cliente,
        telefone,
        ultima_compra,
        classificacao,
        valor
      FROM ${rfvBaseSource}
      ${rfvBaseWhere}
    )
    SELECT
      rfv.sk_cliente,
      COALESCE(rfv.nome_cliente, orc.cliente) AS nome_cliente,
      COALESCE(rfv.telefone, orc.telefone) AS telefone,
      rfv.classificacao,
      rfv.ultima_compra,
      NVL(rfv.valor, 0) AS valor_potencial,
      NVL(orc.valor, 0) AS valor_orcamento,
      orc.data AS data_orcamento,
      CASE
        WHEN LENGTH(REGEXP_REPLACE(NVL(orc.telefone, ''), '[^0-9]', '')) >= 10 THEN 1
        ELSE 0
      END AS possui_telefone
    FROM vw_orcamentos_gestao_metas orc
    LEFT JOIN rfv_base rfv
      ON UPPER(TRIM(rfv.nome_cliente)) = UPPER(TRIM(orc.cliente))
    WHERE ${whereScope}
      AND TO_DATE(TRIM(orc.data), 'DD/MM/RR') >= TRUNC(SYSDATE) - 30
    ORDER BY TO_DATE(TRIM(orc.data), 'DD/MM/RR') DESC, orc.valor DESC
    `,
    binds
  )

  return rows.map((row) => {
    const item = normalizarLinha(row)
    return {
      sk_cliente: item.sk_cliente ?? null,
      nome_cliente: texto(item.nome_cliente),
      telefone: texto(item.telefone),
      classificacao_rfv: texto(item.classificacao) || "Orçamentos em aberto",
      ultima_compra: item.ultima_compra ?? null,
      valor_potencial: numero(item.valor_potencial),
      valor_orcamento: numero(item.valor_orcamento),
      data_orcamento: item.data_orcamento ?? null,
      possui_telefone: numero(item.possui_telefone) === 1,
      origem: "orcamento",
    }
  })
}

function decorateClientes(clientes, messageBase) {
  return clientes.map((cliente, index) => {
    const mensagemFinal = substituirVariaveisMensagem(messageBase, cliente)
    const telefone = telefoneValido(cliente.telefone)

    return {
      id: `${cliente.sk_cliente ?? "sem-sk"}-${index}`,
      ...cliente,
      telefone,
      possui_telefone: Boolean(telefone),
      mensagem_final: mensagemFinal,
      whatsapp_link: telefone ? montarWaLink(telefone, mensagemFinal) : null,
    }
  })
}

function summarizeClientes(clientes) {
  return clientes.reduce(
    (acc, cliente) => {
      acc.total_clientes += 1
      acc.valor_potencial_carteira += numero(cliente.valor_potencial) + numero(cliente.valor_orcamento)
      if (cliente.possui_telefone) {
        acc.total_com_telefone += 1
      } else {
        acc.total_sem_telefone += 1
      }
      return acc
    },
    {
      total_clientes: 0,
      total_com_telefone: 0,
      total_sem_telefone: 0,
      valor_potencial_carteira: 0,
    }
  )
}

function sortClientes(clientes, sortBy = "valor_potencial", sortDir = "desc") {
  const direction = sortDir === "asc" ? 1 : -1
  const getComparableValue = (cliente) => {
    switch (sortBy) {
      case "cliente":
        return String(cliente.nome_cliente ?? "")
      case "classificacao":
        return String(cliente.classificacao_rfv ?? "")
      case "ultima_compra":
        return String(cliente.ultima_compra ?? "")
      case "data_orcamento":
        return String(cliente.data_orcamento ?? "")
      case "valor_orcamento":
        return numero(cliente.valor_orcamento)
      case "valor_potencial":
      default:
        return numero(cliente.valor_potencial) + numero(cliente.valor_orcamento)
    }
  }

  return [...clientes].sort((a, b) => {
    const valueA = getComparableValue(a)
    const valueB = getComparableValue(b)

    if (typeof valueA === "number" && typeof valueB === "number") {
      return (valueA - valueB) * direction
    }

    return String(valueA).localeCompare(String(valueB), "pt-BR") * direction
  })
}

function filterClientes(clientes, search = "") {
  const termo = String(search ?? "").trim().toLowerCase()
  if (!termo) return clientes

  return clientes.filter((cliente) => {
    return (
      String(cliente.nome_cliente ?? "").toLowerCase().includes(termo) ||
      String(cliente.classificacao_rfv ?? "").toLowerCase().includes(termo) ||
      String(cliente.telefone ?? "").toLowerCase().includes(termo)
    )
  })
}

async function getClientesBySegment({
  segmento,
  role,
  sk_vendedor,
  messageBase,
  search,
  sortBy,
  sortDir,
}) {
  const scope = buildAccessScope({ role, sk_vendedor })
  const segmentConfig = getSegmentConfig(segmento)
  const templateBase = messageBase || getDefaultTemplateForSegment(segmentConfig.id).mensagem

  const baseClientes =
    segmentConfig.audienceType === "orcamento"
      ? await fetchClientesOrcamento(scope)
      : await fetchClientesRfv(segmentConfig, scope)

  const decorated = decorateClientes(baseClientes, templateBase)
  const filtrados = filterClientes(decorated, search)
  return sortClientes(filtrados, sortBy, sortDir)
}

function getDefaultTemplateForSegment(segmentId) {
  return (
    DEFAULT_TEMPLATES.find((item) => {
      if (segmentId === "campeoes") return item.classificacao_rfv === "Campeões"
      if (segmentId === "clientes_fieis") return item.classificacao_rfv === "Clientes Fiéis"
      if (segmentId === "promissores") return item.classificacao_rfv === "Promissores"
      if (segmentId === "em_risco") return item.classificacao_rfv === "Em Risco"
      if (segmentId === "hibernando") return item.classificacao_rfv === "Hibernando"
      if (segmentId === "orcamentos_abertos") return item.classificacao_rfv === "Orçamentos em aberto"
      return false
    }) ?? DEFAULT_TEMPLATES[0]
  )
}

export async function listarSegmentos() {
  return SEGMENTS.map((segment) => ({
    ...segment,
    template_padrao: getDefaultTemplateForSegment(segment.id).mensagem,
  }))
}

export async function obterResumoCampanha(params) {
  const clientes = await getClientesBySegment(params)
  return {
    segmento: params.segmento,
    ...summarizeClientes(clientes),
  }
}

export async function obterPreviewCampanha(params) {
  const clientes = await getClientesBySegment(params)

  return {
    segmento: params.segmento,
    resumo: summarizeClientes(clientes),
    clientes,
  }
}

export async function listarTemplates({ role, sk_vendedor, empresa_id }) {
  const templates = [...DEFAULT_TEMPLATES]

  if (!(await tableExists("TEMPLATES_MENSAGENS"))) {
    return templates
  }

  const rows = await query(
    `
    SELECT
      id,
      nome_template,
      tipo,
      classificacao_rfv,
      mensagem,
      escopo,
      vendedor_id,
      empresa_id,
      data_criacao
    FROM templates_mensagens
    WHERE escopo = 'SISTEMA'
       OR (:empresa_id IS NOT NULL AND empresa_id = :empresa_id)
       OR (:role = 'VENDEDOR' AND vendedor_id = :sk_vendedor)
    ORDER BY data_criacao DESC, nome_template
    `,
    {
      role: String(role ?? "").toUpperCase(),
      sk_vendedor: sk_vendedor ?? null,
      empresa_id: empresa_id ?? null,
    }
  )

  return [
    ...templates,
    ...rows.map((row) => {
      const item = normalizarLinha(row)
      return {
        id: numero(item.id),
        nome_template: texto(item.nome_template),
        tipo: texto(item.tipo),
        classificacao_rfv: texto(item.classificacao_rfv),
        mensagem: texto(item.mensagem),
        escopo: texto(item.escopo),
        vendedor_id: item.vendedor_id ?? null,
        empresa_id: item.empresa_id ?? null,
        data_criacao: item.data_criacao ?? null,
        origem: "banco",
      }
    }),
  ]
}

export async function criarTemplate(payload) {
  if (!(await tableExists("TEMPLATES_MENSAGENS"))) {
    return {
      persisted: false,
      message: "Tabela TEMPLATES_MENSAGENS ainda não existe. Estrutura pronta para ativação.",
      template: { id: null, ...payload },
    }
  }

  const id = await nextTableId("TEMPLATES_MENSAGENS")

  await query(
    `
    INSERT INTO templates_mensagens (
      id,
      nome_template,
      tipo,
      classificacao_rfv,
      mensagem,
      escopo,
      vendedor_id,
      empresa_id,
      data_criacao
    ) VALUES (
      :id,
      :nome_template,
      :tipo,
      :classificacao_rfv,
      :mensagem,
      :escopo,
      :vendedor_id,
      :empresa_id,
      SYSDATE
    )
    `,
    {
      id,
      nome_template: payload.nome_template,
      tipo: payload.tipo ?? "PERSONALIZADO",
      classificacao_rfv: payload.classificacao_rfv ?? null,
      mensagem: payload.mensagem,
      escopo: payload.escopo ?? "USUARIO",
      vendedor_id: payload.vendedor_id ?? null,
      empresa_id: payload.empresa_id ?? null,
    }
  )

  return { persisted: true, template: { id, ...payload } }
}

export async function atualizarTemplate(id, payload) {
  if (!(await tableExists("TEMPLATES_MENSAGENS"))) {
    return {
      persisted: false,
      message: "Tabela TEMPLATES_MENSAGENS ainda não existe. Estrutura pronta para ativação.",
      template: { id, ...payload },
    }
  }

  await query(
    `
    UPDATE templates_mensagens
    SET nome_template = :nome_template,
        tipo = :tipo,
        classificacao_rfv = :classificacao_rfv,
        mensagem = :mensagem,
        escopo = :escopo,
        vendedor_id = :vendedor_id,
        empresa_id = :empresa_id
    WHERE id = :id
    `,
    {
      id,
      nome_template: payload.nome_template,
      tipo: payload.tipo ?? "PERSONALIZADO",
      classificacao_rfv: payload.classificacao_rfv ?? null,
      mensagem: payload.mensagem,
      escopo: payload.escopo ?? "USUARIO",
      vendedor_id: payload.vendedor_id ?? null,
      empresa_id: payload.empresa_id ?? null,
    }
  )

  return { persisted: true, template: { id, ...payload } }
}

export async function criarCampanha(payload) {
  const clientes =
    payload.clientes?.length
      ? decorateClientes(payload.clientes, payload.mensagem_base)
      : await getClientesBySegment({
          segmento: payload.segmento,
          role: payload.role,
          sk_vendedor: payload.sk_vendedor,
          messageBase: payload.mensagem_base,
        })

  const resumo = summarizeClientes(clientes)

  if (
    !(await tableExists("CAMPANHAS_ATIVACAO")) ||
    !(await tableExists("CAMPANHAS_ATIVACAO_CLIENTES"))
  ) {
    return {
      persisted: false,
      campanha: {
        id: null,
        segmento: payload.segmento,
        template_id: payload.template_id ?? null,
        mensagem_base: payload.mensagem_base,
        ...resumo,
        clientes,
      },
    }
  }

  const campanhaId = await nextTableId("CAMPANHAS_ATIVACAO")

  await query(
    `
    INSERT INTO campanhas_ativacao (
      id,
      segmento,
      template_id,
      mensagem_base,
      total_clientes,
      total_com_telefone,
      total_sem_telefone,
      vendedor_id,
      empresa_id,
      data_criacao
    ) VALUES (
      :id,
      :segmento,
      :template_id,
      :mensagem_base,
      :total_clientes,
      :total_com_telefone,
      :total_sem_telefone,
      :vendedor_id,
      :empresa_id,
      SYSDATE
    )
    `,
    {
      id: campanhaId,
      segmento: payload.segmento,
      template_id: payload.template_id ?? null,
      mensagem_base: payload.mensagem_base,
      total_clientes: resumo.total_clientes,
      total_com_telefone: resumo.total_com_telefone,
      total_sem_telefone: resumo.total_sem_telefone,
      vendedor_id: payload.sk_vendedor ?? null,
      empresa_id: payload.empresa_id ?? null,
    }
  )

  for (const [index, cliente] of clientes.entries()) {
    await query(
      `
      INSERT INTO campanhas_ativacao_clientes (
        id,
        campanha_id,
        sk_cliente,
        nome_cliente,
        telefone,
        classificacao_rfv,
        ultima_compra,
        valor_orcamento,
        data_orcamento,
        mensagem_final,
        status_envio
      ) VALUES (
        :id,
        :campanha_id,
        :sk_cliente,
        :nome_cliente,
        :telefone,
        :classificacao_rfv,
        :ultima_compra,
        :valor_orcamento,
        :data_orcamento,
        :mensagem_final,
        :status_envio
      )
      `,
      {
        id: campanhaId * 100000 + index + 1,
        campanha_id: campanhaId,
        sk_cliente: cliente.sk_cliente ?? null,
        nome_cliente: cliente.nome_cliente,
        telefone: cliente.telefone,
        classificacao_rfv: cliente.classificacao_rfv,
        ultima_compra: parseOracleDate(cliente.ultima_compra),
        valor_orcamento: cliente.valor_orcamento ?? null,
        data_orcamento: parseOracleDate(cliente.data_orcamento),
        mensagem_final: cliente.mensagem_final,
        status_envio: "PENDENTE",
      }
    )
  }

  return {
    persisted: true,
    campanha: {
      id: campanhaId,
      segmento: payload.segmento,
      template_id: payload.template_id ?? null,
      mensagem_base: payload.mensagem_base,
      ...resumo,
      clientes,
    },
  }
}

export async function enviarCampanha(campanhaId, payload = {}) {
  let clientes = []
  let campanha = { id: campanhaId, segmento: payload.segmento ?? null }

  if (await tableExists("CAMPANHAS_ATIVACAO_CLIENTES")) {
    const rows = await query(
      `
      SELECT
        campanha_id,
        sk_cliente,
        nome_cliente,
        telefone,
        classificacao_rfv,
        ultima_compra,
        valor_orcamento,
        data_orcamento,
        mensagem_final
      FROM campanhas_ativacao_clientes
      WHERE campanha_id = :campanha_id
      ORDER BY id
      `,
      { campanha_id: campanhaId }
    )

    clientes = rows.map((row, index) => {
      const item = normalizarLinha(row)
      return {
        id: `${item.campanha_id}-${index}`,
        sk_cliente: item.sk_cliente ?? null,
        nome_cliente: texto(item.nome_cliente),
        telefone: telefoneValido(item.telefone),
        classificacao_rfv: texto(item.classificacao_rfv),
        ultima_compra: item.ultima_compra ?? null,
        valor_orcamento: item.valor_orcamento ?? null,
        data_orcamento: item.data_orcamento ?? null,
        mensagem_final: texto(item.mensagem_final) ?? "",
        whatsapp_link: item.telefone ? montarWaLink(item.telefone, item.mensagem_final ?? "") : null,
      }
    })
  } else if (payload.clientes?.length) {
    clientes = decorateClientes(payload.clientes, payload.mensagem_base)
  }

  const webhookPayload = {
    campanha_id: campanhaId,
    segmento: payload.segmento ?? campanha.segmento,
    vendedor_id: payload.sk_vendedor ?? null,
    mensagem_base: payload.mensagem_base ?? null,
    clientes: clientes.map((cliente) => ({
      nome_cliente: cliente.nome_cliente,
      telefone: cliente.telefone,
      ultima_compra: cliente.ultima_compra ?? null,
      valor_orcamento: cliente.valor_orcamento ?? null,
      data_orcamento: cliente.data_orcamento ?? null,
      mensagem_final: cliente.mensagem_final,
      whatsapp_link: cliente.whatsapp_link,
    })),
  }

  let webhookStatus = "nao_configurado"

  if (process.env.N8N_ATIVACAO_WEBHOOK) {
    try {
      const response = await fetch(process.env.N8N_ATIVACAO_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      })
      webhookStatus = response.ok ? "enviado" : "falhou"
    } catch {
      webhookStatus = "falhou"
    }
  }

  if (await tableExists("CAMPANHAS_ATIVACAO_CLIENTES")) {
    const status = webhookStatus === "enviado" ? "ENVIADO_WEBHOOK" : "LINK_GERADO"
    await query(
      `
      UPDATE campanhas_ativacao_clientes
      SET status_envio = :status_envio
      WHERE campanha_id = :campanha_id
      `,
      {
        status_envio: status,
        campanha_id: campanhaId,
      }
    )
  }

  return {
    campanha,
    webhook_status: webhookStatus,
    clientes,
    payload_n8n: webhookPayload,
  }
}
