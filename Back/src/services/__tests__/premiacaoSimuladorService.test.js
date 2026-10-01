import { test } from "node:test"
import assert from "node:assert/strict"
import {
  resolverFaixaResultante,
  simularCenario,
  calcularContadoresVenda,
  PremiacaoSimuladorError,
} from "../premiacaoSimuladorService.js"

const FAIXAS = [
  { id: 1, limiteInferior: 0, limiteSuperior: 20000, percAcelerador: 0, bonusFixoAdicional: 0 },
  { id: 2, limiteInferior: 20000, limiteSuperior: 30000, percAcelerador: 0.5, bonusFixoAdicional: 0 },
  { id: 3, limiteInferior: 30000, limiteSuperior: 40000, percAcelerador: 1, bonusFixoAdicional: 0 },
  { id: 4, limiteInferior: 40000, limiteSuperior: 50000, percAcelerador: 1.5, bonusFixoAdicional: 0 },
  { id: 5, limiteInferior: 50000, limiteSuperior: 60000, percAcelerador: 2, bonusFixoAdicional: 0 },
  { id: 6, limiteInferior: 60000, limiteSuperior: 70000, percAcelerador: 2, bonusFixoAdicional: 500 },
  { id: 7, limiteInferior: 130000, limiteSuperior: null, percAcelerador: 2, bonusFixoAdicional: 4000 },
]

test("resolverFaixaResultante: acha a faixa contigua correta pela margem+frete", () => {
  assert.equal(resolverFaixaResultante(0, FAIXAS).id, 1)
  assert.equal(resolverFaixaResultante(20000, FAIXAS).id, 1)
  assert.equal(resolverFaixaResultante(20000.01, FAIXAS).id, 2)
  assert.equal(resolverFaixaResultante(65000, FAIXAS).id, 6)
})

test("resolverFaixaResultante: cai na ultima faixa (sem teto) quando a margem excede o maior limite superior cadastrado", () => {
  assert.equal(resolverFaixaResultante(999999, FAIXAS).id, 7)
})

test("resolverFaixaResultante: retorna null quando nao ha faixas cadastradas", () => {
  assert.equal(resolverFaixaResultante(50000, []), null)
})

function baseDeps({ margemMaisFrete = 15000, valorComissaoBase = 1000, elegivel = false } = {}) {
  return {
    query: async () => [],
    buscarPremiacao: async () => ({
      margemMaisFrete,
      valorComissaoBase,
      elegivel,
      faixaAcelerador: "Ate 20.000,00",
      percAcelerador: 0,
      bonusFixoAdicional: 0,
      valorPremiacaoFinal: 0,
      faltanteGatilho: elegivel ? 0 : Math.max(0, 20000 - margemMaisFrete),
      faltanteProximaFaixa: 5000,
    }),
    buscarPercentualGrupo: async () => ({ nivel: 3, nomeGrupo: "FERRAMENTAS", percentual: 10 }),
    calcularRatio: async () => ({ ratioMargemPorReal: 0.2, receitaHistorica: 100000, margemMaisFreteHistorica: 20000 }),
    listarFaixas: async () => FAIXAS,
  }
}

test("simularCenario: converte venda adicional em margem via ratio historico e recalcula a faixa/premiacao", async () => {
  const deps = baseDeps({ margemMaisFrete: 15000, valorComissaoBase: 1000, elegivel: false })

  const resultado = await simularCenario(
    7,
    123,
    { nivel: 3, grupoNome: "FERRAMENTAS", valorVendaAdicional: 30000 },
    deps
  )

  // margemIncremental = 30000 * 0.2 = 6000 -> nova margem = 15000 + 6000 = 21000 (faixa 2, 50%)
  assert.equal(resultado.simulado.margemMaisFrete, 21000)
  assert.equal(resultado.simulado.elegivel, true)
  assert.equal(resultado.simulado.percAcelerador, 0.5)

  // comissaoBaseIncremental = 6000 * (10/100) = 600 -> nova comissao base = 1600
  assert.equal(resultado.simulado.valorComissaoBase, 1600)
  // premiacao final = 1600 * 0.5 + 0 = 800
  assert.equal(resultado.simulado.valorPremiacaoFinal, 800)
  assert.equal(resultado.diferenca.valorPremiacaoFinal, 800)
})

test("simularCenario: sem historico no grupo (ratio nulo) lanca erro 422, nao inventa numero", async () => {
  const deps = baseDeps()
  deps.calcularRatio = async () => null

  await assert.rejects(
    () => simularCenario(7, 123, { nivel: 3, grupoNome: "SEM_HISTORICO", valorVendaAdicional: 1000 }, deps),
    (error) => error instanceof PremiacaoSimuladorError && error.statusCode === 422
  )
})

test("simularCenario: sk_vendedor invalido e rejeitado antes de consultar qualquer dependencia", async () => {
  const deps = baseDeps()
  await assert.rejects(
    () => simularCenario(7, null, { nivel: 3, grupoNome: "FERRAMENTAS", valorVendaAdicional: 1000 }, deps),
    (error) => error instanceof PremiacaoSimuladorError && error.statusCode === 400
  )
})

test("calcularContadoresVenda: converte faltanteGatilho/faltanteProximaFaixa (R$ de margem) para R$ de venda usando o ratio do grupo preferido", async () => {
  const deps = {
    query: async () => [],
    buscarPremiacao: async () => ({
      margemMaisFrete: 15000,
      elegivel: false,
      faltanteGatilho: 5000,
      faltanteProximaFaixa: 15000,
    }),
    buscarGrupoPreferidoDep: async () => "FERRAMENTAS",
    calcularRatio: async () => ({ ratioMargemPorReal: 0.25 }),
  }

  const resultado = await calcularContadoresVenda(7, 123, { nivel: 3 }, deps)

  assert.deepEqual(resultado.grupoPreferido, { nivel: 3, nomeGrupo: "FERRAMENTAS" })
  assert.equal(resultado.faltanteGatilhoEmVenda, 20000) // 5000 / 0.25
  assert.equal(resultado.faltanteProximaFaixaEmVenda, 60000) // 15000 / 0.25
})

test("calcularContadoresVenda: sem grupo preferido (vendedor sem historico) devolve nulls em vez de quebrar", async () => {
  const deps = {
    query: async () => [],
    buscarPremiacao: async () => ({ margemMaisFrete: 0, elegivel: false, faltanteGatilho: 20000, faltanteProximaFaixa: null }),
    buscarGrupoPreferidoDep: async () => null,
    calcularRatio: async () => null,
  }

  const resultado = await calcularContadoresVenda(7, 123, { nivel: 3 }, deps)

  assert.equal(resultado.grupoPreferido, null)
  assert.equal(resultado.faltanteGatilhoEmVenda, null)
  assert.equal(resultado.faltanteProximaFaixaEmVenda, null)
})
