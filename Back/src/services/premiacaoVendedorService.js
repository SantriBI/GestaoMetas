import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { buildLojaInCondition } from "./lojaScopeService.js"
import { buildSellerInCondition, getAllowedSellerCodesByEmpresaId } from "./tenantSellerScope.js"

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
// listarPremiacaoEquipe (visao do gerente) - a formula/regra de elegibilidade precisa ser
// identica nas duas telas.
function mapPremiacaoRow(row) {
  const margemMaisFrete = Number(row.margem_mais_frete ?? 0)
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
    faltanteGatilho: elegivel ? 0 : Math.max(0, GATILHO_MINIMO_MARGEM - margemMaisFrete),
    faltanteProximaFaixa:
      limiteSuperiorFaixa != null ? Math.max(0, limiteSuperiorFaixa - margemMaisFrete) : null,
  }
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

/**
 * Lista a premiacao do mes corrente de todos os vendedores das lojas do gerente logado
 * (Fase 3 do motor de premiacao, visao de equipe). `lojaScope` e o retorno de
 * getScopedLojaScope (requestScope.js) - o filtro de loja e sempre revalidado no backend,
 * nunca aceita SK_EMPRESAS direto do frontend. Retorna a lista ja ordenada (elegiveis por
 * VALOR_PREMIACAO_FINAL desc, nao elegiveis por MARGEM_MAIS_FRETE desc - destaca quem esta
 * mais perto do gatilho) e um resumo agregado para o cabecalho da tela.
 *
 * Alem do escopo de loja, aplica o mesmo filtro de conta ativa que o ranking usa
 * (tenantSellerScope.js: usuarios_auth ativo='S' AND role='VENDEDOR') - sem isso, a view Oracle
 * traz SK_VENDEDOR que nunca tiveram login criado no tenant (ex.: contas genericas de balcao,
 * cadastros do ERP sem usuario correspondente), inflando a lista em relacao ao ranking para o
 * mesmo gerente/loja (achado 2026-08-13, gerente Lucas: 28 vs 20 em todas as lojas).
 */
export async function listarPremiacaoEquipe(empresaId, lojaScope, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new PremiacaoVendedorError("empresa_id e obrigatorio.", 400)

  const lojaCondition = buildLojaInCondition("SK_EMPRESAS", lojaScope, "loja_scope_premiacao_equipe")
  const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(empresaId)
  const sellerCondition = buildSellerInCondition("SK_VENDEDOR", allowedSellerCodes, "seller_scope_equipe")

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
    WHERE ${lojaCondition.clause}
      AND ${sellerCondition.clause}
    ORDER BY
      CASE WHEN STATUS_GATILHO = 'NÃO ELEGÍVEL' THEN 1 ELSE 0 END,
      VALOR_PREMIACAO_FINAL DESC,
      MARGEM_MAIS_FRETE DESC
    `,
    { ...lojaCondition.binds, ...sellerCondition.binds }
  )

  const vendedores = rows.map((row) => mapPremiacaoRow(normalizeRow(row)))

  const totalElegiveis = vendedores.filter((v) => v.elegivel).length
  const naoElegiveis = vendedores.filter((v) => !v.elegivel)

  const resumo = {
    totalVendedores: vendedores.length,
    totalElegiveis,
    totalNaoElegiveis: naoElegiveis.length,
    somaValorPremiacaoFinal: vendedores.reduce((soma, v) => soma + v.valorPremiacaoFinal, 0),
    totalProximosDoGatilho: naoElegiveis.filter((v) => v.faltanteGatilho > 0 && v.faltanteGatilho <= LIMIAR_PROXIMO_DO_GATILHO).length,
    limiarProximoDoGatilho: LIMIAR_PROXIMO_DO_GATILHO,
    mesReferencia: vendedores[0]?.mesReferencia ?? null,
  }

  return { vendedores, resumo }
}
