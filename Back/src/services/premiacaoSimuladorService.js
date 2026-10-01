import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { buscarMinhaPremiacao } from "./premiacaoVendedorService.js"
import { buscarPercentualVigenteGrupo } from "./parametrosPremiacaoService.js"

const TABLE = "PARAM_FAIXA_ACELERADOR_PREMIACAO"
// Mesmo gatilho minimo de margem+frete usado em premiacaoVendedorService (regra do negocio,
// ver VW_PREMIACAO_VENDEDOR_COMISSAO_ERP / VW_APURACAO_PREMIACAO_VENDEDOR - STATUS_GATILHO).
const GATILHO_MINIMO_MARGEM = 20000
// Colunas reais de DIM_PRODUTOS (mesmas de parametrosPremiacaoService).
const NIVEL_COLUMNS = { 1: "NOME_PAI_NIVEL1", 2: "NOME_PAI_NIVEL2", 3: "NOME_PAI_NIVEL3" }
// Janela usada para calcular a margem media historica do vendedor por grupo de produto - meses
// corridos pra tras a partir de hoje, em regime de caixa (SK_DT_RECEBIMENTO), mesmo grao usado
// em VW_APURACAO_PREMIACAO_VENDEDOR e em listarGruposSemPercentual.
const MESES_JANELA_MARGEM_MEDIA = 6

export class PremiacaoSimuladorError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = "PremiacaoSimuladorError"
    this.statusCode = statusCode
  }
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function normalizeNivel(nivel) {
  const parsed = Number(nivel)
  if (!NIVEL_COLUMNS[parsed]) {
    throw new PremiacaoSimuladorError("Nivel invalido: use 1, 2 ou 3.", 400)
  }
  return parsed
}

function normalizeNomeGrupo(nomeGrupo) {
  const nome = String(nomeGrupo ?? "").trim()
  if (!nome) {
    throw new PremiacaoSimuladorError("Nome do grupo e obrigatorio.", 400)
  }
  return nome
}

function normalizeValorVendaAdicional(valor) {
  const parsed = Number(valor)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PremiacaoSimuladorError("valor deve ser um numero maior ou igual a zero.", 400)
  }
  return parsed
}

function normalizeSkVendedor(skVendedor) {
  const parsed = Number(skVendedor)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PremiacaoSimuladorError("Usuario nao vinculado a um vendedor.", 400)
  }
  return parsed
}

function mapFaixaRow(row) {
  const item = normalizeRow(row)
  return {
    id: item.id != null ? Number(item.id) : null,
    limiteInferior: Number(item.limite_inferior ?? 0),
    limiteSuperior: item.limite_superior != null ? Number(item.limite_superior) : null,
    percAcelerador: Number(item.perc_acelerador ?? 0),
    bonusFixoAdicional: Number(item.bonus_fixo_adicional ?? 0),
    vigenteDesde: item.dt_inicio_vigencia ?? null,
  }
}

/**
 * Lista a escada vigente de faixas do acelerador, ordenada do limite inferior mais baixo para
 * o mais alto. Alimenta tanto o simulador (calculo da faixa resultante) quanto a aba "Faixas do
 * acelerador" da tela Comissoes (visao do gerente).
 */
export async function listarFaixasAcelerador(empresaId, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new PremiacaoSimuladorError("empresa_id e obrigatorio.", 400)

  const rows = await query(
    empresaId,
    `
    SELECT ID, LIMITE_INFERIOR, LIMITE_SUPERIOR, PERC_ACELERADOR, BONUS_FIXO_ADICIONAL, DT_INICIO_VIGENCIA
    FROM ${TABLE}
    WHERE DT_FIM_VIGENCIA IS NULL
    ORDER BY LIMITE_INFERIOR ASC
    `
  )

  return rows.map(mapFaixaRow)
}

/**
 * Substitui a escada inteira: fecha a vigencia de TODAS as linhas vigentes (mesmo dia da
 * edicao) e insere a nova leva completa - mesmo padrao de vigencia de
 * salvarPercentualGrupo (parametrosPremiacaoService.js), so que aqui a unidade de edicao e a
 * escada toda (um conjunto de faixas), nao uma linha isolada, porque as faixas so fazem
 * sentido como um conjunto contiguo.
 */
export async function salvarFaixasAcelerador(empresaId, faixas, usuarioId, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new PremiacaoSimuladorError("empresa_id e obrigatorio.", 400)
  const usuarioIdNum = Number(usuarioId)
  if (!Number.isFinite(usuarioIdNum) || usuarioIdNum <= 0) {
    throw new PremiacaoSimuladorError("Usuario invalido.", 401)
  }

  if (!Array.isArray(faixas) || faixas.length === 0) {
    throw new PremiacaoSimuladorError("Informe ao menos uma faixa.", 400)
  }

  const faixasOrdenadas = [...faixas].sort((a, b) => Number(a.limiteInferior) - Number(b.limiteInferior))

  const binds = { usuarioId: usuarioIdNum }
  const insertsSql = faixasOrdenadas.map((faixa, index) => {
    const limiteInferior = Number(faixa.limiteInferior)
    const limiteSuperior = faixa.limiteSuperior == null || faixa.limiteSuperior === "" ? null : Number(faixa.limiteSuperior)
    const percAcelerador = Number(faixa.percAcelerador)
    const bonusFixoAdicional = Number(faixa.bonusFixoAdicional ?? 0)

    if (!Number.isFinite(limiteInferior) || limiteInferior < 0) {
      throw new PremiacaoSimuladorError(`Faixa ${index + 1}: limite inferior invalido.`, 400)
    }
    if (limiteSuperior != null && (!Number.isFinite(limiteSuperior) || limiteSuperior <= limiteInferior)) {
      throw new PremiacaoSimuladorError(`Faixa ${index + 1}: limite superior deve ser maior que o limite inferior.`, 400)
    }
    if (!Number.isFinite(percAcelerador) || percAcelerador < 0) {
      throw new PremiacaoSimuladorError(`Faixa ${index + 1}: percentual de acelerador invalido.`, 400)
    }
    if (!Number.isFinite(bonusFixoAdicional) || bonusFixoAdicional < 0) {
      throw new PremiacaoSimuladorError(`Faixa ${index + 1}: bonus fixo adicional invalido.`, 400)
    }
    if (index > 0 && limiteInferior !== Number(faixasOrdenadas[index - 1].limiteSuperior)) {
      throw new PremiacaoSimuladorError("As faixas devem ser contiguas (limite inferior = limite superior da faixa anterior).", 400)
    }
    if (index < faixasOrdenadas.length - 1 && limiteSuperior == null) {
      throw new PremiacaoSimuladorError("Somente a ultima faixa pode ficar sem limite superior.", 400)
    }

    // Prefixo curto de proposito (mesmo motivo de premiacaoVendedorService/buscarLinhasBrutasHistorico):
    // Oracle limita nome de bind variable a 30 bytes.
    const prefixo = `pfa${index}`
    binds[`${prefixo}_inf`] = limiteInferior
    binds[`${prefixo}_sup`] = limiteSuperior
    binds[`${prefixo}_pct`] = percAcelerador
    binds[`${prefixo}_bon`] = bonusFixoAdicional

    return `
      INSERT INTO ${TABLE}
        (LIMITE_INFERIOR, LIMITE_SUPERIOR, PERC_ACELERADOR, BONUS_FIXO_ADICIONAL, DT_INICIO_VIGENCIA, DT_FIM_VIGENCIA, CRIADO_POR_USUARIO_ID)
      VALUES
        (:${prefixo}_inf, :${prefixo}_sup, :${prefixo}_pct, :${prefixo}_bon, v_data_edicao, NULL, :usuarioId);
    `
  })

  await query(
    empresaId,
    `
    DECLARE
      v_data_edicao DATE := TRUNC(SYSDATE);
    BEGIN
      UPDATE ${TABLE}
         SET DT_FIM_VIGENCIA = v_data_edicao - 1
       WHERE DT_FIM_VIGENCIA IS NULL;

      ${insertsSql.join("\n")}
    END;
    `,
    binds,
    { autoCommit: true }
  )

  return listarFaixasAcelerador(empresaId, { query })
}

/**
 * Resolve a faixa da escada (ja ordenada por limiteInferior asc) que corresponde a uma margem+
 * frete. As faixas sao contiguas, entao basta achar a primeira cujo limite superior (inclusive)
 * comporta a margem, ou a ultima faixa quando ela nao tem teto (limiteSuperior null).
 */
export function resolverFaixaResultante(margemMaisFrete, faixasOrdenadas) {
  if (!Array.isArray(faixasOrdenadas) || faixasOrdenadas.length === 0) return null

  return (
    faixasOrdenadas.find((faixa) => faixa.limiteSuperior == null || margemMaisFrete <= faixa.limiteSuperior) ??
    faixasOrdenadas[faixasOrdenadas.length - 1]
  )
}

/**
 * Margem+frete media por R$ de venda que o vendedor historicamente gera num grupo de produto -
 * usada para converter "vender mais R$X" em "quanto isso soma de margem+frete" no simulador.
 * Mesma juntacao FATO_VENDAS_LUCRATIVIDADE + DIM_PRODUTOS de listarGruposSemPercentual
 * (parametrosPremiacaoService.js), mas filtrada por vendedor e por uma janela historica (nao o
 * mes corrente) - o simulador precisa de um ritmo medio, nao do resultado de um unico mes.
 * MARGEM_MAIS_FRETE aqui usa a mesma formula de VW_APURACAO_PREMIACAO_VENDEDOR:
 * VALOR_LUCRO_PRESENTE_ITEM + VALOR_FRETE_ITEM + VALOR_OUTRAS_DESPESAS_ITEM (ver memoria
 * vw_apuracao_premiacao_vendedor_margem_lucro_presente / _outras_despesas).
 * Retorna null se o vendedor nao tiver venda no grupo dentro da janela (sem base pra estimar).
 */
export async function calcularRatioMargemPorGrupo(
  empresaId,
  skVendedor,
  nivel,
  nomeGrupo,
  { query = queryOracleByEmpresaId } = {}
) {
  if (!empresaId) throw new PremiacaoSimuladorError("empresa_id e obrigatorio.", 400)
  const skVendedorNum = normalizeSkVendedor(skVendedor)
  const nivelNum = normalizeNivel(nivel)
  const nome = normalizeNomeGrupo(nomeGrupo)
  const coluna = NIVEL_COLUMNS[nivelNum]

  const rows = await query(
    empresaId,
    `
    SELECT
      SUM(
        CASE WHEN f.TIPO = 'DEV' THEN NVL(f.VALOR_LIQUIDO_ITEM, 0) * -1 ELSE NVL(f.VALOR_LIQUIDO_ITEM, 0) END
      ) AS RECEITA_TOTAL,
      SUM(
        CASE WHEN f.TIPO = 'DEV'
          THEN (NVL(f.VALOR_LUCRO_PRESENTE_ITEM, 0) + NVL(f.VALOR_FRETE_ITEM, 0) + NVL(f.VALOR_OUTRAS_DESPESAS_ITEM, 0)) * -1
          ELSE NVL(f.VALOR_LUCRO_PRESENTE_ITEM, 0) + NVL(f.VALOR_FRETE_ITEM, 0) + NVL(f.VALOR_OUTRAS_DESPESAS_ITEM, 0)
        END
      ) AS MARGEM_MAIS_FRETE_TOTAL
    FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
    JOIN DM_VENDAS.DIM_PRODUTOS p ON p.SK_PRODUTO = f.SK_PRODUTO
    WHERE f.SK_VENDEDOR = :skVendedor
      AND p.${coluna} = :nomeGrupo
      AND f.SK_DT_RECEBIMENTO IS NOT NULL
      AND TO_DATE(TO_CHAR(f.SK_DT_RECEBIMENTO), 'YYYYMMDD') >= ADD_MONTHS(TRUNC(SYSDATE), -${MESES_JANELA_MARGEM_MEDIA})
    `,
    { skVendedor: skVendedorNum, nomeGrupo: nome }
  )

  const item = rows[0] ? normalizeRow(rows[0]) : null
  const receitaTotal = Number(item?.receita_total ?? 0)
  const margemMaisFreteTotal = Number(item?.margem_mais_frete_total ?? 0)

  if (!item || receitaTotal <= 0) return null

  return {
    nivel: nivelNum,
    nomeGrupo: nome,
    receitaHistorica: receitaTotal,
    margemMaisFreteHistorica: margemMaisFreteTotal,
    ratioMargemPorReal: margemMaisFreteTotal / receitaTotal,
    mesesJanela: MESES_JANELA_MARGEM_MEDIA,
  }
}

/**
 * Grupos de produto (no nivel informado) que o vendedor efetivamente vendeu na janela padrao,
 * ordenados da maior para a menor receita - alimenta o seletor de grupo do simulador no front
 * (independente da flag COMISSOES: aqui e so o historico de vendas do proprio vendedor, nao o
 * cadastro de percentual por grupo).
 */
export async function listarGruposHistoricosVendedor(empresaId, skVendedor, nivel, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new PremiacaoSimuladorError("empresa_id e obrigatorio.", 400)
  const nivelNum = normalizeNivel(nivel)
  const coluna = NIVEL_COLUMNS[nivelNum]

  const rows = await query(
    empresaId,
    `
    SELECT
      p.${coluna} AS NOME_GRUPO,
      SUM(CASE WHEN f.TIPO = 'DEV' THEN NVL(f.VALOR_LIQUIDO_ITEM, 0) * -1 ELSE NVL(f.VALOR_LIQUIDO_ITEM, 0) END) AS RECEITA_TOTAL
    FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
    JOIN DM_VENDAS.DIM_PRODUTOS p ON p.SK_PRODUTO = f.SK_PRODUTO
    WHERE f.SK_VENDEDOR = :skVendedor
      AND p.${coluna} IS NOT NULL
      AND f.SK_DT_RECEBIMENTO IS NOT NULL
      AND TO_DATE(TO_CHAR(f.SK_DT_RECEBIMENTO), 'YYYYMMDD') >= ADD_MONTHS(TRUNC(SYSDATE), -${MESES_JANELA_MARGEM_MEDIA})
    GROUP BY p.${coluna}
    HAVING SUM(CASE WHEN f.TIPO = 'DEV' THEN NVL(f.VALOR_LIQUIDO_ITEM, 0) * -1 ELSE NVL(f.VALOR_LIQUIDO_ITEM, 0) END) > 0
    ORDER BY RECEITA_TOTAL DESC
    `,
    { skVendedor: normalizeSkVendedor(skVendedor) }
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return { nomeGrupo: item.nome_grupo, receitaHistorica: Number(item.receita_total) }
  })
}

/**
 * Grupo de produto (no nivel informado) com maior receita historica do vendedor na janela
 * padrao - usado como "grupo preferido" nos contadores prontos (sem simulacao), quando o front
 * nao informa um grupo especifico.
 */
async function buscarGrupoPreferido(empresaId, skVendedor, nivel, { query = queryOracleByEmpresaId } = {}) {
  const grupos = await listarGruposHistoricosVendedor(empresaId, skVendedor, nivel, { query })
  return grupos[0]?.nomeGrupo ?? null
}

/**
 * Simula "se eu vender mais R$X do grupo Y, quanto minha margem+frete, minha faixa de
 * acelerador e minha premiacao final mudam" (Fase 1 do plano de melhorias).
 *
 * Formula: a venda adicional vira margem+frete adicional pela media historica do vendedor
 * naquele grupo (calcularRatioMargemPorGrupo); essa margem adicional vira comissao base
 * adicional aplicando o % de premiacao cadastrado para o grupo (PARAM_PERCENTUAL_GRUPO_PREMIACAO,
 * via buscarPercentualVigenteGrupo); a nova margem+frete total resolve a faixa resultante na
 * escada (PARAM_FAIXA_ACELERADOR_PREMIACAO) e a nova premiacao final usa a MESMA formula de
 * VW_PREMIACAO_VENDEDOR_COMISSAO_ERP: comissaoBase x percAcelerador + bonusFixoAdicional,
 * zerada se nao elegivel (margem+frete < gatilho minimo).
 */
export async function simularCenario(
  empresaId,
  skVendedor,
  { nivel, grupoNome, valorVendaAdicional },
  {
    query = queryOracleByEmpresaId,
    buscarPremiacao = buscarMinhaPremiacao,
    buscarPercentualGrupo = buscarPercentualVigenteGrupo,
    calcularRatio = calcularRatioMargemPorGrupo,
    listarFaixas = listarFaixasAcelerador,
  } = {}
) {
  if (!empresaId) throw new PremiacaoSimuladorError("empresa_id e obrigatorio.", 400)
  const skVendedorNum = normalizeSkVendedor(skVendedor)
  const nivelNum = normalizeNivel(nivel)
  const nome = normalizeNomeGrupo(grupoNome)
  const valorAdicional = normalizeValorVendaAdicional(valorVendaAdicional)

  const premiacaoAtual = await buscarPremiacao(empresaId, skVendedorNum, { query })
  if (!premiacaoAtual) {
    throw new PremiacaoSimuladorError("Nenhuma comissao do ERP encontrada para o mes corrente.", 404)
  }

  const [ratioInfo, percentualGrupo, faixas] = await Promise.all([
    calcularRatio(empresaId, skVendedorNum, nivelNum, nome, { query }),
    buscarPercentualGrupo(empresaId, nivelNum, nome, { query }),
    listarFaixas(empresaId, { query }),
  ])

  if (!ratioInfo) {
    throw new PremiacaoSimuladorError(
      `Sem historico de vendas suficiente (ultimos ${MESES_JANELA_MARGEM_MEDIA} meses) para estimar a margem no grupo "${nome}".`,
      422
    )
  }

  const margemMaisFreteAtual = premiacaoAtual.margemMaisFrete ?? 0
  const margemIncremental = valorAdicional * ratioInfo.ratioMargemPorReal
  const comissaoBaseIncremental = percentualGrupo ? margemIncremental * (percentualGrupo.percentual / 100) : 0

  const novaMargemMaisFrete = margemMaisFreteAtual + margemIncremental
  const novaComissaoBase = premiacaoAtual.valorComissaoBase + comissaoBaseIncremental
  const novoElegivel = novaMargemMaisFrete >= GATILHO_MINIMO_MARGEM

  const faixaResultante = novoElegivel ? resolverFaixaResultante(novaMargemMaisFrete, faixas) : null
  const novoPercAcelerador = faixaResultante?.percAcelerador ?? 0
  const novoBonusFixoAdicional = faixaResultante?.bonusFixoAdicional ?? 0
  const novoValorPremiacaoFinal = novoElegivel ? novaComissaoBase * novoPercAcelerador + novoBonusFixoAdicional : 0

  const proximaFaixa = faixaResultante
    ? faixas.find((faixa) => faixa.limiteInferior === faixaResultante.limiteSuperior) ?? null
    : null

  return {
    grupo: { nivel: nivelNum, nomeGrupo: nome },
    valorVendaAdicional: valorAdicional,
    ratioMargemPorReal: ratioInfo.ratioMargemPorReal,
    percentualGrupoCadastrado: percentualGrupo?.percentual ?? null,
    atual: {
      margemMaisFrete: margemMaisFreteAtual,
      valorComissaoBase: premiacaoAtual.valorComissaoBase,
      elegivel: premiacaoAtual.elegivel,
      faixaAcelerador: premiacaoAtual.faixaAcelerador,
      percAcelerador: premiacaoAtual.percAcelerador,
      bonusFixoAdicional: premiacaoAtual.bonusFixoAdicional,
      valorPremiacaoFinal: premiacaoAtual.valorPremiacaoFinal,
    },
    simulado: {
      margemMaisFrete: novaMargemMaisFrete,
      valorComissaoBase: novaComissaoBase,
      elegivel: novoElegivel,
      percAcelerador: novoPercAcelerador,
      bonusFixoAdicional: novoBonusFixoAdicional,
      valorPremiacaoFinal: novoValorPremiacaoFinal,
      faltanteProximaFaixa:
        proximaFaixa && proximaFaixa.limiteInferior != null
          ? Math.max(0, proximaFaixa.limiteInferior - novaMargemMaisFrete)
          : null,
    },
    diferenca: {
      margemMaisFrete: novaMargemMaisFrete - margemMaisFreteAtual,
      valorPremiacaoFinal: novoValorPremiacaoFinal - premiacaoAtual.valorPremiacaoFinal,
    },
  }
}

/**
 * Contadores prontos, sem simulacao/parametros do front: "quanto falta vender (em R$ de venda,
 * nao so em R$ de margem) para bater o gatilho minimo" e "para a proxima faixa", convertidos
 * usando a margem media historica do vendedor no grupo de maior receita dele (grupo preferido).
 * Espelha o que a tela ja mostra em R$ de margem (faltanteGatilho/faltanteProximaFaixa de
 * premiacaoVendedorService.js), so que em R$ de venda.
 */
export async function calcularContadoresVenda(
  empresaId,
  skVendedor,
  { nivel = 3 } = {},
  {
    query = queryOracleByEmpresaId,
    buscarPremiacao = buscarMinhaPremiacao,
    buscarGrupoPreferidoDep = buscarGrupoPreferido,
    calcularRatio = calcularRatioMargemPorGrupo,
  } = {}
) {
  if (!empresaId) throw new PremiacaoSimuladorError("empresa_id e obrigatorio.", 400)
  const skVendedorNum = normalizeSkVendedor(skVendedor)
  const nivelNum = normalizeNivel(nivel)

  const premiacaoAtual = await buscarPremiacao(empresaId, skVendedorNum, { query })
  if (!premiacaoAtual) {
    throw new PremiacaoSimuladorError("Nenhuma comissao do ERP encontrada para o mes corrente.", 404)
  }

  const grupoPreferido = await buscarGrupoPreferidoDep(empresaId, skVendedorNum, nivelNum, { query })
  if (!grupoPreferido) {
    return {
      grupoPreferido: null,
      ratioMargemPorReal: null,
      faltanteGatilhoEmVenda: null,
      faltanteProximaFaixaEmVenda: null,
    }
  }

  const ratioInfo = await calcularRatio(empresaId, skVendedorNum, nivelNum, grupoPreferido, { query })
  const ratio = ratioInfo?.ratioMargemPorReal ?? null

  return {
    grupoPreferido: { nivel: nivelNum, nomeGrupo: grupoPreferido },
    ratioMargemPorReal: ratio,
    faltanteGatilhoEmVenda:
      ratio && ratio > 0 && premiacaoAtual.faltanteGatilho > 0
        ? premiacaoAtual.faltanteGatilho / ratio
        : premiacaoAtual.faltanteGatilho > 0
        ? null
        : 0,
    faltanteProximaFaixaEmVenda:
      ratio && ratio > 0 && premiacaoAtual.faltanteProximaFaixa
        ? premiacaoAtual.faltanteProximaFaixa / ratio
        : null,
  }
}
