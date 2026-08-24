import { test } from "node:test"
import assert from "node:assert/strict"
import { createPremiacaoVendedorController } from "../premiacaoVendedorController.js"

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

test("getPremiacaoEquipe: usuario nao-gerente recebe 403 e o service nao e chamado", async () => {
  const listarEquipe = async () => {
    throw new Error("nao deveria ser chamado quando o usuario nao e gerente")
  }
  const controller = createPremiacaoVendedorController({
    verificarGerente: async () => false,
    listarEquipe,
  })

  const req = { auth: { empresa_id: 1, id_usuario: 42, cpf: "11111111111" }, query: {} }
  const res = createFakeRes()

  await controller.getPremiacaoEquipe(req, res)

  assert.equal(res.statusCode, 403)
  assert.ok(res.body.error)
})

test("getPremiacaoEquipe: loja fora do escopo do gerente vira o erro do getScopedLojaScope (403)", async () => {
  const listarEquipe = async () => {
    throw new Error("nao deveria ser chamado quando o escopo de loja tem erro")
  }
  const controller = createPremiacaoVendedorController({
    verificarGerente: async () => true,
    resolverLojaScope: async () => ({
      applies: false,
      lojaIds: null,
      error: { status: 403, message: "Loja fora do escopo de acesso do usuario autenticado." },
    }),
    listarEquipe,
  })

  const req = { auth: { empresa_id: 1, id_usuario: 42, cpf: "22222222222" }, query: { empresa_acesso: "9" } }
  const res = createFakeRes()

  await controller.getPremiacaoEquipe(req, res)

  assert.equal(res.statusCode, 403)
  assert.match(res.body.error, /fora do escopo/)
})

test("getPremiacaoEquipe: gerente valido recebe o resultado do service, com o lojaScope resolvido repassado", async () => {
  const chamadas = []
  const resultadoFake = { vendedores: [{ nomeVendedor: "Fulano" }], resumo: { totalVendedores: 1 } }
  const lojaScopeFake = { applies: true, lojaIds: [541, 542], error: null }

  const controller = createPremiacaoVendedorController({
    verificarGerente: async () => true,
    resolverLojaScope: async () => lojaScopeFake,
    listarEquipe: async (empresaId, lojaScope) => {
      chamadas.push({ empresaId, lojaScope })
      return resultadoFake
    },
  })

  const req = { auth: { empresa_id: 7, id_usuario: 42, cpf: "33333333333" }, query: { empresa_acesso: "TODAS" } }
  const res = createFakeRes()

  await controller.getPremiacaoEquipe(req, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.data, resultadoFake)
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].empresaId, 7)
  assert.deepEqual(chamadas[0].lojaScope, lojaScopeFake)
})
