// Backfill: o kanban de carteira so e sincronizado quando o vendedor abre a tela (getBoard chama
// sincronizarKanban so para o skVendedor da requisicao) - por isso CRM_KANBAN_CARD so tem linhas
// dos vendedores que ja acessaram o board. Este script roda a sincronizacao proativamente para
// todo vendedor com sinal pendente (orcamento recente, campanha de ativacao recente ou card ja
// existente), em todas as empresas ativas.
//
// Rodar com: node Back/scripts/sincronizarKanbanTodosVendedores.js

import "../src/config/env.js"
import pLimit from "p-limit"
import pool from "../src/db/mysql.js"
import { queryOracleByEmpresaId } from "../src/db/oracle-tenants.js"
import { sincronizarKanban, listarVendedoresComSinalPendente } from "../src/services/kanban/kanbanSyncService.js"

const CONCORRENCIA_VENDEDORES = 5
const FILTRO_EMPRESA_ID = process.argv[2] ? Number(process.argv[2]) : null

async function listarEmpresasAtivas() {
  const [rows] = await pool.query(
    "SELECT id_organizacao FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL"
  )
  return rows.map((row) => row.id_organizacao)
}

async function sincronizarEmpresa(empresaId) {
  const dbQuery = (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options)

  const vendedores = await listarVendedoresComSinalPendente(dbQuery)
  console.log(`[empresa ${empresaId}] ${vendedores.length} vendedor(es) com sinal pendente.`)

  const limit = pLimit(CONCORRENCIA_VENDEDORES)
  let sincronizados = 0

  await Promise.all(
    vendedores.map((skVendedor) =>
      limit(async () => {
        const inicio = Date.now()
        console.log(`[empresa ${empresaId}] vendedor ${skVendedor}: iniciando...`)
        try {
          await sincronizarKanban({ dbQuery, empresaId, skVendedor })
          sincronizados += 1
          console.log(`[empresa ${empresaId}] vendedor ${skVendedor}: ok em ${Date.now() - inicio}ms.`)
        } catch (error) {
          console.error(`[empresa ${empresaId}] erro ao sincronizar vendedor ${skVendedor} (${Date.now() - inicio}ms):`, error)
        }
      })
    )
  )

  return sincronizados
}

async function main() {
  const empresas = FILTRO_EMPRESA_ID ? [FILTRO_EMPRESA_ID] : await listarEmpresasAtivas()
  console.log(`Encontradas ${empresas.length} empresa(s) ativa(s) para sincronizar.`)

  let total = 0
  for (const empresaId of empresas) {
    try {
      const sincronizados = await sincronizarEmpresa(empresaId)
      total += sincronizados
      console.log(`Empresa ${empresaId}: ${sincronizados} vendedor(es) sincronizado(s).`)
    } catch (error) {
      console.error(`Erro ao processar empresa ${empresaId}:`, error)
    }
  }

  console.log(`Concluido. Total de vendedores sincronizados: ${total}.`)
  process.exit(0)
}

main()
