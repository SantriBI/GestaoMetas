// Status de FATO_ORCAMENTO que nao representam sinal de funil (excluidos/fora do fluxo comercial).
export const ORCAMENTO_STATUS_IGNORAR = ["OEX", "EDC", "FOV", "FOO"]

// Um orcamento mais antigo que isso nao conta mais como sinal relevante para o kanban.
export const JANELA_ORCAMENTO_RELEVANTE_DIAS = 90

// Traducao legivel dos codigos de status de FATO_ORCAMENTO (mesma logica de VW_ORCAMENTOS_GESTAO_METAS,
// replicada aqui pois a view nao expõe sk_cliente/sk_vendedor e por isso nao pode ser reaproveitada
// diretamente pelas queries do kanban).
export const ORCAMENTO_STATUS_DESCRICAO = {
  ORC: "Sem acompanhamento",
  VEN: "Venda Fechada",
  REC: "Recebida",
  CNE: "Cliente nao encontrado",
  CNC: "Combinado novo contato",
  SRC: "Sem retorno de contato combinado",
  DVT: "Desistiu da venda temporariamente",
  DVD: "Desistiu da venda definitivamente",
  CCO: "Comprou no concorrente",
  OEX: "Excluido do ADM",
  ORE: "Rejeito pelo cadastro",
  FOV: "Fechado por outro vendedor",
  FOO: "Fechando em outro orcamento",
  FPR: "Falta de produto",
  EIM: "Entrega impossibilitada",
  EDC: "Exportacao de dados em contingencia",
  ENE: "Em Negociacao",
}

const rfvVendedorDisponivelCache = new Map()

/**
 * Nem todo tenant tem DM_VENDAS.FATO_RFV_VENDEDOR provisionada (mesma tabela ja usada, sem essa
 * checagem, por ativacaoClientesService.js). Verifica uma vez por empresa e cacheia, para que a
 * ausencia da tabela nesse tenant degrade a classificacao RFV do kanban (fica null) em vez de
 * quebrar o board e a busca de clientes inteiros.
 */
export async function isRfvVendedorDisponivel(dbQuery, empresaId) {
  const cacheKey = String(empresaId ?? "default")
  if (rfvVendedorDisponivelCache.has(cacheKey)) {
    return rfvVendedorDisponivelCache.get(cacheKey)
  }

  const rows = await dbQuery(
    `SELECT COUNT(*) AS TOTAL FROM USER_TABLES WHERE TABLE_NAME = 'FATO_RFV_VENDEDOR'`
  )
  const disponivel = Number(rows[0]?.TOTAL ?? rows[0]?.total ?? 0) > 0
  rfvVendedorDisponivelCache.set(cacheKey, disponivel)
  return disponivel
}

/**
 * CTE (sem o "WITH") com o orcamento mais recente de cada cliente do vendedor.
 * Junta por cadastro_id (chave real entre DIM_CLIENTE e FATO_ORCAMENTO) e por vendedor_id
 * (chave real entre FATO_ORCAMENTO e DIM_VENDEDOR), em vez do antigo casamento por nome normalizado.
 *
 * `aplicarJanela` (default true) restringe aos ultimos JANELA_ORCAMENTO_RELEVANTE_DIAS dias - correto
 * para a SINCRONIZACAO decidir se um orcamento ainda e um sinal fresco o suficiente para criar/mover
 * um card. Para EXIBIR o valor de um card ja existente, passe { aplicarJanela: false }: um card criado
 * a partir de um orcamento de 85 dias nao pode "perder" o valor exibido so porque, alguns dias depois,
 * esse mesmo orcamento passou a ter mais de 90 dias - o card continua no A_CONTATAR, so nao ha nada mais
 * recente para substitui-lo.
 */
export function buildOrcamentosClienteCTE({ aplicarJanela = true } = {}) {
  const statusIgnorar = ORCAMENTO_STATUS_IGNORAR.map((status) => `'${status}'`).join(", ")

  return `
    orcamentos_cliente AS (
      SELECT sk_cliente, sk_vendedor, status, valor_pedido, data_cadastro, orcamento_id
      FROM (
        SELECT
          cli.sk_cliente,
          ven.sk_vendedor,
          orc.status,
          orc.valor_pedido,
          orc.data_cadastro,
          orc.orcamento_id,
          ROW_NUMBER() OVER (PARTITION BY cli.sk_cliente ORDER BY orc.data_cadastro DESC) AS rn
        FROM fato_orcamento orc
        JOIN dim_cliente cli ON cli.cadastro_id = orc.cadastro_id
        JOIN dim_vendedor ven ON ven.vendedor_id = orc.vendedor_id
        WHERE ven.sk_vendedor = :sk_vendedor
          AND orc.status NOT IN (${statusIgnorar})
          ${aplicarJanela ? `AND orc.data_cadastro >= TRUNC(SYSDATE) - ${JANELA_ORCAMENTO_RELEVANTE_DIAS}` : ""}
      )
      WHERE rn = 1
    )
  `
}
