import { test } from "node:test"
import assert from "node:assert/strict"

/**
 * Espelho em JS da logica das views VW_VALOR_BASE_PREMIACAO_VENDEDOR e
 * VW_PREMIACAO_VENDEDOR_FINAL (Back/sql/vw_premiacao_vendedor_fase2.sql).
 *
 * Isto NAO executa as views reais - este ambiente nao tem acesso as credenciais Oracle para
 * rodar CREATE VIEW/SELECT contra o banco. O objetivo aqui e validar a formula/regra de
 * negocio documentada (precedencia de nivel, item usando o percentual vigente na SUA data,
 * exemplo numerico) com um espelho fiel da mesma logica em SQL. Antes de considerar a Fase 2
 * pronta, rodar o script SQL de fato no Oracle e comparar os numeros de um vendedor real.
 */
function resolverPercentualItem(paramRows, { nivel3, nivel2, nivel1 }, dataRecebimento) {
  const vigente = (nivel, nomeGrupo) => {
    if (!nomeGrupo) return null
    const row = paramRows.find(
      (r) =>
        r.nivel === nivel &&
        r.nomeGrupo === nomeGrupo &&
        r.dtInicioVigencia <= dataRecebimento &&
        (r.dtFimVigencia === null || r.dtFimVigencia >= dataRecebimento)
    )
    return row ? row.percentual : null
  }

  return vigente(3, nivel3) ?? vigente(2, nivel2) ?? vigente(1, nivel1) ?? 0
}

function calcularValorBasePremiacao(itens, paramRows) {
  const porVendedorMes = new Map()

  for (const item of itens) {
    const percentual = resolverPercentualItem(paramRows, item, item.dataRecebimento)
    const key = `${item.vendedorId}|${item.mesReferencia}`
    const acc = porVendedorMes.get(key) ?? {
      vendedorId: item.vendedorId,
      mesReferencia: item.mesReferencia,
      valorBasePremiacao: 0,
      receitaSemPercentualCadastrado: 0,
    }

    acc.valorBasePremiacao += item.receita * (percentual / 100)
    if (percentual === 0) acc.receitaSemPercentualCadastrado += item.receita

    porVendedorMes.set(key, acc)
  }

  return [...porVendedorMes.values()]
}

function calcularValorPremiacaoFinal({ statusGatilho, valorBasePremiacao, percAcelerador, bonusFixoAdicional }) {
  if (statusGatilho === "NÃO ELEGÍVEL") return 0
  return valorBasePremiacao * percAcelerador + (bonusFixoAdicional ?? 0)
}

test("exemplo numerico documentado: R$50.000 em grupo com 0,10% e acelerador de 50% gera R$25,00", () => {
  const dataRecebimento = new Date("2026-05-10")
  const paramRows = [
    { nivel: 3, nomeGrupo: "Tintas Premium", percentual: 0.1, dtInicioVigencia: new Date("2026-01-01"), dtFimVigencia: null },
  ]

  const [resultado] = calcularValorBasePremiacao(
    [
      {
        vendedorId: 43,
        mesReferencia: "05/2026",
        receita: 50000,
        dataRecebimento,
        nivel3: "Tintas Premium",
        nivel2: "Tintas",
        nivel1: "Construcao",
      },
    ],
    paramRows
  )

  assert.equal(resultado.valorBasePremiacao, 50)

  const valorFinal = calcularValorPremiacaoFinal({
    statusGatilho: "ELEGÍVEL",
    valorBasePremiacao: resultado.valorBasePremiacao,
    percAcelerador: 0.5,
    bonusFixoAdicional: 0,
  })

  assert.equal(valorFinal, 25)
})

test("produto sem percentual cadastrado em nenhum nivel contribui 0 e aparece como receita sem cadastro", () => {
  const dataRecebimento = new Date("2026-05-15")
  const paramRows = []

  const [resultado] = calcularValorBasePremiacao(
    [
      {
        vendedorId: 35,
        mesReferencia: "05/2026",
        receita: 12000,
        dataRecebimento,
        nivel3: "Furadeiras",
        nivel2: "Ferramentas",
        nivel1: "Construcao",
      },
    ],
    paramRows
  )

  assert.equal(resultado.valorBasePremiacao, 0)
  assert.equal(resultado.receitaSemPercentualCadastrado, 12000)
})

test("percentual muda de vigencia no meio do mes: cada item usa o percentual vigente na SUA data de recebimento", () => {
  const paramRows = [
    {
      nivel: 2,
      nomeGrupo: "Tintas",
      percentual: 5,
      dtInicioVigencia: new Date("2026-05-01"),
      dtFimVigencia: new Date("2026-05-14"),
    },
    {
      nivel: 2,
      nomeGrupo: "Tintas",
      percentual: 10,
      dtInicioVigencia: new Date("2026-05-15"),
      dtFimVigencia: null,
    },
  ]

  const itens = [
    {
      vendedorId: 133,
      mesReferencia: "05/2026",
      receita: 1000,
      dataRecebimento: new Date("2026-05-10"),
      nivel3: null,
      nivel2: "Tintas",
      nivel1: "Construcao",
    },
    {
      vendedorId: 133,
      mesReferencia: "05/2026",
      receita: 1000,
      dataRecebimento: new Date("2026-05-20"),
      nivel3: null,
      nivel2: "Tintas",
      nivel1: "Construcao",
    },
  ]

  const [resultado] = calcularValorBasePremiacao(itens, paramRows)

  // Item de 10/05 usa 5% (50) e item de 20/05 usa 10% (100) - nao os 10% "atuais" para os dois.
  assert.equal(resultado.valorBasePremiacao, 50 + 100)
})

test("VALOR_PREMIACAO_FINAL e zerado quando STATUS_GATILHO = NÃO ELEGÍVEL, mesmo com valor base positivo", () => {
  const valorFinal = calcularValorPremiacaoFinal({
    statusGatilho: "NÃO ELEGÍVEL",
    valorBasePremiacao: 500,
    percAcelerador: 1,
    bonusFixoAdicional: 100,
  })

  assert.equal(valorFinal, 0)
})
