import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { getLojasAcessoByCpf } from "./lojaAcessoService.js"
import { findAuthUserById } from "./authUsersService.js"

const TABLE = "PARAM_PERCENTUAL_GRUPO_PREMIACAO"
// Colunas reais de DIM_PRODUTOS (confirmadas via SELECT em producao): NOME_PAI_NIVEL1/2/3.
const NIVEL_COLUMNS = { 1: "NOME_PAI_NIVEL1", 2: "NOME_PAI_NIVEL2", 3: "NOME_PAI_NIVEL3" }

export class ParametrosPremiacaoError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = "ParametrosPremiacaoError"
    this.statusCode = statusCode
  }
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function normalizeNivel(nivel) {
  const parsed = Number(nivel)
  if (!NIVEL_COLUMNS[parsed]) {
    throw new ParametrosPremiacaoError("Nivel invalido: use 1, 2 ou 3.", 400)
  }
  return parsed
}

function normalizeNomeGrupo(nomeGrupo) {
  const nome = String(nomeGrupo ?? "").trim()
  if (!nome) {
    throw new ParametrosPremiacaoError("Nome do grupo e obrigatorio.", 400)
  }
  if (nome.length > 200) {
    throw new ParametrosPremiacaoError("Nome do grupo excede 200 caracteres.", 400)
  }
  return nome
}

function normalizePercentual(percentual) {
  const valor = Number(percentual)
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
    throw new ParametrosPremiacaoError("Percentual invalido: informe um numero entre 0 e 100.", 400)
  }
  return valor
}

function normalizeUsuarioId(usuarioId) {
  const parsed = Number(usuarioId)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ParametrosPremiacaoError("Usuario invalido.", 401)
  }
  return parsed
}

const MES_REFERENCIA_RE = /^(\d{4})-(\d{2})$/

// Converte o "?mes=YYYY-MM" do endpoint para o formato usado por
// VW_APURACAO_PREMIACAO_VENDEDOR / VW_VALOR_BASE_PREMIACAO_VENDEDOR ('MM/YYYY',
// confirmado via SELECT direto na view existente).
function normalizeMesReferencia(mes) {
  const match = MES_REFERENCIA_RE.exec(String(mes ?? "").trim())
  if (!match) {
    throw new ParametrosPremiacaoError("Mes invalido: use o formato YYYY-MM.", 400)
  }

  const [, ano, mesNum] = match
  if (Number(mesNum) < 1 || Number(mesNum) > 12) {
    throw new ParametrosPremiacaoError("Mes invalido: use o formato YYYY-MM.", 400)
  }

  return `${mesNum}/${ano}`
}

/**
 * Lista os grupos distintos de DIM_PRODUTOS no nivel informado, com o percentual e a data de
 * inicio da vigencia atual (se houver cadastro para o grupo).
 */
export async function listarGruposComPercentualVigente(empresaId, nivel, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new ParametrosPremiacaoError("empresa_id e obrigatorio.", 400)
  const nivelNum = normalizeNivel(nivel)
  const coluna = NIVEL_COLUMNS[nivelNum]

  const rows = await query(
    empresaId,
    `
    SELECT
      d.NOME_GRUPO,
      p.PERCENTUAL,
      p.DT_INICIO_VIGENCIA
    FROM (
      SELECT DISTINCT ${coluna} AS NOME_GRUPO
      FROM DIM_PRODUTOS
      WHERE ${coluna} IS NOT NULL
    ) d
    LEFT JOIN ${TABLE} p
      ON p.NIVEL = :nivel
     AND p.NOME_GRUPO = d.NOME_GRUPO
     AND p.DT_FIM_VIGENCIA IS NULL
    ORDER BY d.NOME_GRUPO
    `,
    { nivel: nivelNum }
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      nomeGrupo: item.nome_grupo,
      percentual: item.percentual != null ? Number(item.percentual) : null,
      vigenteDesde: item.dt_inicio_vigencia ?? null,
    }
  })
}

/**
 * Fecha a vigencia atual do (nivel, grupo) - se existir - e insere a nova em uma unica
 * chamada (bloco PL/SQL), garantindo que as duas operacoes sejam atomicas.
 */
export async function salvarPercentualGrupo(
  empresaId,
  nivel,
  nomeGrupo,
  percentual,
  usuarioId,
  { query = queryOracleByEmpresaId } = {}
) {
  if (!empresaId) throw new ParametrosPremiacaoError("empresa_id e obrigatorio.", 400)
  const nivelNum = normalizeNivel(nivel)
  const nome = normalizeNomeGrupo(nomeGrupo)
  const valor = normalizePercentual(percentual)
  const usuarioIdNum = normalizeUsuarioId(usuarioId)

  await query(
    empresaId,
    `
    DECLARE
      v_data_edicao DATE := TRUNC(SYSDATE);
    BEGIN
      UPDATE ${TABLE}
         SET DT_FIM_VIGENCIA = v_data_edicao - 1
       WHERE NIVEL = :nivel
         AND NOME_GRUPO = :nomeGrupo
         AND DT_FIM_VIGENCIA IS NULL;

      INSERT INTO ${TABLE}
        (NIVEL, NOME_GRUPO, PERCENTUAL, DT_INICIO_VIGENCIA, DT_FIM_VIGENCIA, CRIADO_POR_USUARIO_ID)
      VALUES
        (:nivel, :nomeGrupo, :percentual, v_data_edicao, NULL, :usuarioId);
    END;
    `,
    { nivel: nivelNum, nomeGrupo: nome, percentual: valor, usuarioId: usuarioIdNum },
    { autoCommit: true }
  )

  return { nivel: nivelNum, nomeGrupo: nome, percentual: valor }
}

/**
 * Resolve o percentual vigente de um produto: NIVEL 3 primeiro (mais especifico), depois
 * NIVEL 2, depois NIVEL 1. Retorna null se nenhum nivel tiver regra cadastrada.
 */
export async function resolverPercentualVigentePorProduto(empresaId, skProduto, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new ParametrosPremiacaoError("empresa_id e obrigatorio.", 400)
  const skProdutoNum = Number(skProduto)
  if (!Number.isFinite(skProdutoNum)) {
    throw new ParametrosPremiacaoError("sk_produto invalido.", 400)
  }

  const produtoRows = await query(
    empresaId,
    `
    SELECT NOME_PAI_NIVEL1, NOME_PAI_NIVEL2, NOME_PAI_NIVEL3
    FROM DIM_PRODUTOS
    WHERE SK_PRODUTO = :skProduto
    FETCH FIRST 1 ROW ONLY
    `,
    { skProduto: skProdutoNum }
  )

  const produto = produtoRows[0] ? normalizeRow(produtoRows[0]) : null
  if (!produto) return null

  const candidatos = [
    { nivel: 3, nomeGrupo: produto.nome_pai_nivel3 },
    { nivel: 2, nomeGrupo: produto.nome_pai_nivel2 },
    { nivel: 1, nomeGrupo: produto.nome_pai_nivel1 },
  ]

  for (const candidato of candidatos) {
    if (!candidato.nomeGrupo) continue

    const rows = await query(
      empresaId,
      `
      SELECT PERCENTUAL, DT_INICIO_VIGENCIA
      FROM ${TABLE}
      WHERE NIVEL = :nivel
        AND NOME_GRUPO = :nomeGrupo
        AND DT_FIM_VIGENCIA IS NULL
      FETCH FIRST 1 ROW ONLY
      `,
      { nivel: candidato.nivel, nomeGrupo: candidato.nomeGrupo }
    )

    if (rows[0]) {
      const item = normalizeRow(rows[0])
      return {
        nivel: candidato.nivel,
        nomeGrupo: candidato.nomeGrupo,
        percentual: Number(item.percentual),
        vigenteDesde: item.dt_inicio_vigencia ?? null,
      }
    }
  }

  return null
}

/**
 * Relatorio de cobertura: para um mes (YYYY-MM), lista os grupos de produto (no nivel mais
 * especifico que o proprio produto tiver: 3, senao 2, senao 1) que tiveram receita > 0 no
 * periodo mas cairam com PERCENTUAL_RESOLVIDO = 0 por falta de cadastro em
 * PARAM_PERCENTUAL_GRUPO_PREMIACAO - para o gerente saber o que ainda falta cadastrar na tela
 * de Comissoes. Usa a mesma logica de resolucao por precedencia (COALESCE de 3 LEFT JOINs) da
 * VW_VALOR_BASE_PREMIACAO_VENDEDOR, mas agrupada por grupo (nao por vendedor) - por isso e uma
 * query avulsa aqui, e nao mais uma leitura da view (que so expoe o total agregado por vendedor).
 */
export async function listarGruposSemPercentual(empresaId, mes, { query = queryOracleByEmpresaId } = {}) {
  if (!empresaId) throw new ParametrosPremiacaoError("empresa_id e obrigatorio.", 400)
  const mesReferencia = normalizeMesReferencia(mes)

  const rows = await query(
    empresaId,
    `
    SELECT
      COALESCE(
        CASE WHEN itens.NOME_PAI_NIVEL3 IS NOT NULL THEN 3 END,
        CASE WHEN itens.NOME_PAI_NIVEL2 IS NOT NULL THEN 2 END,
        CASE WHEN itens.NOME_PAI_NIVEL1 IS NOT NULL THEN 1 END
      ) AS NIVEL_RESOLVIDO,
      COALESCE(itens.NOME_PAI_NIVEL3, itens.NOME_PAI_NIVEL2, itens.NOME_PAI_NIVEL1) AS NOME_GRUPO,
      SUM(itens.RECEITA_COM_DEV_NEGATIVO) AS RECEITA_SEM_PERCENTUAL
    FROM (
      SELECT
        f.SK_PRODUTO,
        CASE
          WHEN f.TIPO = 'DEV' THEN NVL(f.VALOR_LIQUIDO_ITEM, 0) * -1
          ELSE NVL(f.VALOR_LIQUIDO_ITEM, 0)
        END AS RECEITA_COM_DEV_NEGATIVO,
        TO_DATE(TO_CHAR(f.SK_DT_RECEBIMENTO), 'YYYYMMDD') AS DATA_RECEBIMENTO,
        p.NOME_PAI_NIVEL1,
        p.NOME_PAI_NIVEL2,
        p.NOME_PAI_NIVEL3
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      JOIN DM_VENDAS.DIM_PRODUTOS p
        ON p.SK_PRODUTO = f.SK_PRODUTO
      WHERE f.SK_DT_RECEBIMENTO IS NOT NULL
        AND TO_CHAR(TO_DATE(TO_CHAR(f.SK_DT_RECEBIMENTO), 'YYYYMMDD'), 'MM/YYYY') = :mesReferencia
    ) itens
    LEFT JOIN ${TABLE} pn3
      ON pn3.NIVEL = 3
     AND pn3.NOME_GRUPO = itens.NOME_PAI_NIVEL3
     AND pn3.DT_INICIO_VIGENCIA <= itens.DATA_RECEBIMENTO
     AND (pn3.DT_FIM_VIGENCIA IS NULL OR pn3.DT_FIM_VIGENCIA >= itens.DATA_RECEBIMENTO)
    LEFT JOIN ${TABLE} pn2
      ON pn2.NIVEL = 2
     AND pn2.NOME_GRUPO = itens.NOME_PAI_NIVEL2
     AND pn2.DT_INICIO_VIGENCIA <= itens.DATA_RECEBIMENTO
     AND (pn2.DT_FIM_VIGENCIA IS NULL OR pn2.DT_FIM_VIGENCIA >= itens.DATA_RECEBIMENTO)
    LEFT JOIN ${TABLE} pn1
      ON pn1.NIVEL = 1
     AND pn1.NOME_GRUPO = itens.NOME_PAI_NIVEL1
     AND pn1.DT_INICIO_VIGENCIA <= itens.DATA_RECEBIMENTO
     AND (pn1.DT_FIM_VIGENCIA IS NULL OR pn1.DT_FIM_VIGENCIA >= itens.DATA_RECEBIMENTO)
    WHERE COALESCE(pn3.PERCENTUAL, pn2.PERCENTUAL, pn1.PERCENTUAL, 0) = 0
    GROUP BY
      COALESCE(
        CASE WHEN itens.NOME_PAI_NIVEL3 IS NOT NULL THEN 3 END,
        CASE WHEN itens.NOME_PAI_NIVEL2 IS NOT NULL THEN 2 END,
        CASE WHEN itens.NOME_PAI_NIVEL1 IS NOT NULL THEN 1 END
      ),
      COALESCE(itens.NOME_PAI_NIVEL3, itens.NOME_PAI_NIVEL2, itens.NOME_PAI_NIVEL1)
    HAVING SUM(itens.RECEITA_COM_DEV_NEGATIVO) > 0
    ORDER BY RECEITA_SEM_PERCENTUAL DESC
    `,
    { mesReferencia }
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      nivel: Number(item.nivel_resolvido),
      nomeGrupo: item.nome_grupo,
      receitaSemPercentual: Number(item.receita_sem_percentual),
    }
  })
}

/**
 * Revalida contra FATO_FUNCIONARIOS_ACESSOS (nunca confia no role vindo do cliente): busca o CPF
 * do usuario do token e verifica se ele tem GERENTE = 'S' em pelo menos uma loja da organizacao.
 * Aceita cpf ja resolvido (req.auth.cpf) para evitar um lookup redundante.
 *
 * Fallback: o ERP nem sempre marca GERENTE='S' para gerentes recem-cadastrados no app (flag fora
 * do controle deste sistema). Quando isso acontece, aceita tambem quem o admin ja cadastrou como
 * GERENTE no app (role, vindo do token assinado pelo servidor - nao do cliente) desde que o CPF
 * exista de fato em FATO_FUNCIONARIOS_ACESSOS (confirma vinculo real com a organizacao no ERP).
 */
export async function verificarSeUsuarioEhGerente(
  empresaId,
  usuarioId,
  { cpf = null, role = null, getLojas = getLojasAcessoByCpf, resolveUser = findAuthUserById } = {}
) {
  if (!empresaId) return false

  let resolvedCpf = cpf
  if (!resolvedCpf) {
    const usuario = await resolveUser(usuarioId, empresaId)
    resolvedCpf = usuario?.cpf ?? null
  }

  if (!resolvedCpf) return false

  const lojas = await getLojas(empresaId, resolvedCpf)
  if (lojas.some((loja) => loja.gerente)) return true

  return String(role ?? "").toUpperCase() === "GERENTE" && lojas.length > 0
}
