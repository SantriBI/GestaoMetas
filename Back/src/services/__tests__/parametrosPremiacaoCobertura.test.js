import { test } from "node:test"
import assert from "node:assert/strict"
import { listarGruposSemPercentual, ParametrosPremiacaoError } from "../parametrosPremiacaoService.js"

/**
 * Fake Oracle para o relatorio de cobertura (GET /grupos-sem-percentual). Reproduz em JS a
 * mesma semantica do LEFT JOIN + COALESCE + GROUP BY + HAVING da query real (ver
 * listarGruposSemPercentual em parametrosPremiacaoService.js), a partir de fixtures de itens
 * de venda e de PARAM_PERCENTUAL_GRUPO_PREMIACAO - este ambiente nao tem acesso ao Oracle real.
 */
function createFakeOracle({ itens = [], paramRows = [] } = {}) {
  async function query(_empresaId, sql, binds = {}) {
    if (!sql.includes("NIVEL_RESOLVIDO")) {
      throw new Error(`SQL nao esperado no fake Oracle de cobertura: ${sql.trim()}`)
    }

    const doMes = itens.filter((item) => item.mesReferencia === binds.mesReferencia)
    const grupos = new Map()

    for (const item of doMes) {
      const nivelResolvido = item.nivel3 ? 3 : item.nivel2 ? 2 : item.nivel1 ? 1 : null
      if (!nivelResolvido) continue
      const nomeGrupo = item.nivel3 ?? item.nivel2 ?? item.nivel1

      const vigente = (nivel, nome) =>
        paramRows.find(
          (r) =>
            r.nivel === nivel &&
            r.nomeGrupo === nome &&
            r.dtInicioVigencia <= item.dataRecebimento &&
            (r.dtFimVigencia === null || r.dtFimVigencia >= item.dataRecebimento)
        )

      const percentual =
        vigente(3, item.nivel3)?.percentual ?? vigente(2, item.nivel2)?.percentual ?? vigente(1, item.nivel1)?.percentual ?? 0

      if (percentual !== 0) continue

      const key = `${nivelResolvido}|${nomeGrupo}`
      const acc = grupos.get(key) ?? { nivel: nivelResolvido, nomeGrupo, receita: 0 }
      acc.receita += item.receita
      grupos.set(key, acc)
    }

    return [...grupos.values()]
      .filter((g) => g.receita > 0)
      .sort((a, b) => b.receita - a.receita)
      .map((g) => ({ NIVEL_RESOLVIDO: g.nivel, NOME_GRUPO: g.nomeGrupo, RECEITA_SEM_PERCENTUAL: g.receita }))
  }

  return { query }
}

test("lista grupos com receita > 0 no mes mas sem percentual cadastrado em nenhum nivel", async () => {
  const oracle = createFakeOracle({
    itens: [
      { mesReferencia: "05/2026", dataRecebimento: new Date("2026-05-05"), receita: 8000, nivel1: "Construcao", nivel2: "Ferramentas", nivel3: "Furadeiras" },
      { mesReferencia: "05/2026", dataRecebimento: new Date("2026-05-06"), receita: 50000, nivel1: "Construcao", nivel2: "Tintas", nivel3: "Tintas Premium" },
    ],
    paramRows: [
      { nivel: 3, nomeGrupo: "Tintas Premium", percentual: 0.1, dtInicioVigencia: new Date("2026-01-01"), dtFimVigencia: null },
    ],
  })

  const cobertura = await listarGruposSemPercentual(1, "2026-05", { query: oracle.query })

  assert.equal(cobertura.length, 1)
  assert.equal(cobertura[0].nivel, 3)
  assert.equal(cobertura[0].nomeGrupo, "Furadeiras")
  assert.equal(cobertura[0].receitaSemPercentual, 8000)
})

test("nao lista grupo cuja receita sem percentual somou 0 ou negativo no mes", async () => {
  const oracle = createFakeOracle({
    itens: [
      { mesReferencia: "05/2026", dataRecebimento: new Date("2026-05-05"), receita: 500, nivel1: "Construcao", nivel2: "Ferramentas", nivel3: "Furadeiras" },
      { mesReferencia: "05/2026", dataRecebimento: new Date("2026-05-06"), receita: -500, nivel1: "Construcao", nivel2: "Ferramentas", nivel3: "Furadeiras" },
    ],
    paramRows: [],
  })

  const cobertura = await listarGruposSemPercentual(1, "2026-05", { query: oracle.query })
  assert.equal(cobertura.length, 0)
})

test("rejeita formato de mes invalido", async () => {
  const oracle = createFakeOracle()
  await assert.rejects(() => listarGruposSemPercentual(1, "05/2026", { query: oracle.query }), ParametrosPremiacaoError)
  await assert.rejects(() => listarGruposSemPercentual(1, "2026-13", { query: oracle.query }), ParametrosPremiacaoError)
})
