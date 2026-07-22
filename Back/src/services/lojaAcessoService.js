import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { getLojasManuaisPorUsuario, resolveLojasByCodigos } from "./gerenteLojasService.js"

const ACCESS_TABLE = "FATO_FUNCIONARIOS_ACESSOS"

function normalizeCpf(value) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function pickColumn(columns, candidates) {
  const available = new Set(columns.map((column) => String(column).toUpperCase()))
  return candidates.find((candidate) => available.has(candidate)) ?? null
}

const columnCache = new Map()

async function resolveAccessColumns(empresaId) {
  if (columnCache.has(empresaId)) {
    return columnCache.get(empresaId)
  }

  const rows = await queryOracleByEmpresaId(
    empresaId,
    `
    SELECT column_name
    FROM all_tab_columns
    WHERE table_name = '${ACCESS_TABLE}'
    `
  )
  const columns = rows.map((row) => row.COLUMN_NAME ?? row.column_name).filter(Boolean)

  const resolved = {
    cpfColumn: pickColumn(columns, ["CPF_CNPJ_SEM_PONTOS", "CPF", "CPF_CNPJ"]),
    empresaAcessoColumn: pickColumn(columns, ["EMPRESA_ACESSO"]),
    nomeResumidoColumn: pickColumn(columns, ["NOME_RESUMIDO"]),
    gerenteColumn: pickColumn(columns, ["GERENTE"]),
  }

  // So cacheia se a resolucao deu certo; caso contrario tentamos de novo na proxima chamada
  // (evita fixar "coluna nao encontrada" caso a query de colunas tenha falhado por instabilidade transitoria).
  if (resolved.cpfColumn && resolved.empresaAcessoColumn && resolved.gerenteColumn) {
    columnCache.set(empresaId, resolved)
  }

  return resolved
}

/**
 * Lista as lojas (EMPRESA_ACESSO) as quais o CPF tem acesso, com o rotulo (NOME_RESUMIDO)
 * e a flag de gerente por loja. Uma linha por loja: nunca agrupar CPF junto com NOME_RESUMIDO/
 * EMPRESA_ACESSO, senao cada grupo fica com no maximo 1 loja e o multi-loja nunca e detectado.
 */
export async function getLojasAcessoByCpf(empresaId, cpf) {
  const cpfNorm = normalizeCpf(cpf)
  if (!empresaId || cpfNorm.length !== 11) return []

  const columns = await resolveAccessColumns(empresaId)
  if (!columns.cpfColumn || !columns.empresaAcessoColumn || !columns.gerenteColumn) {
    return []
  }

  const nomeResumidoExpr = columns.nomeResumidoColumn
    ? `FAT.${columns.nomeResumidoColumn}`
    : `TO_CHAR(FAT.${columns.empresaAcessoColumn})`

  // FAT.EMPRESA_ACESSO e um codigo de cadastro (1, 2, 3...) - nao e o mesmo dominio de
  // SK_EMPRESA/SK_EMPRESAS usado nas views de venda/ranking (ex.: 541, 552...). O join com
  // DIM_EMPRESAS (EMPRESA_ID = EMPRESA_ACESSO) resolve o SK_EMPRESAS real, que e o valor que
  // precisa ir no filtro de loja aplicado as tabelas de fato (ver buildLojaInCondition).
  const rows = await queryOracleByEmpresaId(
    empresaId,
    `
    SELECT
      FAT.${columns.empresaAcessoColumn} AS empresa_acesso,
      ${nomeResumidoExpr} AS nome_resumido,
      MAX(CASE WHEN FAT.${columns.gerenteColumn} = 'S' THEN 'S' ELSE 'N' END) AS gerente,
      MAX(EMP.SK_EMPRESAS) AS sk_empresas
    FROM ${ACCESS_TABLE} FAT
    LEFT JOIN DIM_EMPRESAS EMP
      ON EMP.EMPRESA_ID = FAT.${columns.empresaAcessoColumn}
    WHERE REGEXP_REPLACE(FAT.${columns.cpfColumn}, '[^0-9]', '') = :cpf
    GROUP BY FAT.${columns.empresaAcessoColumn}, ${nomeResumidoExpr}
    ORDER BY FAT.${columns.empresaAcessoColumn}
    `,
    { cpf: cpfNorm }
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      empresaAcesso: String(item.empresa_acesso),
      nomeResumido: item.nome_resumido ? String(item.nome_resumido) : String(item.empresa_acesso),
      gerente: String(item.gerente ?? "N").toUpperCase() === "S",
      skEmpresas: item.sk_empresas !== null && item.sk_empresas !== undefined ? String(item.sk_empresas) : null,
    }
  })
}

/**
 * Lojas liberadas manualmente por um admin (tabela gerente_lojas_liberadas) para o gerente
 * dono de idUsuario, resolvidas com nome_resumido/sk_empresas atuais via DIM_EMPRESAS. Lojas ja
 * presentes em `automaticas` sao ignoradas aqui (evita roundtrip Oracle redundante) - a uniao
 * final e feita por getLojasForRole.
 */
async function getLojasManuaisResolvidas(empresaId, idUsuario, automaticas) {
  const manuais = await getLojasManuaisPorUsuario(empresaId, idUsuario)
  if (!manuais.length) return []

  const jaAutomaticas = new Set(automaticas.map((loja) => loja.empresaAcesso))
  const codigosExtras = manuais.map((loja) => loja.empresaAcesso).filter((codigo) => !jaAutomaticas.has(codigo))
  if (!codigosExtras.length) return []

  return resolveLojasByCodigos(empresaId, codigosExtras)
}

/**
 * Mesma lista de getLojasAcessoByCpf, mas ja recortada pelo papel do usuario:
 * - VENDEDOR: todas as lojas onde o CPF aparece (independente da flag GERENTE).
 * - GERENTE: lojas onde GERENTE = 'S' (automaticas, sempre presentes) + lojas liberadas
 *   manualmente por um admin em gerente_lojas_liberadas (uniao, sem duplicar por codigo).
 */
export async function getLojasForRole({ empresaId, cpf, role, idUsuario = null }) {
  const lojas = await getLojasAcessoByCpf(empresaId, cpf)
  const normalizedRole = String(role ?? "").toUpperCase()

  if (normalizedRole !== "GERENTE") {
    return lojas
  }

  const automaticas = lojas.filter((loja) => loja.gerente)
  if (!idUsuario) return automaticas

  const manuais = await getLojasManuaisResolvidas(empresaId, idUsuario, automaticas).catch(() => [])
  return [...automaticas, ...manuais]
}
