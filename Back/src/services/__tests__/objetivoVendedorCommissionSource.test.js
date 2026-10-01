import { test } from "node:test"
import assert from "node:assert/strict"
import { createCommissionSnapshotLoader } from "../objetivoVendedorService.js"

const ORA_00942 = Object.assign(new Error("ORA-00942: table or view does not exist"), { errorNum: 942 })
const LINHA_COMISSAO = {
  SK_VENDEDOR: 123,
  VENDEDOR_ID: 45,
  RECEITA_ATE_ONTEM: 50000,
  PERCENTUAL_COMISSAO: 0.8,
  VALOR_COMISSAO_A_PAGAR: 400,
}

function createSilentLogger() {
  const mensagens = []
  return {
    mensagens,
    info: (msg) => mensagens.push(["info", msg]),
    warn: (msg) => mensagens.push(["warn", msg]),
  }
}

// Fake de runQuery: cada fonte (nome no FROM) devolve linhas ou lanca o erro configurado.
function createFakeRunQuery(respostasPorFonte) {
  const chamadas = []
  async function runQuery(sql, binds, options = {}) {
    const fonte = sql.match(/FROM (\w+) com/)[1]
    chamadas.push({ fonte, options })
    const resposta = respostasPorFonte[fonte]
    if (resposta instanceof Error) throw resposta
    return resposta
  }
  return { runQuery, chamadas }
}

test("Meta de Vida: organizacao com a view nova le da view e guarda a fonte", async () => {
  const { runQuery, chamadas } = createFakeRunQuery({
    vw_comissao_erp_mes_atual: [LINHA_COMISSAO],
    ft_comissao_parametrizada: [],
  })
  const load = createCommissionSnapshotLoader({ runQuery, logger: createSilentLogger() })

  const primeiro = await load({ empresaId: 19, skVendedor: 123 })
  const segundo = await load({ empresaId: 19, skVendedor: 123 })

  assert.equal(primeiro.commissionAmount, 400)
  assert.equal(primeiro.commissionRate, 0.008)
  assert.deepEqual(segundo, primeiro)
  assert.deepEqual(
    chamadas.map((c) => c.fonte),
    ["vw_comissao_erp_mes_atual", "vw_comissao_erp_mes_atual"]
  )
  // So a deteccao suprime o log do oracle-tenants; a leitura normal loga erro como antes.
  assert.equal(chamadas[0].options.suppressErrorLog, true)
  assert.equal(chamadas[1].options.suppressErrorLog, undefined)
})

test("Meta de Vida: sem a view (ORA-00942) cai na fato antiga e nao tenta a view de novo", async () => {
  const { runQuery, chamadas } = createFakeRunQuery({
    vw_comissao_erp_mes_atual: ORA_00942,
    ft_comissao_parametrizada: [LINHA_COMISSAO],
  })
  const load = createCommissionSnapshotLoader({ runQuery, logger: createSilentLogger() })

  const primeiro = await load({ empresaId: 22, skVendedor: 123 })
  const segundo = await load({ empresaId: 22, skVendedor: 123 })

  assert.equal(primeiro.commissionAmount, 400)
  assert.equal(primeiro.source, "oracle")
  assert.deepEqual(segundo, primeiro)
  assert.deepEqual(
    chamadas.map((c) => c.fonte),
    ["vw_comissao_erp_mes_atual", "ft_comissao_parametrizada", "ft_comissao_parametrizada"]
  )
})

test("Meta de Vida: sem nenhuma das fontes fica indisponivel (null) e nao consulta o Oracle de novo", async () => {
  const { runQuery, chamadas } = createFakeRunQuery({
    vw_comissao_erp_mes_atual: ORA_00942,
    ft_comissao_parametrizada: ORA_00942,
  })
  const logger = createSilentLogger()
  const load = createCommissionSnapshotLoader({ runQuery, logger })

  assert.equal(await load({ empresaId: 30, skVendedor: 123 }), null)
  assert.equal(await load({ empresaId: 30, skVendedor: 123 }), null)

  assert.equal(chamadas.length, 2)
  assert.equal(logger.mensagens.filter(([nivel]) => nivel === "warn").length, 1)
})

test("Meta de Vida: a fonte e guardada por organizacao, sem misturar uma com a outra", async () => {
  const respostas = {
    vw_comissao_erp_mes_atual: [LINHA_COMISSAO],
    ft_comissao_parametrizada: [LINHA_COMISSAO],
  }
  const chamadas = []
  async function runQuery(sql, binds, options) {
    const fonte = sql.match(/FROM (\w+) com/)[1]
    chamadas.push(fonte)
    if (binds.sk_vendedor === 999 && fonte === "vw_comissao_erp_mes_atual") throw ORA_00942
    return respostas[fonte]
  }
  const sourceByEmpresa = new Map()
  const load = createCommissionSnapshotLoader({ runQuery, sourceByEmpresa, logger: createSilentLogger() })

  await load({ empresaId: 19, skVendedor: 123 })
  await load({ empresaId: 22, skVendedor: 999 })

  assert.equal(sourceByEmpresa.get(19), "vw_comissao_erp_mes_atual")
  assert.equal(sourceByEmpresa.get(22), "ft_comissao_parametrizada")
})

test("Meta de Vida: erro que nao e ORA-00942 (ex.: timeout) nao e guardado e volta a detectar", async () => {
  let falhar = true
  const chamadas = []
  async function runQuery(sql) {
    const fonte = sql.match(/FROM (\w+) com/)[1]
    chamadas.push(fonte)
    if (falhar) throw Object.assign(new Error("NJS-123: call timeout of 30000 ms exceeded"), { code: "NJS-123" })
    return [LINHA_COMISSAO]
  }
  const sourceByEmpresa = new Map()
  const load = createCommissionSnapshotLoader({ runQuery, sourceByEmpresa, logger: createSilentLogger() })

  assert.equal(await load({ empresaId: 19, skVendedor: 123 }), null)
  assert.equal(sourceByEmpresa.has(19), false)

  falhar = false
  const snapshot = await load({ empresaId: 19, skVendedor: 123 })
  assert.equal(snapshot.commissionAmount, 400)
  assert.deepEqual(chamadas, ["vw_comissao_erp_mes_atual", "vw_comissao_erp_mes_atual"])
})
