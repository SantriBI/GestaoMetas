// Uso pontual: arquiva cards AUTOMATICO do kanban de carteira que nasceram direto em uma coluna
// terminal (CONVERTIDO/NAO_CONVERTIDO) pela regra antiga de sincronizacao, de antes de existir a
// regra "rastreio so daqui pra frente" (card automatico so pode nascer numa coluna aberta do funil).
// Cobre tanto cards com log de criacao (MUDANCA_COLUNA) quanto orfaos sem log nenhum.
// Nao mexe em cards MANUAL.
//
// Rodar com: node Back/scripts/limparCardsConvertidosRetroativos.js

import "../src/config/env.js"
import pool from "../src/db/mysql.js"
import { queryOracleByEmpresaId } from "../src/db/oracle-tenants.js"

const COLUNAS_TERMINAIS = ["CONVERTIDO", "NAO_CONVERTIDO"]

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

async function listarEmpresasAtivas() {
  const [rows] = await pool.query(
    "SELECT id_organizacao FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL"
  )
  return rows.map((row) => row.id_organizacao)
}

async function limparEmpresa(empresaId) {
  const dbQuery = (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options)

  const candidatos = await dbQuery(
    `
    SELECT ID, SK_VENDEDOR, SK_CLIENTE
    FROM CRM_KANBAN_CARD
    WHERE ORIGEM_STATUS = 'AUTOMATICO'
      AND ARQUIVADO = 'N'
      AND COLUNA_ATUAL IN ('CONVERTIDO', 'NAO_CONVERTIDO')
    `
  )

  let arquivados = 0

  for (const row of candidatos) {
    const card = normalizeRow(row)

    const primeiraMudancaRows = await dbQuery(
      `
      SELECT COLUNA_ORIGEM, COLUNA_DESTINO
      FROM CRM_KANBAN_INTERACAO
      WHERE CARD_ID = :card_id AND TIPO = 'MUDANCA_COLUNA'
      ORDER BY DATA ASC
      FETCH FIRST 1 ROWS ONLY
      `,
      { card_id: card.id }
    )

    const primeira = primeiraMudancaRows.length ? normalizeRow(primeiraMudancaRows[0]) : null

    // Orfao (sem nenhum log) ou primeira mudanca de coluna ja nasceu sem origem numa coluna terminal:
    // nunca passou por uma coluna aberta do funil.
    const nasceuDiretoEmTerminal =
      !primeira || (!primeira.coluna_origem && COLUNAS_TERMINAIS.includes(primeira.coluna_destino))

    if (!nasceuDiretoEmTerminal) continue

    await dbQuery(`UPDATE CRM_KANBAN_CARD SET ARQUIVADO = 'S', DATA_ULTIMA_ATUALIZACAO = SYSDATE WHERE ID = :id`, {
      id: card.id,
    })

    arquivados += 1
    console.log(
      `[empresa ${empresaId}] card ${card.id} (sk_vendedor=${card.sk_vendedor}, sk_cliente=${card.sk_cliente}) arquivado.`
    )
  }

  return arquivados
}

async function main() {
  const empresas = await listarEmpresasAtivas()
  console.log(`Encontradas ${empresas.length} empresa(s) ativa(s) para verificar.`)

  let total = 0
  for (const empresaId of empresas) {
    try {
      const arquivados = await limparEmpresa(empresaId)
      total += arquivados
      console.log(`Empresa ${empresaId}: ${arquivados} card(s) arquivado(s).`)
    } catch (error) {
      console.error(`Erro ao processar empresa ${empresaId}:`, error)
    }
  }

  console.log(`Concluido. Total de cards arquivados: ${total}.`)
  process.exit(0)
}

main()
