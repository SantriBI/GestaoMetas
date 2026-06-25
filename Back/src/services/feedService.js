import oracledb from "oracledb"
import { query } from "../db/oracle.js"
import { resolveOracleObjectNames } from "../db/oracleObjectNames.js"
import {
  findAuthUserForPrivateMessage,
  searchAuthUsersForPrivateMessage,
} from "./authUsersService.js"

const MAX_POST_LENGTH = 1000
const MAX_COMMENT_LENGTH = 500
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 25
const FEED_VISIBILITY_PUBLIC = "PUBLICO"
const FEED_VISIBILITY_PRIVATE = "PRIVADO"
const RECIPIENT_SEARCH_LIMIT = 10

export class FeedError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.name = "FeedError"
    this.statusCode = statusCode
  }
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  )
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toNullableNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeRole(value) {
  return String(value ?? "").trim().toUpperCase()
}

function sanitizeText(value, maxLength, fieldName) {
  const text = String(value ?? "").trim()
  if (!text) {
    throw new FeedError(`${fieldName} e obrigatorio.`)
  }

  if (text.length > maxLength) {
    throw new FeedError(`${fieldName} excede o limite de ${maxLength} caracteres.`)
  }

  return text
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
  }
}

function normalizeRecipientId(value) {
  const raw = String(value ?? "").trim()

  if (!raw) {
    return null
  }

  const destinatarioUsuarioId = Number(raw)
  if (!Number.isFinite(destinatarioUsuarioId) || destinatarioUsuarioId <= 0) {
    throw new FeedError("Destinatario invalido.", 400)
  }

  return destinatarioUsuarioId
}

function normalizeVisibility(destinatarioUsuarioId) {
  return destinatarioUsuarioId ? FEED_VISIBILITY_PRIVATE : FEED_VISIBILITY_PUBLIC
}

function normalizeVisibilityValue(value, destinatarioUsuarioId) {
  const normalized = String(value ?? "").trim().toUpperCase()

  if (normalized === FEED_VISIBILITY_PRIVATE) {
    return FEED_VISIBILITY_PRIVATE
  }

  if (normalized === FEED_VISIBILITY_PUBLIC) {
    return FEED_VISIBILITY_PUBLIC
  }

  return toNullableNumber(destinatarioUsuarioId) ? FEED_VISIBILITY_PRIVATE : FEED_VISIBILITY_PUBLIC
}

function buildVisiblePostsCondition(alias = "p") {
  return `
    ${alias}.EMPRESA_ID = :empresaId
      AND (
        NVL(${alias}.VISIBILIDADE, '${FEED_VISIBILITY_PUBLIC}') = '${FEED_VISIBILITY_PUBLIC}'
        OR ${alias}.USUARIO_ID = :usuarioId
        OR ${alias}.DESTINATARIO_USUARIO_ID = :usuarioId
      )
  `
}

function mapRecipient(row) {
  const recipient = normalizeRow(row)

  return {
    id: toNumber(recipient.id_usuario),
    nome: recipient.nome ?? "",
    login: recipient.login ?? "",
    tipoUsuario: normalizeRole(recipient.role ?? recipient.tipo_usuario),
    skVendedor: toNullableNumber(recipient.sk_vendedor),
  }
}

function mapPost(row, actor) {
  const post = normalizeRow(row)
  const isAuthor = toNumber(post.usuario_id) === actor.usuarioId
  const isGerente = actor.tipoUsuario === "GERENTE"
  const visibilidade = normalizeVisibilityValue(post.visibilidade, post.destinatario_usuario_id)
  const isPrivado = visibilidade === FEED_VISIBILITY_PRIVATE

  return {
    id: toNumber(post.id),
    usuarioId: toNumber(post.usuario_id),
    nomeUsuario: post.nome_usuario ?? "",
    tipoUsuario: normalizeRole(post.tipo_usuario),
    mensagem: post.mensagem ?? "",
    dataPostagem: post.data_postagem ?? null,
    totalCurtidas: toNumber(post.total_curtidas),
    totalComentarios: toNumber(post.total_comentarios),
    postDestaque: toNumber(post.post_destaque) === 1,
    curtidoPeloUsuario: toNumber(post.curtido_pelo_usuario) === 1,
    visibilidade,
    isPrivado,
    destinatarioUsuarioId: toNullableNumber(post.destinatario_usuario_id),
    destinatarioNome: post.destinatario_nome ?? null,
    destinatarioTipo: normalizeRole(post.destinatario_tipo) || null,
    canEdit: isAuthor,
    canDelete: isAuthor || isGerente,
    canToggleDestaque: isGerente,
  }
}

function mapComment(row) {
  const comment = normalizeRow(row)
  return {
    id: toNumber(comment.id),
    postId: toNumber(comment.post_id),
    usuarioId: toNumber(comment.usuario_id),
    nomeUsuario: comment.nome_usuario ?? "",
    comentario: comment.comentario ?? "",
    dataComentario: comment.data_comentario ?? null,
  }
}

async function getNextId(sequenceName) {
  const rows = await query(`SELECT ${sequenceName}.NEXTVAL AS ID FROM DUAL`)
  return toNumber(rows[0]?.ID ?? rows[0]?.id, 0)
}

function nvarchar(value) {
  return {
    val: String(value ?? ""),
    type: oracledb.DB_TYPE_NVARCHAR,
  }
}

async function getFeedTableNames() {
  const resolvedNames = await resolveOracleObjectNames([
    "feedPostsTable",
    "feedLikesTable",
    "feedCommentsTable",
  ])

  return {
    postsTable: resolvedNames.feedPostsTable,
    likesTable: resolvedNames.feedLikesTable,
    commentsTable: resolvedNames.feedCommentsTable,
  }
}

async function findPrivateMessageRecipient(actor, destinatarioUsuarioId) {
  if (!destinatarioUsuarioId) {
    return null
  }

  if (destinatarioUsuarioId === actor.usuarioId) {
    throw new FeedError("Escolha outro usuario para enviar a mensagem privada.", 400)
  }

  const destinatario = await findAuthUserForPrivateMessage({
    idUsuario: destinatarioUsuarioId,
    empresaId: actor.empresaId,
  })

  if (!destinatario || destinatario.ativo !== "S") {
    throw new FeedError("Nao foi possivel encontrar um destinatario ativo para a mensagem privada.", 400)
  }

  const tipoUsuario = normalizeRole(destinatario.role)
  if (tipoUsuario !== "VENDEDOR" && tipoUsuario !== "GERENTE") {
    throw new FeedError("Nao foi possivel encontrar um destinatario ativo para a mensagem privada.", 400)
  }

  return {
    usuarioId: toNumber(destinatario.id_usuario),
    nome: destinatario.nome ?? "",
    login: destinatario.login ?? "",
    tipoUsuario,
    skVendedor: toNullableNumber(destinatario.sk_vendedor),
  }
}

async function refreshPostCounters(postId) {
  const { postsTable, likesTable, commentsTable } = await getFeedTableNames()
  await query(
    `
    UPDATE ${postsTable} p
    SET
      TOTAL_CURTIDAS = (
        SELECT COUNT(*)
        FROM ${likesTable} c
        WHERE c.POST_ID = p.ID
      ),
      TOTAL_COMENTARIOS = (
        SELECT COUNT(*)
        FROM ${commentsTable} fc
        WHERE fc.POST_ID = p.ID
      )
    WHERE p.ID = :postId
    `,
    { postId }
  )
}

async function findPostRow(postId, actor) {
  const { postsTable } = await getFeedTableNames()
  const rows = await query(
    `
    SELECT
      p.ID,
      p.EMPRESA_ID,
      p.USUARIO_ID,
      p.NOME_USUARIO,
      p.TIPO_USUARIO,
      p.MENSAGEM,
      p.DATA_POSTAGEM,
      p.TOTAL_CURTIDAS,
      p.TOTAL_COMENTARIOS,
      p.POST_DESTAQUE,
      p.VISIBILIDADE,
      p.DESTINATARIO_USUARIO_ID,
      p.DESTINATARIO_NOME,
      p.DESTINATARIO_TIPO
    FROM ${postsTable} p
    WHERE p.ID = :postId
      AND ${buildVisiblePostsCondition("p")}
    FETCH FIRST 1 ROWS ONLY
    `,
    {
      postId,
      empresaId: actor.empresaId,
      usuarioId: actor.usuarioId,
    }
  )

  return rows[0] ? normalizeRow(rows[0]) : null
}

async function findPostForActor(postId, actor) {
  const { postsTable, likesTable } = await getFeedTableNames()
  const rows = await query(
    `
    SELECT
      p.ID,
      p.USUARIO_ID,
      p.NOME_USUARIO,
      p.TIPO_USUARIO,
      p.MENSAGEM,
      p.DATA_POSTAGEM,
      p.TOTAL_CURTIDAS,
      p.TOTAL_COMENTARIOS,
      p.POST_DESTAQUE,
      p.VISIBILIDADE,
      p.DESTINATARIO_USUARIO_ID,
      p.DESTINATARIO_NOME,
      p.DESTINATARIO_TIPO,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ${likesTable} c
          WHERE c.POST_ID = p.ID
            AND c.USUARIO_ID = :usuarioId
        ) THEN 1
        ELSE 0
      END AS CURTIDO_PELO_USUARIO
    FROM ${postsTable} p
    WHERE p.ID = :postId
      AND ${buildVisiblePostsCondition("p")}
    FETCH FIRST 1 ROWS ONLY
    `,
    {
      postId,
      empresaId: actor.empresaId,
      usuarioId: actor.usuarioId,
    }
  )

  if (!rows.length) {
    throw new FeedError("Post nao encontrado.", 404)
  }

  return mapPost(rows[0], actor)
}

export async function listFeedPosts(input) {
  const actor = normalizeActor(input)
  const limit = Math.min(
    Math.max(toNumber(input?.limit, DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE
  )
  const offset = Math.max(toNumber(input?.offset, 0), 0)
  const { postsTable, likesTable } = await getFeedTableNames()
  const rows = await query(
    `
    SELECT
      p.ID,
      p.USUARIO_ID,
      p.NOME_USUARIO,
      p.TIPO_USUARIO,
      p.MENSAGEM,
      p.DATA_POSTAGEM,
      p.TOTAL_CURTIDAS,
      p.TOTAL_COMENTARIOS,
      p.POST_DESTAQUE,
      p.VISIBILIDADE,
      p.DESTINATARIO_USUARIO_ID,
      p.DESTINATARIO_NOME,
      p.DESTINATARIO_TIPO,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ${likesTable} c
          WHERE c.POST_ID = p.ID
            AND c.USUARIO_ID = :usuarioId
        ) THEN 1
        ELSE 0
      END AS CURTIDO_PELO_USUARIO
    FROM ${postsTable} p
    WHERE ${buildVisiblePostsCondition("p")}
    ORDER BY p.POST_DESTAQUE DESC, p.DATA_POSTAGEM DESC, p.ID DESC
    OFFSET :offset ROWS FETCH NEXT :fetchRows ROWS ONLY
    `,
    {
      empresaId: actor.empresaId,
      usuarioId: actor.usuarioId,
      offset,
      fetchRows: limit + 1,
    }
  )

  const hasMore = rows.length > limit
  const data = rows.slice(0, limit).map((row) => mapPost(row, actor))

  return {
    data,
    pagination: {
      limit,
      offset,
      hasMore,
      nextOffset: offset + data.length,
    },
  }
}

export async function searchFeedRecipients(input) {
  const actor = normalizeActor(input)
  const termo = String(input?.termo ?? input?.term ?? "").trim()

  if (!termo) {
    return []
  }

  const rows = await searchAuthUsersForPrivateMessage({
    empresaId: actor.empresaId,
    usuarioId: actor.usuarioId,
    termo,
    limit: RECIPIENT_SEARCH_LIMIT,
  })

  return rows
    .map(mapRecipient)
    .filter((recipient) => recipient.id > 0 && (recipient.tipoUsuario === "VENDEDOR" || recipient.tipoUsuario === "GERENTE"))
}

export async function createFeedPost(input) {
  const actor = normalizeActor(input)
  const mensagem = sanitizeText(input?.mensagem, MAX_POST_LENGTH, "Mensagem")
  const destinatarioUsuarioId = normalizeRecipientId(
    input?.destinatarioUsuarioId ?? input?.destinatario_usuario_id
  )
  const visibilidade = normalizeVisibility(destinatarioUsuarioId)
  const destinatario = await findPrivateMessageRecipient(actor, destinatarioUsuarioId)
  const id = await getNextId("FEED_POSTS_SEQ")
  const { postsTable } = await getFeedTableNames()

  await query(
    `
    INSERT INTO ${postsTable} (
      ID,
      EMPRESA_ID,
      USUARIO_ID,
      NOME_USUARIO,
      TIPO_USUARIO,
      MENSAGEM,
      VISIBILIDADE,
      DESTINATARIO_USUARIO_ID,
      DESTINATARIO_NOME,
      DESTINATARIO_TIPO,
      DATA_POSTAGEM,
      TOTAL_CURTIDAS,
      TOTAL_COMENTARIOS,
      POST_DESTAQUE
    ) VALUES (
      :id,
      :empresaId,
      :usuarioId,
      :nomeUsuario,
      :tipoUsuario,
      :mensagem,
      :visibilidade,
      :destinatarioUsuarioId,
      :destinatarioNome,
      :destinatarioTipo,
      SYSDATE,
      0,
      0,
      0
    )
    `,
    {
      id,
      empresaId: actor.empresaId,
      usuarioId: actor.usuarioId,
      nomeUsuario: nvarchar(actor.nomeUsuario),
      tipoUsuario: nvarchar(actor.tipoUsuario),
      mensagem: nvarchar(mensagem),
      visibilidade,
      destinatarioUsuarioId: destinatario?.usuarioId ?? null,
      destinatarioNome: destinatario ? nvarchar(destinatario.nome) : null,
      destinatarioTipo: destinatario ? nvarchar(destinatario.tipoUsuario) : null,
    }
  )

  return findPostForActor(id, actor)
}

export async function updateFeedPost(postIdInput, input) {
  const actor = normalizeActor(input)
  const postId = toNumber(postIdInput, NaN)
  const mensagem = sanitizeText(input?.mensagem, MAX_POST_LENGTH, "Mensagem")
  const post = await findPostRow(postId, actor)
  const { postsTable } = await getFeedTableNames()

  if (!post) {
    throw new FeedError("Post nao encontrado.", 404)
  }

  if (toNumber(post.usuario_id) !== actor.usuarioId) {
    throw new FeedError("Apenas o autor pode editar este post.", 403)
  }

  await query(
    `
    UPDATE ${postsTable}
    SET MENSAGEM = :mensagem
    WHERE ID = :postId
    `,
    {
      mensagem: nvarchar(mensagem),
      postId,
    }
  )

  return findPostForActor(postId, actor)
}

export async function deleteFeedPost(postIdInput, input) {
  const actor = normalizeActor(input)
  const postId = toNumber(postIdInput, NaN)
  const post = await findPostRow(postId, actor)
  const { postsTable } = await getFeedTableNames()

  if (!post) {
    throw new FeedError("Post nao encontrado.", 404)
  }

  const isAuthor = toNumber(post.usuario_id) === actor.usuarioId
  if (!isAuthor && actor.tipoUsuario !== "GERENTE") {
    throw new FeedError("Voce nao tem permissao para excluir este post.", 403)
  }

  await query(`DELETE FROM ${postsTable} WHERE ID = :postId`, { postId })

  return { success: true }
}

export async function toggleFeedLike(postIdInput, input) {
  const actor = normalizeActor(input)
  const postId = toNumber(postIdInput, NaN)
  const { likesTable } = await getFeedTableNames()
  const post = await findPostRow(postId, actor)

  if (!post) {
    throw new FeedError("Post nao encontrado.", 404)
  }

  const existing = await query(
    `
    SELECT ID
    FROM ${likesTable}
    WHERE POST_ID = :postId
      AND USUARIO_ID = :usuarioId
    FETCH FIRST 1 ROWS ONLY
    `,
    {
      postId,
      usuarioId: actor.usuarioId,
    }
  )

  let liked
  if (existing.length) {
    await query(
      `
      DELETE FROM ${likesTable}
      WHERE POST_ID = :postId
        AND USUARIO_ID = :usuarioId
      `,
      {
        postId,
        usuarioId: actor.usuarioId,
      }
    )
    liked = false
  } else {
    const id = await getNextId("FEED_CURTIDAS_SEQ")
    await query(
      `
      INSERT INTO ${likesTable} (
        ID,
        POST_ID,
        USUARIO_ID,
        DATA_CURTIDA
      ) VALUES (
        :id,
        :postId,
        :usuarioId,
        SYSDATE
      )
      `,
      {
        id,
        postId,
        usuarioId: actor.usuarioId,
      }
    )
    liked = true
  }

  await refreshPostCounters(postId)

  return {
    liked,
    post: await findPostForActor(postId, actor),
  }
}

export async function listFeedComments(postIdInput, input) {
  const actor = normalizeActor(input)
  const postId = toNumber(postIdInput, NaN)
  const post = await findPostRow(postId, actor)
  const { commentsTable } = await getFeedTableNames()

  if (!post) {
    throw new FeedError("Post nao encontrado.", 404)
  }

  const rows = await query(
    `
    SELECT
      ID,
      POST_ID,
      USUARIO_ID,
      NOME_USUARIO,
      COMENTARIO,
      DATA_COMENTARIO
    FROM ${commentsTable}
    WHERE POST_ID = :postId
    ORDER BY DATA_COMENTARIO ASC, ID ASC
    `,
    { postId }
  )

  return rows.map(mapComment)
}

export async function createFeedComment(postIdInput, input) {
  const actor = normalizeActor(input)
  const postId = toNumber(postIdInput, NaN)
  const comentario = sanitizeText(input?.comentario, MAX_COMMENT_LENGTH, "Comentario")
  const post = await findPostRow(postId, actor)
  const { commentsTable } = await getFeedTableNames()

  if (!post) {
    throw new FeedError("Post nao encontrado.", 404)
  }

  const id = await getNextId("FEED_COMENTARIOS_SEQ")
  await query(
    `
    INSERT INTO ${commentsTable} (
      ID,
      POST_ID,
      USUARIO_ID,
      NOME_USUARIO,
      COMENTARIO,
      DATA_COMENTARIO
    ) VALUES (
      :id,
      :postId,
      :usuarioId,
      :nomeUsuario,
      :comentario,
      SYSDATE
    )
    `,
      {
        id,
        postId,
        usuarioId: actor.usuarioId,
        nomeUsuario: nvarchar(actor.nomeUsuario),
        comentario: nvarchar(comentario),
      }
    )

  await refreshPostCounters(postId)

  const rows = await query(
    `
    SELECT
      ID,
      POST_ID,
      USUARIO_ID,
      NOME_USUARIO,
      COMENTARIO,
      DATA_COMENTARIO
    FROM ${commentsTable}
    WHERE ID = :id
    FETCH FIRST 1 ROWS ONLY
    `,
    { id }
  )

  return {
    comment: mapComment(rows[0]),
    post: await findPostForActor(postId, actor),
  }
}

export async function toggleFeedHighlight(postIdInput, input) {
  const actor = normalizeActor(input)
  const postId = toNumber(postIdInput, NaN)
  const { postsTable } = await getFeedTableNames()

  if (actor.tipoUsuario !== "GERENTE") {
    throw new FeedError("Apenas gerentes podem destacar posts.", 403)
  }

  const post = await findPostRow(postId, actor)

  if (!post) {
    throw new FeedError("Post nao encontrado.", 404)
  }

  const nextValue = toNumber(post.post_destaque) === 1 ? 0 : 1
  const visibilidade = normalizeVisibilityValue(post.visibilidade, post.destinatario_usuario_id)

  if (nextValue === 1 && visibilidade === FEED_VISIBILITY_PRIVATE) {
    throw new FeedError("Posts privados nao podem ser destacados.", 400)
  }

  if (nextValue === 1) {
    await query(
      `
      UPDATE ${postsTable}
      SET POST_DESTAQUE = 0
      WHERE EMPRESA_ID = :empresaId
      `,
      { empresaId: actor.empresaId }
    )
  }

  await query(
    `
    UPDATE ${postsTable}
    SET POST_DESTAQUE = :nextValue
    WHERE ID = :postId
    `,
    {
      postId,
      nextValue,
    }
  )

  return findPostForActor(postId, actor)
}
