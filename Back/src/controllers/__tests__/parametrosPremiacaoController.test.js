import { test } from "node:test"
import assert from "node:assert/strict"
import { createParametrosPremiacaoController } from "../parametrosPremiacaoController.js"
import { ParametrosPremiacaoError } from "../../services/parametrosPremiacaoService.js"

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

test("usuario nao-gerente recebe 403 ao tentar POST", async () => {
  const salvarPercentual = async () => {
    throw new Error("nao deveria ser chamado quando o usuario nao e gerente")
  }
  const controller = createParametrosPremiacaoController({
    verificarGerente: async () => false,
    salvarPercentual,
  })

  const req = {
    auth: { empresa_id: 1, id_usuario: 42, cpf: "11111111111" },
    params: { nivel: "1", nomeGrupo: "Tintas" },
    body: { percentual: 5 },
  }
  const res = createFakeRes()

  await controller.postPercentualGrupo(req, res)

  assert.equal(res.statusCode, 403)
  assert.ok(res.body.error)
})

test("usuario gerente consegue salvar em qualquer nivel", async () => {
  const savedCalls = []
  const controller = createParametrosPremiacaoController({
    verificarGerente: async () => true,
    salvarPercentual: async (empresaId, nivel, nomeGrupo, percentual, usuarioId) => {
      savedCalls.push({ empresaId, nivel, nomeGrupo, percentual, usuarioId })
      return { nivel: Number(nivel), nomeGrupo, percentual: Number(percentual) }
    },
  })

  for (const nivel of ["1", "2", "3"]) {
    const req = {
      auth: { empresa_id: 1, id_usuario: 42, cpf: "22222222222" },
      params: { nivel, nomeGrupo: "Tintas" },
      body: { percentual: 8 },
    }
    const res = createFakeRes()

    await controller.postPercentualGrupo(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.data.nivel, Number(nivel))
  }

  assert.equal(savedCalls.length, 3)
})

test("erro de validacao do service vira o status http correspondente", async () => {
  const controller = createParametrosPremiacaoController({
    verificarGerente: async () => true,
    salvarPercentual: async () => {
      throw new ParametrosPremiacaoError("Nivel invalido: use 1, 2 ou 3.", 400)
    },
  })

  const req = {
    auth: { empresa_id: 1, id_usuario: 42, cpf: "22222222222" },
    params: { nivel: "9", nomeGrupo: "Tintas" },
    body: { percentual: 8 },
  }
  const res = createFakeRes()

  await controller.postPercentualGrupo(req, res)

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, "Nivel invalido: use 1, 2 ou 3.")
})
