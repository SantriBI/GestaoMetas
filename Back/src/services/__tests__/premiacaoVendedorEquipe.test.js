import { test } from "node:test"
import assert from "node:assert/strict"
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

// Fechamento historico (FT_COMISSAO_HISTORICO) nao guarda MARGEM_MAIS_FRETE - vem de um LEFT
// JOIN com VW_APURACAO_PREMIACAO_VENDEDOR (ver buscarLinhasBrutasHistorico), por isso o campo
// e opcional aqui: quando omitido, simula o caso raro de LEFT JOIN sem match (null).
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

test("listarPremiacaoEquipe: mes=08/2026 le FT_COMISSAO_HISTORICO com LEFT JOIN em VW_APURACAO_PREMIACAO_VENDEDOR pra trazer margemMaisFrete, e zera valorComissaoBase se nao elegivel", async () => {
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

  assert.match(chamadas[0].sql, /FT_COMISSAO_HISTORICO/)
  assert.match(chamadas[0].sql, /VW_APURACAO_PREMIACAO_VENDEDOR/)
  assert.equal(chamadas[0].binds.mesReferenciaHistorico, "08/2026")
  assert.equal(resultado.mesReferencia, "08/2026")

  const ana = resultado.vendedores.find((v) => v.nomeVendedor === "Ana")
  const bruno = resultado.vendedores.find((v) => v.nomeVendedor === "Bruno")
  assert.equal(ana.valorComissaoBase, 1000)
  assert.equal(bruno.valorComissaoBase, 0)
  assert.equal(ana.margemMaisFrete, 25000)
  assert.equal(bruno.margemMaisFrete, 16000)
})

test("listarPremiacaoEquipe: mes=08/2026 com LEFT JOIN sem match em VW_APURACAO_PREMIACAO_VENDEDOR (caso raro) trata margemMaisFrete como 0, nao quebra", async () => {
  const query = async () => [
    linhaHistorico({ skVendedor: 1, nomeVendedor: "Ana", statusGatilho: "ELEGÍVEL", valorComissaoBase: 1000, valorPremiacaoFinal: 500 }),
  ]

  const lojaScope = { applies: true, lojaIds: [541], error: null }
  const resultado = await listarPremiacaoEquipe(7, lojaScope, {
    query,
    getAllowedSellerCodes: getAllowedSellerCodesTodos,
    mes: "08/2026",
  })

  assert.equal(resultado.vendedores[0].margemMaisFrete, 0)
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

test("listarMesesDisponiveis: consulta FT_COMISSAO_HISTORICO com o escopo de loja e retorna a lista de meses", async () => {
  const query = async (_empresaId, sql, binds) => {
    assert.match(sql, /FT_COMISSAO_HISTORICO/)
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
