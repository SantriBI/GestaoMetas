import { test } from "node:test"
import assert from "node:assert/strict"
import {
  salvarPercentualGrupo,
  resolverPercentualVigentePorProduto,
  verificarSeUsuarioEhGerente,
  ParametrosPremiacaoError,
} from "../parametrosPremiacaoService.js"

const TABLE = "PARAM_PERCENTUAL_GRUPO_PREMIACAO"

/**
 * Simula o suficiente do Oracle do tenant para exercitar a regra de negocio (fechar
 * vigencia + inserir nova, resolucao por nivel mais especifico) sem depender de um
 * banco real - este ambiente nao tem acesso as credenciais Oracle para testes.
 */
function createFakeOracle({ produtos = [] } = {}) {
  const paramRows = []
  let nextId = 1

  async function query(_empresaId, sql, binds = {}) {
    const trimmed = sql.trim()

    if (trimmed.startsWith("DECLARE")) {
      const hoje = new Date()
      const dataFechamento = new Date(hoje)
      dataFechamento.setDate(dataFechamento.getDate() - 1)

      for (const row of paramRows) {
        if (row.nivel === binds.nivel && row.nomeGrupo === binds.nomeGrupo && row.dtFimVigencia === null) {
          row.dtFimVigencia = dataFechamento
        }
      }

      paramRows.push({
        id: nextId++,
        nivel: binds.nivel,
        nomeGrupo: binds.nomeGrupo,
        percentual: binds.percentual,
        dtInicioVigencia: hoje,
        dtFimVigencia: null,
      })
      return []
    }

    if (trimmed.includes("NOME_PAI_NIVEL1, NOME_PAI_NIVEL2, NOME_PAI_NIVEL3")) {
      const produto = produtos.find((p) => p.skProduto === binds.skProduto)
      return produto
        ? [{ NOME_PAI_NIVEL1: produto.nivel1 ?? null, NOME_PAI_NIVEL2: produto.nivel2 ?? null, NOME_PAI_NIVEL3: produto.nivel3 ?? null }]
        : []
    }

    if (trimmed.includes(`FROM ${TABLE}`)) {
      const vigente = paramRows.find(
        (row) => row.nivel === binds.nivel && row.nomeGrupo === binds.nomeGrupo && row.dtFimVigencia === null
      )
      return vigente ? [{ PERCENTUAL: vigente.percentual, DT_INICIO_VIGENCIA: vigente.dtInicioVigencia }] : []
    }

    throw new Error(`SQL nao esperado no fake Oracle: ${trimmed}`)
  }

  return { query, paramRows }
}

test("gerente consegue salvar um percentual em qualquer nivel (1, 2 ou 3)", async () => {
  const oracle = createFakeOracle()

  for (const nivel of [1, 2, 3]) {
    const resultado = await salvarPercentualGrupo(1, nivel, `Grupo Nivel ${nivel}`, 5.5, 42, { query: oracle.query })
    assert.equal(resultado.nivel, nivel)
    assert.equal(resultado.percentual, 5.5)
  }

  assert.equal(oracle.paramRows.length, 3)
  assert.ok(oracle.paramRows.every((row) => row.dtFimVigencia === null))
})

test("ao salvar duas vezes o mesmo (nivel, grupo), a vigencia anterior e fechada corretamente", async () => {
  const oracle = createFakeOracle()

  await salvarPercentualGrupo(1, 2, "Tintas", 10, 42, { query: oracle.query })
  await salvarPercentualGrupo(1, 2, "Tintas", 15, 42, { query: oracle.query })

  assert.equal(oracle.paramRows.length, 2)

  const [antiga, nova] = oracle.paramRows
  assert.equal(antiga.percentual, 10)
  assert.notEqual(antiga.dtFimVigencia, null)
  assert.equal(nova.percentual, 15)
  assert.equal(nova.dtFimVigencia, null)
  assert.ok(antiga.dtFimVigencia < nova.dtInicioVigencia)
})

test("resolverPercentualVigentePorProduto retorna a regra do nivel mais especifico quando ha regras em mais de um nivel", async () => {
  const oracle = createFakeOracle({
    produtos: [{ skProduto: 100, nivel1: "Construcao", nivel2: "Tintas", nivel3: "Tintas Premium" }],
  })

  await salvarPercentualGrupo(1, 1, "Construcao", 3, 42, { query: oracle.query })
  await salvarPercentualGrupo(1, 2, "Tintas", 7, 42, { query: oracle.query })

  let resolvido = await resolverPercentualVigentePorProduto(1, 100, { query: oracle.query })
  assert.equal(resolvido.nivel, 2)
  assert.equal(resolvido.percentual, 7)

  await salvarPercentualGrupo(1, 3, "Tintas Premium", 12, 42, { query: oracle.query })

  resolvido = await resolverPercentualVigentePorProduto(1, 100, { query: oracle.query })
  assert.equal(resolvido.nivel, 3)
  assert.equal(resolvido.percentual, 12)
})

test("resolverPercentualVigentePorProduto retorna null quando nenhum nivel tem regra cadastrada", async () => {
  const oracle = createFakeOracle({
    produtos: [{ skProduto: 200, nivel1: "Construcao", nivel2: "Ferramentas", nivel3: "Furadeiras" }],
  })

  const resolvido = await resolverPercentualVigentePorProduto(1, 200, { query: oracle.query })
  assert.equal(resolvido, null)
})

test("salvarPercentualGrupo rejeita nivel invalido", async () => {
  const oracle = createFakeOracle()
  await assert.rejects(
    () => salvarPercentualGrupo(1, 4, "Grupo", 5, 42, { query: oracle.query }),
    ParametrosPremiacaoError
  )
})

test("verificarSeUsuarioEhGerente retorna false para usuario sem GERENTE = 'S' em nenhuma loja", async () => {
  const ehGerente = await verificarSeUsuarioEhGerente(1, 42, {
    cpf: "11111111111",
    getLojas: async () => [{ empresaAcesso: "1", gerente: false, nomeResumido: "Loja 1", skEmpresas: "10" }],
  })
  assert.equal(ehGerente, false)
})

test("verificarSeUsuarioEhGerente retorna true quando ao menos uma loja tem GERENTE = 'S'", async () => {
  const ehGerente = await verificarSeUsuarioEhGerente(1, 42, {
    cpf: "22222222222",
    getLojas: async () => [
      { empresaAcesso: "1", gerente: false, nomeResumido: "Loja 1", skEmpresas: "10" },
      { empresaAcesso: "2", gerente: true, nomeResumido: "Loja 2", skEmpresas: "20" },
    ],
  })
  assert.equal(ehGerente, true)
})

test("verificarSeUsuarioEhGerente retorna false sem empresaId ou sem CPF resolvido", async () => {
  assert.equal(await verificarSeUsuarioEhGerente(null, 42, { cpf: "11111111111" }), false)
  assert.equal(
    await verificarSeUsuarioEhGerente(1, 42, { resolveUser: async () => null }),
    false
  )
})
