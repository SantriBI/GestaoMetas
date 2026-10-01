import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { listarPremiacaoEquipe, listarMesesDisponiveis, PremiacaoVendedorError } from "../premiacaoVendedorService.js"

function linha({ skVendedor, nomeVendedor, margemMaisFrete, statusGatilho, valorPremiacaoFinal }) {
  return {
    SK_VENDEDOR: skVendedor,
    VENDEDOR_ID: skVendedor,
    NOME_VENDEDOR: nomeVendedor,
    MES_REFERENCIA: "08/2026",
    VALOR_COMISSAO_A_PAGAR: 1000,
    MARGEM_MAIS_FRETE: margemMaisFrete,
    STATUS_GATILHO: statusGatilho,
    FAIXA_ACELERADOR: "20.000,01 até 30.000,00",
    PERC_ACELERADOR: 0.5,
    BONUS_FIXO_ADICIONAL: 0,
    VALOR_PREMIACAO_FINAL: valorPremiacaoFinal,
  }
}

// Linha de VW_PREMIACAO_VENDEDOR_MENSAL (meses passados). A view ja faz NVL(..., 0) na
// margem quando nao ha apuracao; quando margemMaisFrete e omitido aqui, simula um null vindo
// do Oracle mesmo assim (protecao extra do mapPremiacaoRow).
function linhaHistorico({ skVendedor, nomeVendedor, margemMaisFrete, statusGatilho, valorComissaoBase, valorPremiacaoFinal }) {
  return {
    SK_VENDEDOR: skVendedor,
    VENDEDOR_ID: skVendedor,
    NOME_VENDEDOR: nomeVendedor,
    MES_REFERENCIA: "08/2026",
    VALOR_COMISSAO_A_PAGAR: valorComissaoBase,
    MARGEM_MAIS_FRETE: margemMaisFrete ?? null,
    STATUS_GATILHO: statusGatilho,
    FAIXA_ACELERADOR: "20.000,01 até 30.000,00",
    PERC_ACELERADOR: 0.5,
    BONUS_FIXO_ADICIONAL: 0,
    VALOR_PREMIACAO_FINAL: valorPremiacaoFinal,
  }
}

const allowedTodos = new Set(["1", "2", "3"])
const getAllowedSellerCodesTodos = async () => allowedTodos

test("listarPremiacaoEquipe: aplica o filtro de SK_EMPRESAS resolvido pelo lojaScope (nunca aceita loja fora do escopo)", async () => {
  const chamadas = []
  const query = async (empresaId, sql, binds) => {
    chamadas.push({ empresaId, sql, binds })
    return [linha({ skVendedor: 1, nomeVendedor: "Ana", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorPremiacaoFinal: 500 })]
  }

  const lojaScope = { applies: true, lojaIds: [541, 542], error: null }
  await listarPremiacaoEquipe(7, lojaScope, { query, getAllowedSellerCodes: getAllowedSellerCodesTodos })

  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].empresaId, 7)
  assert.match(chamadas[0].sql, /SK_EMPRESAS IN \(:loja_scope_premiacao_equipe_0, :loja_scope_premiacao_equipe_1\)/)
  assert.deepEqual(chamadas[0].binds, { loja_scope_premiacao_equipe_0: 541, loja_scope_premiacao_equipe_1: 542 })
})

test("listarPremiacaoEquipe: lojaScope sem lojas permitidas nao bate no Oracle com filtro aberto (clausula 1=0)", async () => {
  const query = async (_empresaId, sql) => {
    assert.match(sql, /1 = 0/)
    return []
  }

  const lojaScope = { applies: true, lojaIds: [], error: null }
  const resultado = await listarPremiacaoEquipe(7, lojaScope, { query, getAllowedSellerCodes: getAllowedSellerCodesTodos })

  assert.deepEqual(resultado.vendedores, [])
  assert.equal(resultado.resumo.totalVendedores, 0)
})

test("listarPremiacaoEquipe: resumo agrega elegiveis/nao elegiveis, soma da premiacao e proximos do gatilho (<= R$5.000)", async () => {
  const query = async () => [
    linha({ skVendedor: 1, nomeVendedor: "Ana", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorPremiacaoFinal: 500 }),
    linha({ skVendedor: 2, nomeVendedor: "Bruno", margemMaisFrete: 16000, statusGatilho: "NÃO ELEGÍVEL", valorPremiacaoFinal: 0 }),
    linha({ skVendedor: 3, nomeVendedor: "Carla", margemMaisFrete: 5000, statusGatilho: "NÃO ELEGÍVEL", valorPremiacaoFinal: 0 }),
  ]

  const lojaScope = { applies: true, lojaIds: [541], error: null }
  const resultado = await listarPremiacaoEquipe(7, lojaScope, { query, getAllowedSellerCodes: getAllowedSellerCodesTodos })

  assert.equal(resultado.resumo.totalVendedores, 3)
  assert.equal(resultado.resumo.totalElegiveis, 1)
  assert.equal(resultado.resumo.totalNaoElegiveis, 2)
  assert.equal(resultado.resumo.somaValorPremiacaoFinal, 500)
  // Bruno: falta 20000-16000=4000 (<=5000, entra); Carla: falta 20000-5000=15000 (nao entra).
  assert.equal(resultado.resumo.totalProximosDoGatilho, 1)
})

test("listarPremiacaoEquipe: zera valorComissaoBase para vendedores nao elegiveis, mesmo com VALOR_COMISSAO_A_PAGAR > 0 no ERP", async () => {
  const query = async () => [
    linha({ skVendedor: 1, nomeVendedor: "Ana", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorPremiacaoFinal: 500 }),
    linha({ skVendedor: 2, nomeVendedor: "Bruno", margemMaisFrete: 16000, statusGatilho: "NÃO ELEGÍVEL", valorPremiacaoFinal: 0 }),
  ]

  const lojaScope = { applies: true, lojaIds: [541], error: null }
  const resultado = await listarPremiacaoEquipe(7, lojaScope, { query, getAllowedSellerCodes: getAllowedSellerCodesTodos })

  const ana = resultado.vendedores.find((v) => v.nomeVendedor === "Ana")
  const bruno = resultado.vendedores.find((v) => v.nomeVendedor === "Bruno")
  assert.equal(ana.valorComissaoBase, 1000)
  assert.equal(bruno.valorComissaoBase, 0)
})

test("listarPremiacaoEquipe: empresa_id ausente lanca PremiacaoVendedorError", async () => {
  await assert.rejects(
    () =>
      listarPremiacaoEquipe(null, { applies: true, lojaIds: [541] }, {
        query: async () => [],
        getAllowedSellerCodes: getAllowedSellerCodesTodos,
      }),
    PremiacaoVendedorError
  )
})

test("listarPremiacaoEquipe: filtra vendedores sem conta ativa no tenant (fora de allowedSellerCodes), mesmo caminho do mes atual e do historico", async () => {
  const queryAtual = async () => [
    linha({ skVendedor: 1, nomeVendedor: "Ana", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorPremiacaoFinal: 500 }),
    linha({ skVendedor: 99, nomeVendedor: "SemLogin", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorPremiacaoFinal: 500 }),
  ]
  const queryHistorico = async () => [
    linhaHistorico({ skVendedor: 1, nomeVendedor: "Ana", statusGatilho: "ELEGÍVEL", valorComissaoBase: 1000, valorPremiacaoFinal: 500 }),
    linhaHistorico({ skVendedor: 99, nomeVendedor: "SemLogin", statusGatilho: "ELEGÍVEL", valorComissaoBase: 1000, valorPremiacaoFinal: 500 }),
  ]
  const allowedSomenteAna = new Set(["1"])
  const getAllowedSellerCodes = async () => allowedSomenteAna

  const lojaScope = { applies: true, lojaIds: [541], error: null }

  const resultadoAtual = await listarPremiacaoEquipe(7, lojaScope, { query: queryAtual, getAllowedSellerCodes })
  assert.equal(resultadoAtual.vendedores.length, 1)
  assert.equal(resultadoAtual.vendedores[0].nomeVendedor, "Ana")

  const resultadoHistorico = await listarPremiacaoEquipe(7, lojaScope, {
    query: queryHistorico,
    getAllowedSellerCodes,
    mes: "08/2026",
  })
  assert.equal(resultadoHistorico.vendedores.length, 1)
  assert.equal(resultadoHistorico.vendedores[0].nomeVendedor, "Ana")
})

test("listarPremiacaoEquipe: mes=08/2026 le VW_PREMIACAO_VENDEDOR_MENSAL (nao FT_COMISSAO_HISTORICO), traz margemMaisFrete e zera valorComissaoBase se nao elegivel", async () => {
  const chamadas = []
  const query = async (empresaId, sql, binds) => {
    chamadas.push({ empresaId, sql, binds })
    return [
      linhaHistorico({ skVendedor: 1, nomeVendedor: "Ana", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorComissaoBase: 1000, valorPremiacaoFinal: 500 }),
      linhaHistorico({ skVendedor: 2, nomeVendedor: "Bruno", margemMaisFrete: 16000, statusGatilho: "NÃO ELEGÍVEL", valorComissaoBase: 800, valorPremiacaoFinal: 0 }),
    ]
  }

  const lojaScope = { applies: true, lojaIds: [541], error: null }
  const resultado = await listarPremiacaoEquipe(7, lojaScope, {
    query,
    getAllowedSellerCodes: getAllowedSellerCodesTodos,
    mes: "08/2026",
  })

  assert.match(chamadas[0].sql, /FROM VW_PREMIACAO_VENDEDOR_MENSAL/)
  assert.doesNotMatch(chamadas[0].sql, /FT_COMISSAO_HISTORICO/)
  assert.match(chamadas[0].sql, /SK_EMPRESAS IN \(:prem_hist_loja_0\)/)
  assert.equal(chamadas[0].binds.mesReferenciaHistorico, "08/2026")
  assert.equal(resultado.mesReferencia, "08/2026")

  const ana = resultado.vendedores.find((v) => v.nomeVendedor === "Ana")
  const bruno = resultado.vendedores.find((v) => v.nomeVendedor === "Bruno")
  assert.equal(ana.valorComissaoBase, 1000)
  assert.equal(bruno.valorComissaoBase, 0)
  assert.equal(ana.margemMaisFrete, 25000)
  assert.equal(bruno.margemMaisFrete, 16000)
})

test("listarPremiacaoEquipe: vendedor sem apuracao no mes (linha com os NVL da VW_PREMIACAO_VENDEDOR_MENSAL) aparece com margem 0, NAO ELEGIVEL, faixa ate 20.000 e premiacao 0", async () => {
  // Caso real: LUANA ROSMARI MEDINA, SK 15269, 09/2026, comissao -1,40, sem apuracao de margem.
  const query = async () => [
    {
      SK_VENDEDOR: 3,
      VENDEDOR_ID: 3,
      NOME_VENDEDOR: "Luana",
      MES_REFERENCIA: "09/2026",
      VALOR_COMISSAO_A_PAGAR: -1.4,
      MARGEM_MAIS_FRETE: 0,
      STATUS_GATILHO: "NÃO ELEGÍVEL",
      FAIXA_ACELERADOR: "Até 20.000,00",
      PERC_ACELERADOR: 0,
      BONUS_FIXO_ADICIONAL: 0,
      VALOR_PREMIACAO_FINAL: 0,
    },
    // Protecao extra: mesmo que a margem chegue null, vira 0.
    linhaHistorico({ skVendedor: 1, nomeVendedor: "Ana", statusGatilho: "ELEGÍVEL", valorComissaoBase: 1000, valorPremiacaoFinal: 500 }),
  ]

  const lojaScope = { applies: true, lojaIds: [541], error: null }
  const resultado = await listarPremiacaoEquipe(7, lojaScope, {
    query,
    getAllowedSellerCodes: getAllowedSellerCodesTodos,
    mes: "09/2026",
  })

  const luana = resultado.vendedores.find((v) => v.nomeVendedor === "Luana")
  assert.equal(luana.margemMaisFrete, 0)
  assert.equal(luana.statusGatilho, "NÃO ELEGÍVEL")
  assert.equal(luana.elegivel, false)
  assert.equal(luana.faixaAcelerador, "Até 20.000,00")
  assert.equal(luana.percAcelerador, 0)
  assert.equal(luana.bonusFixoAdicional, 0)
  assert.equal(luana.valorPremiacaoFinal, 0)
  assert.equal(luana.valorComissaoBase, 0)
  assert.equal(luana.faltanteGatilho, 20000)
  // extrairLimiteSuperiorFaixa precisa conseguir ler o literal da faixa (regex "ate X,YY").
  assert.equal(luana.faltanteProximaFaixa, 20000)

  const ana = resultado.vendedores.find((v) => v.nomeVendedor === "Ana")
  assert.equal(ana.margemMaisFrete, 0)
})

test("VW_PREMIACAO_VENDEDOR_MENSAL: literal da faixa no NVL e identico ao da primeira faixa do CASE de VW_APURACAO_PREMIACAO_VENDEDOR", () => {
  const sqlDir = fileURLToPath(new URL("../../../Back/sql/", import.meta.url))
  const mensal = readFileSync(`${sqlDir}vw_premiacao_vendedor_mensal.sql`, "utf8")
  const apuracao = readFileSync(`${sqlDir}vw_apuracao_premiacao_vendedor_fix_gatilho_margem_mais_frete.sql`, "utf8")

  const literalMensal = /NVL\(ap\.FAIXA_ACELERADOR,\s*'([^']+)'\)/.exec(mensal)?.[1]
  const literalApuracao = /MARGEM_MAIS_FRETE <= 20000\s+THEN '([^']+)'/.exec(apuracao)?.[1]

  assert.ok(literalMensal, "NVL da faixa nao encontrado na view mensal")
  assert.equal(literalMensal, literalApuracao)
  assert.match(mensal, /LEFT JOIN DM_VENDAS\.VW_APURACAO_PREMIACAO_VENDEDOR ap/)
  assert.match(mensal, /com\.MES_REFERENCIA,/)
})

test("listarPremiacaoEquipe: mes invalido (fora do formato MM/YYYY) lanca PremiacaoVendedorError", async () => {
  const lojaScope = { applies: true, lojaIds: [541], error: null }
  await assert.rejects(
    () =>
      listarPremiacaoEquipe(7, lojaScope, {
        query: async () => [],
        getAllowedSellerCodes: getAllowedSellerCodesTodos,
        mes: "agosto/2026",
      }),
    PremiacaoVendedorError
  )
})

test("listarPremiacaoEquipe: mes='atual' (explicito) se comporta igual a nao passar mes", async () => {
  const chamadas = []
  const query = async (empresaId, sql, binds) => {
    chamadas.push(sql)
    return [linha({ skVendedor: 1, nomeVendedor: "Ana", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorPremiacaoFinal: 500 })]
  }

  const lojaScope = { applies: true, lojaIds: [541], error: null }
  await listarPremiacaoEquipe(7, lojaScope, { query, getAllowedSellerCodes: getAllowedSellerCodesTodos, mes: "atual" })

  assert.match(chamadas[0], /VW_PREMIACAO_VENDEDOR_COMISSAO_ERP/)
})

test("listarMesesDisponiveis: consulta VW_COMISSAO_ERP_MENSAL (nao FT_COMISSAO_HISTORICO) com o escopo de loja, sem o mes atual, e retorna a lista de meses", async () => {
  const query = async (_empresaId, sql, binds) => {
    assert.match(sql, /FROM VW_COMISSAO_ERP_MENSAL/)
    assert.doesNotMatch(sql, /FT_COMISSAO_HISTORICO/)
    assert.match(sql, /MES_REFERENCIA <> TO_CHAR\(SYSDATE, 'MM\/YYYY'\)/)
    assert.match(sql, /SK_EMPRESAS IN/)
    assert.deepEqual(binds, { prem_meses_loja_0: 541 })
    return [{ MES_REFERENCIA: "09/2026" }, { MES_REFERENCIA: "08/2026" }]
  }

  const lojaScope = { applies: true, lojaIds: [541], error: null }
  const resultado = await listarMesesDisponiveis(7, lojaScope, { query })

  assert.deepEqual(resultado.mesesDisponiveis, ["09/2026", "08/2026"])
})

test("listarPremiacaoEquipe (historico) e listarMesesDisponiveis: nomes de bind variable ficam <= 30 bytes mesmo com 12 lojas no escopo (index de 2 digitos) - Oracle client 12.1 deste tenant nao tem extended identifiers, bind truncado causa ORA-01008 (achado ao vivo em 2026-09-16, org 7)", async () => {
  const lojaIds = Array.from({ length: 12 }, (_, i) => 540 + i)
  const lojaScope = { applies: true, lojaIds, error: null }

  const queryHistorico = async (_empresaId, sql, binds) => {
    for (const key of Object.keys(binds)) {
      assert.ok(key.length <= 30, `bind "${key}" tem ${key.length} bytes (> 30, Oracle rejeita/trunca)`)
    }
    return []
  }
  await listarPremiacaoEquipe(7, lojaScope, {
    query: queryHistorico,
    getAllowedSellerCodes: getAllowedSellerCodesTodos,
    mes: "08/2026",
  })

  const queryMeses = async (_empresaId, sql, binds) => {
    for (const key of Object.keys(binds)) {
      assert.ok(key.length <= 30, `bind "${key}" tem ${key.length} bytes (> 30, Oracle rejeita/trunca)`)
    }
    return []
  }
  await listarMesesDisponiveis(7, lojaScope, { query: queryMeses })
})

test("listarMesesDisponiveis: empresa_id ausente lanca PremiacaoVendedorError", async () => {
  await assert.rejects(
    () => listarMesesDisponiveis(null, { applies: true, lojaIds: [541] }, { query: async () => [] }),
    PremiacaoVendedorError
  )
})
