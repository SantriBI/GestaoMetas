import { test } from "node:test"
import assert from "node:assert/strict"
import { requireFeature } from "../requireFeature.js"

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

test("organizacao sem featureComissoesHabilitada recebe 403 mesmo autenticada e com GERENTE", () => {
  const middleware = requireFeature("COMISSOES")
  const req = { auth: { empresa_id: 1, role: "GERENTE", featureComissoesHabilitada: false } }
  const res = createFakeRes()
  let nextCalled = false

  middleware(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
  assert.ok(res.body.error)
})

test("organizacao com featureComissoesHabilitada segue para o proximo handler normalmente", () => {
  const middleware = requireFeature("COMISSOES")
  const req = { auth: { empresa_id: 1, role: "GERENTE", featureComissoesHabilitada: true } }
  const res = createFakeRes()
  let nextCalled = false

  middleware(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

test("requisicao sem req.auth recebe 401", () => {
  const middleware = requireFeature("COMISSOES")
  const req = {}
  const res = createFakeRes()
  let nextCalled = false

  middleware(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
})

test("feature desconhecida lanca erro ao registrar a rota", () => {
  assert.throws(() => requireFeature("ALGO_QUE_NAO_EXISTE"))
})
