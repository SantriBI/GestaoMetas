import { test } from "node:test"
import assert from "node:assert/strict"
import { listarPremiacaoEquipe, PremiacaoVendedorError } from "../premiacaoVendedorService.js"

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

test("listarPremiacaoEquipe: aplica o filtro de SK_EMPRESAS resolvido pelo lojaScope (nunca aceita loja fora do escopo)", async () => {
  const chamadas = []
  const query = async (empresaId, sql, binds) => {
    chamadas.push({ empresaId, sql, binds })
    return [linha({ skVendedor: 1, nomeVendedor: "Ana", margemMaisFrete: 25000, statusGatilho: "ELEGÍVEL", valorPremiacaoFinal: 500 })]
  }

  const lojaScope = { applies: true, lojaIds: [541, 542], error: null }
  await listarPremiacaoEquipe(7, lojaScope, { query })

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
  const resultado = await listarPremiacaoEquipe(7, lojaScope, { query })

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
  const resultado = await listarPremiacaoEquipe(7, lojaScope, { query })

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
  const resultado = await listarPremiacaoEquipe(7, lojaScope, { query })

  const ana = resultado.vendedores.find((v) => v.nomeVendedor === "Ana")
  const bruno = resultado.vendedores.find((v) => v.nomeVendedor === "Bruno")
  assert.equal(ana.valorComissaoBase, 1000)
  assert.equal(bruno.valorComissaoBase, 0)
})

test("listarPremiacaoEquipe: empresa_id ausente lanca PremiacaoVendedorError", async () => {
  await assert.rejects(
    () => listarPremiacaoEquipe(null, { applies: true, lojaIds: [541] }, { query: async () => [] }),
    PremiacaoVendedorError
  )
})
