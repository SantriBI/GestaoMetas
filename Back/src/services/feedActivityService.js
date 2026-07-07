import { FeedError } from "./feedService.js"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"

const FEED_VISIBILITY_PUBLIC = "PUBLICO"

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildVisiblePostsCondition(alias = "p") {
  return `
    (
      NVL(${alias}.VISIBILIDADE, '${FEED_VISIBILITY_PUBLIC}') = '${FEED_VISIBILITY_PUBLIC}'
      OR ${alias}.USUARIO_ID = :usuarioId
      OR ${alias}.DESTINATARIO_USUARIO_ID = :usuarioId
    )
  `
}

function normalizeRole(value) {
  return String(value ?? "").trim().toUpperCase()
}

function normalizeActor(actor) {
  const usuarioId = toNumber(actor?.usuarioId ?? actor?.usuario_id, NaN)
  const empresaId = toNumber(actor?.empresaId ?? actor?.empresa_id, NaN)
  const nomeUsuario = String(actor?.nomeUsuario ?? actor?.nome_usuario ?? "").trim()
  const tipoUsuario = normalizeRole(actor?.tipoUsuario ?? actor?.tipo_usuario)

  if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
    throw new FeedError("Usuario invalido.", 401)
  }

  if (!Number.isFinite(empresaId) || empresaId <= 0) {
    throw new FeedError("Empresa invalida.", 400)
  }

  if (!nomeUsuario) {
    throw new FeedError("Nome do usuario e obrigatorio.", 400)
  }

  if (tipoUsuario !== "VENDEDOR" && tipoUsuario !== "GERENTE") {
    throw new FeedError("Tipo de usuario invalido.", 400)
  }

  return {
    usuarioId,
    empresaId,
    nomeUsuario,
    tipoUsuario,
    query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
  }
}

function normalizeSince(value) {
  const raw = String(value ?? "").trim()
  if (!raw) {
    throw new FeedError("Parametro 'since' e obrigatorio.", 400)
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    throw new FeedError("Parametro 'since' invalido.", 400)
  }

  return parsed
}

export async function getFeedActivityCount(input) {
  const actor = normalizeActor(input)
  const since = normalizeSince(input?.since)
  const postsTable = "FEED_POSTS"
  const commentsTable = "FEED_COMENTARIOS"
  const likesTable = "FEED_CURTIDAS"

  const rows = await actor.query(
    `
    SELECT
      (
        SELECT COUNT(*)
        FROM ${postsTable} p
        WHERE p.EMPRESA_ID = :empresaId
          AND ${buildVisiblePostsCondition("p")}
          AND p.DATA_POSTAGEM > :sinceDate
          AND p.USUARIO_ID <> :usuarioId
      ) +
      (
        SELECT COUNT(*)
        FROM ${commentsTable} c
        JOIN ${postsTable} p
          ON p.ID = c.POST_ID
        WHERE p.EMPRESA_ID = :empresaId
          AND ${buildVisiblePostsCondition("p")}
          AND c.DATA_COMENTARIO > :sinceDate
          AND c.USUARIO_ID <> :usuarioId
      ) +
      (
        SELECT COUNT(*)
        FROM ${likesTable} l
        JOIN ${postsTable} p
          ON p.ID = l.POST_ID
        WHERE p.EMPRESA_ID = :empresaId
          AND ${buildVisiblePostsCondition("p")}
          AND l.DATA_CURTIDA > :sinceDate
          AND l.USUARIO_ID <> :usuarioId
      ) AS TOTAL
    FROM DUAL
    `,
    {
      empresaId: actor.empresaId,
      usuarioId: actor.usuarioId,
      sinceDate: since,
    }
  )

  return {
    total: toNumber(rows[0]?.TOTAL ?? rows[0]?.total, 0),
    since: since.toISOString(),
  }
}
