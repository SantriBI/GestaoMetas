import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { isSimuladorPremiacaoHabilitado, requireSimuladorPremiacao } from "../requireSimuladorPremiacao.js"

function createFakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
  return res
}

const valorOriginal = process.env.SIMULADOR_PREMIACAO_HABILITADO

afterEach(() => {
  if (valorOriginal === undefined) delete process.env.SIMULADOR_PREMIACAO_HABILITADO
  else process.env.SIMULADOR_PREMIACAO_HABILITADO = valorOriginal
})

test("isSimuladorPremiacaoHabilitado: desligado por padrao e para qualquer valor que nao seja true/1", () => {
  assert.equal(isSimuladorPremiacaoHabilitado({}), false)
  assert.equal(isSimuladorPremiacaoHabilitado({ SIMULADOR_PREMIACAO_HABILITADO: "" }), false)
  assert.equal(isSimuladorPremiacaoHabilitado({ SIMULADOR_PREMIACAO_HABILITADO: "false" }), false)
  assert.equal(isSimuladorPremiacaoHabilitado({ SIMULADOR_PREMIACAO_HABILITADO: "sim" }), false)
  assert.equal(isSimuladorPremiacaoHabilitado({ SIMULADOR_PREMIACAO_HABILITADO: "true" }), true)
  assert.equal(isSimuladorPremiacaoHabilitado({ SIMULADOR_PREMIACAO_HABILITADO: " TRUE " }), true)
  assert.equal(isSimuladorPremiacaoHabilitado({ SIMULADOR_PREMIACAO_HABILITADO: "1" }), true)
})

test("requireSimuladorPremiacao: desligado responde 404 'desabilitado' sem chamar o proximo handler", () => {
  delete process.env.SIMULADOR_PREMIACAO_HABILITADO
  const res = createFakeRes()
  let nextCalled = false

  requireSimuladorPremiacao({}, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.desabilitado, true)
})

test("requireSimuladorPremiacao: ligado segue para o proximo handler", () => {
  process.env.SIMULADOR_PREMIACAO_HABILITADO = "true"
  const res = createFakeRes()
  let nextCalled = false

  requireSimuladorPremiacao({}, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(res.body, null)
})
