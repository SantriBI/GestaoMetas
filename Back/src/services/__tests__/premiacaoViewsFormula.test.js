import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * VW_PREMIACAO_VENDEDOR_COMISSAO_ERP (mes atual) e VW_PREMIACAO_VENDEDOR_MENSAL (todos os
 * meses, historico do gerente) tem a formula da premiacao duplicada: a fase 3 deixou de ser um
 * filtro da mensal no incidente NJS-040 (2026-10-01) para filtrar a apuracao no mes corrente
 * direto no join. Este teste le os dois scripts SQL do repo e garante que as colunas de saida e
 * as expressoes (NVL de margem/gatilho/faixa/acelerador/bonus e o CASE da premiacao final)
 * continuam identicas. Nao executa as views no Oracle.
 */
const SQL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../Back/sql")

function lerSql(arquivo) {
  return readFileSync(resolve(SQL_DIR, arquivo), "utf8")
}

// Divide a lista do SELECT nas virgulas de nivel 0 (fora de parenteses e de literais - a faixa
// 'Até 20.000,00' tem virgula dentro da string).
function dividirColunas(selectList) {
  const partes = []
  let atual = ""
  let profundidade = 0
  let emLiteral = false

  for (const char of selectList) {
    if (char === "'") emLiteral = !emLiteral
    if (!emLiteral && char === "(") profundidade += 1
    if (!emLiteral && char === ")") profundidade -= 1
    if (!emLiteral && profundidade === 0 && char === ",") {
      partes.push(atual)
      atual = ""
      continue
    }
    atual += char
  }
  partes.push(atual)
  return partes
}

function extrairColunasDaView(sqlText, viewName) {
  const match = sqlText.match(
    new RegExp(`CREATE OR REPLACE VIEW (?:DM_VENDAS\\.)?${viewName} AS\\s+SELECT([\\s\\S]*?)\\nFROM\\s`, "i")
  )
  assert.ok(match, `CREATE VIEW ${viewName} nao encontrado no script`)

  return dividirColunas(match[1]).map((parte) => {
    const expr = parte.replace(/\s+/g, " ").trim()
    const comAlias = expr.match(/^(.*) AS (\w+)$/i)
    if (comAlias) return { coluna: comAlias[2].toUpperCase(), expr: comAlias[1] }
    return { coluna: expr.split(".").pop().toUpperCase(), expr }
  })
}

function extrairCorpoDaView(sqlText, viewName) {
  const match = sqlText.match(new RegExp(`CREATE OR REPLACE VIEW (?:DM_VENDAS\\.)?${viewName} AS([\\s\\S]*?);`, "i"))
  assert.ok(match, `CREATE VIEW ${viewName} nao encontrado no script`)
  return match[1].replace(/\s+/g, " ")
}

const fase3 = extrairColunasDaView(lerSql("vw_premiacao_vendedor_fase3.sql"), "VW_PREMIACAO_VENDEDOR_COMISSAO_ERP")
const mensal = extrairColunasDaView(lerSql("vw_premiacao_vendedor_mensal.sql"), "VW_PREMIACAO_VENDEDOR_MENSAL")

test("views de premiacao: mesmas colunas de saida, na mesma ordem", () => {
  assert.deepEqual(
    fase3.map((c) => c.coluna),
    mensal.map((c) => c.coluna)
  )
})

test("views de premiacao: formula identica (NVL da apuracao e CASE da premiacao final)", () => {
  const mensalPorColuna = new Map(mensal.map((c) => [c.coluna, c.expr]))

  for (const { coluna, expr } of fase3) {
    assert.equal(expr, mensalPorColuna.get(coluna), `expressao de ${coluna} diverge entre fase 3 e mensal`)
  }
  assert.ok(fase3.some((c) => c.coluna === "VALOR_PREMIACAO_FINAL" && /^CASE /.test(c.expr)))
})

test("fase 3: filtra a apuracao no mes corrente com constante e nao le da view mensal (incidente NJS-040)", () => {
  const corpo = extrairCorpoDaView(lerSql("vw_premiacao_vendedor_fase3.sql"), "VW_PREMIACAO_VENDEDOR_COMISSAO_ERP")

  assert.match(corpo, /LEFT JOIN VW_APURACAO_PREMIACAO_VENDEDOR ap/i)
  assert.match(corpo, /ap\.MES_REFERENCIA = TO_CHAR\(SYSDATE, 'MM\/YYYY'\)/i)
  assert.match(corpo, /FROM VW_COMISSAO_ERP_MES_ATUAL com/i)
  assert.doesNotMatch(corpo, /VW_PREMIACAO_VENDEDOR_MENSAL/i)
})
