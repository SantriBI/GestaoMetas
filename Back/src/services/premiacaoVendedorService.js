import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { buildLojaInCondition } from "./lojaScopeService.js"
import { getAllowedSellerCodesByEmpresaId, isSellerAllowed } from "./tenantSellerScope.js"

const MES_REFERENCIA_REGEX = /^\d{2}\/\d{4}$/

export class PremiacaoVendedorError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = "PremiacaoVendedorError"
    this.statusCode = statusCode
  }
}

// Gatilho minimo de margem+frete para ser elegivel a premiacao (regra do negocio, ver
// VW_PREMIACAO_VENDEDOR_COMISSAO_ERP / VW_APURACAO_PREMIACAO_VENDEDOR - STATUS_GATILHO).
const GATILHO_MINIMO_MARGEM = 20000

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

// Extrai o limite superior de uma faixa no formato "20.000,01 até 30.000,00" (retorna 30000).
// Se a faixa nao tiver um limite superior explicito (ultima faixa da escada), retorna null.
function extrairLimiteSuperiorFaixa(faixaAcelerador) {
  const texto = String(faixaAcelerador ?? "")
  const match = /ate\s+([\d.]+,\d{2})\s*$/i.exec(texto.normalize("NFD").replace(/[̀-ͯ]/g, ""))
  if (!match) return null
  const numero = Number(match[1].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(numero) ? numero : null
}

function normalizeSkVendedor(skVendedor) {
  const parsed = Number(skVendedor)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PremiacaoVendedorError("Usuario nao vinculado a um vendedor.", 400)
  }
  return parsed
}

// Espelha o mesmo mapeamento de linha para buscarMinhaPremiacao (individual) e
// listarPremiacaoEquipe (visao do gerente, mes atual e historico) - a formula/regra de
// elegibilidade precisa ser identica nas tres origens de dados.
//
// margem_mais_frete: no mes atual vem direto da view (VW_PREMIACAO_VENDEDOR_COMISSAO_ERP); no
// historico vem de um LEFT JOIN com VW_APURACAO_PREMIACAO_VENDEDOR (ver
// buscarLinhasBrutasHistorico) - por ser LEFT JOIN, pode vir null no raro caso de nao achar
// par pro vendedor/mes. hasOwnProperty (via normalizeRow) distingue "coluna nao veio nesta
// query" (null, sem inventar 0) de "veio 0 do Oracle"; quando a coluna existe mas o valor e
// null (join sem match), cai no `?? 0` abaixo.
function mapPremiacaoRow(row) {
  const temMargemMaisFrete = Object.prototype.hasOwnProperty.call(row, "margem_mais_frete")
  const margemMaisFrete = temMargemMaisFrete ? Number(row.margem_mais_frete ?? 0) : null
  const elegivel = String(row.status_gatilho ?? "").toUpperCase() !== "NÃO ELEGÍVEL"
  const limiteSuperiorFaixa = extrairLimiteSuperiorFaixa(row.faixa_acelerador)

  return {
    skVendedor: row.sk_vendedor != null ? Number(row.sk_vendedor) : null,
    vendedorId: row.vendedor_id,
    nomeVendedor: row.nome_vendedor,
    mesReferencia: row.mes_referencia,
    // Comissao base do ERP so e exibida quando o vendedor bate o gatilho minimo de margem
    // (STATUS_GATILHO = ELEGIVEL) - abaixo disso o valor exibido e zerado, mesmo que o ERP
    // tenha calculado uma comissao (pedido do usuario: nao faz sentido mostrar comissao base
    // pra quem nao vai receber premiacao por nao ter batido a margem minima).
    valorComissaoBase: elegivel ? Number(row.valor_comissao_a_pagar ?? 0) : 0,
    margemMaisFrete,
    statusGatilho: row.status_gatilho,
    elegivel,
    faixaAcelerador: row.faixa_acelerador,
    percAcelerador: Number(row.perc_acelerador ?? 0),
    bonusFixoAdicional: Number(row.bonus_fixo_adicional ?? 0),
    valorPremiacaoFinal: Number(row.valor_premiacao_final ?? 0),
    gatilhoMinimoMargem: GATILHO_MINIMO_MARGEM,
    faltanteGatilho:
      elegivel || margemMaisFrete == null ? 0 : Math.max(0, GATILHO_MINIMO_MARGEM - margemMaisFrete),
    faltanteProximaFaixa:
      limiteSuperiorFaixa != null && margemMaisFrete != null
        ? Math.max(0, limiteSuperiorFaixa - margemMaisFrete)
        : null,
  }
}

/**
 * Regra de negocio unica da tela de equipe, aplicada da MESMA forma independente da origem
 * dos dados (mes atual, via VW_PREMIACAO_VENDEDOR_COMISSAO_ERP, ou mes fechado, via
 * FT_COMISSAO_HISTORICO): filtra pra dentro so vendedores com conta ativa no tenant
 * (usuarios_auth ativo='S' AND role='VENDEDOR' - mesmo filtro que o ranking usa). O zerar de
 * valorComissaoBase pra quem nao e elegivel ja acontece dentro de mapPremiacaoRow, que
 * tambem e compartilhado pelas duas origens - entao as DUAS regras da feature (conta ativa +
 * zerar se nao elegivel) passam pelo mesmo codigo nos dois caminhos, nunca duplicadas.
 */
function aplicarRegrasNegocioEquipe(vendedoresMapeados, allowedSellerCodes) {
  return vendedoresMapeados.filter((vendedor) => isSellerAllowed(allowedSellerCodes, vendedor.skVendedor))
}

// Vendedores nao elegiveis a menos deste valor do gatilho minimo de margem+frete sao
// destacados na tela do gerente como "proximos de bater o gatilho".
const LIMIAR_PROXIMO_DO_GATILHO = 5000

/**
 * Busca a premiacao do mes corrente do vendedor logado, lendo direto de
 * VW_PREMIACAO_VENDEDOR_COMISSAO_ERP (Fase 3 do motor de premiacao - comissao pronta do ERP x
 * acelerador de margem+frete). Nao aceita mes/periodo como parametro: a view sempre reflete o
 * mes em andamento.
 */
export async function buscarMinhaPremiacao(empresaId, skVendedor, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new PremiacaoVendedorError("empresa_id e obrigatorio.", 400)
  const skVendedorNum = normalizeSkVendedor(skVendedor)

  const rows = await query(
    empresaId,
    `
    SELECT
      SK_VENDEDOR,
      VENDEDOR_ID,
      NOME_VENDEDOR,
      MES_REFERENCIA,
      VALOR_COMISSAO_A_PAGAR,
      MARGEM_MAIS_FRETE,
      STATUS_GATILHO,
      FAIXA_ACELERADOR,
      PERC_ACELERADOR,
      BONUS_FIXO_ADICIONAL,
      VALOR_PREMIACAO_FINAL
    FROM VW_PREMIACAO_VENDEDOR_COMISSAO_ERP
    WHERE SK_VENDEDOR = :skVendedor
    FETCH FIRST 1 ROW ONLY
    `,
    { skVendedor: skVendedorNum }
  )

  if (!rows[0]) return null

  return mapPremiacaoRow(normalizeRow(rows[0]))
}

function validarMesReferencia(mes) {
  if (!MES_REFERENCIA_REGEX.test(mes)) {
    throw new PremiacaoVendedorError("mes deve estar no formato MM/YYYY.", 400)
  }
  return mes
}

async function buscarLinhasBrutasMesAtual(empresaId, lojaScope, query) {
  const lojaCondition = buildLojaInCondition("SK_EMPRESAS", lojaScope, "loja_scope_premiacao_equipe")

  return query(
    empresaId,
    `
    SELECT
      SK_VENDEDOR,
      VENDEDOR_ID,
      NOME_VENDEDOR,
      MES_REFERENCIA,
      VALOR_COMISSAO_A_PAGAR,
      MARGEM_MAIS_FRETE,
      STATUS_GATILHO,
      FAIXA_ACELERADOR,
      PERC_ACELERADOR,
      BONUS_FIXO_ADICIONAL,
      VALOR_PREMIACAO_FINAL
    FROM VW_PREMIACAO_VENDEDOR_COMISSAO_ERP
    WHERE ${lojaCondition.clause}
    ORDER BY
      CASE WHEN STATUS_GATILHO = 'NÃO ELEGÍVEL' THEN 1 ELSE 0 END,
      VALOR_PREMIACAO_FINAL DESC,
      MARGEM_MAIS_FRETE DESC
    `,
    lojaCondition.binds
  )
}

// FT_COMISSAO_HISTORICO e o fechamento mensal (upsert diario ate fechar, depois congelado) -
// nao guarda MARGEM_MAIS_FRETE (so o resultado ja derivado dela: STATUS_GATILHO,
// FAIXA_ACELERADOR, PERC_ACELERADOR, BONUS_FIXO_ADICIONAL, VALOR_PREMIACAO_FINAL - esses
// continuam vindo de H, o fechamento oficial/congelado, nunca recalculados). A margem+frete
// crua pra exibicao vem de VW_APURACAO_PREMIACAO_VENDEDOR (mesma view que ja alimenta o mes
// atual em VW_PREMIACAO_VENDEDOR_COMISSAO_ERP) - ela guarda o historico completo por
// VENDEDOR_ID + MES_REFERENCIA, nao so o mes corrente (confirmado ao vivo em 2026-09-16, org 7:
// 67/67 linhas de FT_COMISSAO_HISTORICO de 08/2026 acharam par). LEFT JOIN por seguranca (nao
// derruba a linha de comissao se por algum motivo a apuracao de margem nao tiver aquele
// vendedor/mes) - nesse caso MARGEM_MAIS_FRETE vem null e mapPremiacaoRow trata como 0.
// Nao tem coluna de conta ativa: esse filtro entra depois, via aplicarRegrasNegocioEquipe,
// igual ao caminho do mes atual.
async function buscarLinhasBrutasHistorico(empresaId, lojaScope, mesReferencia, query) {
  // Prefixo curto de proposito: Oracle limita nome de bind variable a 30 bytes (client 12.1
  // deste tenant nao tem extended identifiers) - "loja_scope_premiacao_historico_0" (32 chars)
  // estourava o limite e truncava pra um nome identico em todos os binds, causando
  // ORA-01008 (achado ao vivo em 2026-09-16, org 7). Mantem folga ate index de 2 digitos.
  const lojaCondition = buildLojaInCondition("H.SK_EMPRESAS", lojaScope, "prem_hist_loja")

  return query(
    empresaId,
    `
    SELECT
      H.SK_VENDEDOR,
      VND.VENDEDOR_ID,
      VND.NOME_VENDEDOR,
      H.MES_REFERENCIA,
      H.VALOR_COMISSAO_A_PAGAR,
      AP.MARGEM_MAIS_FRETE,
      H.STATUS_GATILHO,
      H.FAIXA_ACELERADOR,
      H.PERC_ACELERADOR,
      H.BONUS_FIXO_ADICIONAL,
      H.VALOR_PREMIACAO_FINAL
    FROM FT_COMISSAO_HISTORICO H
    JOIN DIM_VENDEDOR VND ON VND.SK_VENDEDOR = H.SK_VENDEDOR
    LEFT JOIN VW_APURACAO_PREMIACAO_VENDEDOR AP
      ON AP.VENDEDOR_ID = VND.VENDEDOR_ID
     AND AP.MES_REFERENCIA = H.MES_REFERENCIA
    WHERE ${lojaCondition.clause}
      AND H.MES_REFERENCIA = :mesReferenciaHistorico
    ORDER BY
      CASE WHEN H.STATUS_GATILHO = 'NÃO ELEGÍVEL' THEN 1 ELSE 0 END,
      H.VALOR_PREMIACAO_FINAL DESC,
      AP.MARGEM_MAIS_FRETE DESC
    `,
    { ...lojaCondition.binds, mesReferenciaHistorico: mesReferencia }
  )
}

/**
 * Lista a premiacao de todos os vendedores das lojas do gerente logado (Fase 3 do motor de
 * premiacao, visao de equipe). `lojaScope` e o retorno de getScopedLojaScope (requestScope.js)
 * - o filtro de loja e sempre revalidado no backend, nunca aceita SK_EMPRESAS direto do
 * frontend.
 *
 * Sem `mes` (ou `mes: "atual"`), le o mes em andamento de VW_PREMIACAO_VENDEDOR_COMISSAO_ERP -
 * comportamento identico ao de antes desta feature de comparacao de meses, sem regressao. Com
 * `mes` no formato MM/YYYY, le o fechamento daquele mes em FT_COMISSAO_HISTORICO.
 *
 * As DUAS regras de negocio da feature (zerar valorComissaoBase se nao elegivel, e listar so
 * vendedores com conta ativa no tenant - usuarios_auth ativo='S' AND role='VENDEDOR', mesmo
 * filtro do ranking) sao aplicadas pelo MESMO codigo em ambos os caminhos: mapPremiacaoRow
 * (zera se nao elegivel) e aplicarRegrasNegocioEquipe (filtro de conta ativa). Sem isso, a
 * origem de dados traz SK_VENDEDOR que nunca tiveram login criado no tenant (ex.: contas
 * genericas de balcao, cadastros do ERP sem usuario correspondente), inflando a lista em
 * relacao ao ranking para o mesmo gerente/loja (achado 2026-08-13, gerente Lucas: 28 vs 20 em
 * todas as lojas).
 */
export async function listarPremiacaoEquipe(
  empresaId,
  lojaScope,
  { query = queryOracleByEmpresaId, getAllowedSellerCodes = getAllowedSellerCodesByEmpresaId, mes = null } = {}
) {
  if (!empresaId) throw new PremiacaoVendedorError("empresa_id e obrigatorio.", 400)

  const mesHistorico = mes && mes !== "atual" ? validarMesReferencia(mes) : null

  const [linhasBrutas, allowedSellerCodes] = await Promise.all([
    mesHistorico
      ? buscarLinhasBrutasHistorico(empresaId, lojaScope, mesHistorico, query)
      : buscarLinhasBrutasMesAtual(empresaId, lojaScope, query),
    getAllowedSellerCodes(empresaId),
  ])

  const vendedoresMapeados = linhasBrutas.map((row) => mapPremiacaoRow(normalizeRow(row)))
  const vendedores = aplicarRegrasNegocioEquipe(vendedoresMapeados, allowedSellerCodes)

  const totalElegiveis = vendedores.filter((v) => v.elegivel).length
  const naoElegiveis = vendedores.filter((v) => !v.elegivel)

  const mesReferencia = mesHistorico ?? vendedores[0]?.mesReferencia ?? null

  const resumo = {
    totalVendedores: vendedores.length,
    totalElegiveis,
    totalNaoElegiveis: naoElegiveis.length,
    somaValorPremiacaoFinal: vendedores.reduce((soma, v) => soma + v.valorPremiacaoFinal, 0),
    totalProximosDoGatilho: naoElegiveis.filter((v) => v.faltanteGatilho > 0 && v.faltanteGatilho <= LIMIAR_PROXIMO_DO_GATILHO).length,
    limiarProximoDoGatilho: LIMIAR_PROXIMO_DO_GATILHO,
    mesReferencia,
  }

  return { mesReferencia, vendedores, resumo }
}

/**
 * Meses disponiveis em FT_COMISSAO_HISTORICO para o escopo de loja do gerente logado, do mais
 * recente para o mais antigo - usado pra popular o seletor de mes na tela de equipe. Nao inclui
 * o mes atual: apesar do nome, FT_COMISSAO_HISTORICO recebe upsert diario TAMBEM pro mes em
 * andamento (ate fechar) - sem excluir explicitamente, o mes atual apareceria duplicado no
 * seletor (uma vez como "Mes atual", outra vez como item do historico, com valores
 * potencialmente diferentes por ainda nao estar fechado - achado ao vivo em 2026-09-16, org 7,
 * onde 09/2026 - mes corrente na epoca - aparecia na lista). Comparado contra o SYSDATE do
 * proprio Oracle (nao Date do Node) pra bater com o mesmo criterio de "mes atual" que
 * VW_PREMIACAO_VENDEDOR_COMISSAO_ERP ja usa (TO_CHAR(SYSDATE, 'MM/YYYY')).
 */
export async function listarMesesDisponiveis(empresaId, lojaScope, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new PremiacaoVendedorError("empresa_id e obrigatorio.", 400)

  // Prefixo curto pelo mesmo motivo de buscarLinhasBrutasHistorico (limite de 30 bytes do
  // Oracle pra nome de bind variable).
  const lojaCondition = buildLojaInCondition("SK_EMPRESAS", lojaScope, "prem_meses_loja")

  const rows = await query(
    empresaId,
    `
    SELECT DISTINCT MES_REFERENCIA
    FROM FT_COMISSAO_HISTORICO
    WHERE ${lojaCondition.clause}
      AND MES_REFERENCIA <> TO_CHAR(SYSDATE, 'MM/YYYY')
    ORDER BY TO_DATE('01/' || MES_REFERENCIA, 'DD/MM/YYYY') DESC
    `,
    lojaCondition.binds
  )

  const mesesDisponiveis = rows
    .map((row) => normalizeRow(row).mes_referencia)
    .filter(Boolean)

  return { mesesDisponiveis }
}
