import {
  FeedError,
  createFeedComment,
  createFeedPost,
  deleteFeedPost,
  listFeedComments,
  listFeedPosts,
  searchFeedRecipients,
  toggleFeedHighlight,
  toggleFeedLike,
  updateFeedPost,
} from "../services/feedService.js"
import { getFeedActivityCount } from "../services/feedActivityService.js"

function getSource(req) {
  if (req.method === "GET") return req.query
  return req.body ?? {}
}

function getActorFromRequest(req) {
  const source = getSource(req)
  return {
    usuario_id: source.usuario_id,
    nome_usuario: source.nome_usuario,
    tipo_usuario: source.tipo_usuario,
    empresa_id: source.empresa_id,
  }
}

function handleFeedError(res, error, fallbackMessage) {
  if (error instanceof FeedError) {
    return res.status(error.statusCode).json({ error: error.message })
  }

  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

export async function getFeedPosts(req, res) {
  try {
    const payload = {
      ...getActorFromRequest(req),
      limit: req.query.limit,
      offset: req.query.offset,
    }
    res.json(await listFeedPosts(payload))
  } catch (error) {
    handleFeedError(res, error, "Erro ao buscar posts do feed.")
  }
}

export async function getFeedActivityCountHandler(req, res) {
  try {
    res.json({
      data: await getFeedActivityCount({
        ...getActorFromRequest(req),
        since: req.query.since,
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao buscar contador de atividades do feed.")
  }
}

export async function postFeedPost(req, res) {
  try {
    res.status(201).json({
      data: await createFeedPost({
        ...getActorFromRequest(req),
        mensagem: req.body?.mensagem,
        destinatario_usuario_id: req.body?.destinatario_usuario_id,
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao publicar post no feed.")
  }
}

export async function getFeedRecipients(req, res) {
  try {
    res.json({
      data: await searchFeedRecipients({
        ...getActorFromRequest(req),
        termo: req.query.termo,
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao buscar usuarios para mensagem privada.")
  }
}

export async function putFeedPost(req, res) {
  try {
    res.json({
      data: await updateFeedPost(req.params.id, {
        ...getActorFromRequest(req),
        mensagem: req.body?.mensagem,
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao atualizar post no feed.")
  }
}

export async function deleteFeedPostHandler(req, res) {
  try {
    res.json(
      await deleteFeedPost(req.params.id, {
        ...getActorFromRequest(req),
      })
    )
  } catch (error) {
    handleFeedError(res, error, "Erro ao excluir post do feed.")
  }
}

export async function postFeedLike(req, res) {
  try {
    res.json({
      data: await toggleFeedLike(req.params.id, {
        ...getActorFromRequest(req),
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao curtir post do feed.")
  }
}

export async function getFeedComments(req, res) {
  try {
    res.json({
      data: await listFeedComments(req.params.id, {
        ...getActorFromRequest(req),
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao buscar comentarios do feed.")
  }
}

export async function postFeedComment(req, res) {
  try {
    res.status(201).json({
      data: await createFeedComment(req.params.id, {
        ...getActorFromRequest(req),
        comentario: req.body?.comentario,
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao comentar no feed.")
  }
}

export async function postFeedHighlight(req, res) {
  try {
    res.json({
      data: await toggleFeedHighlight(req.params.id, {
        ...getActorFromRequest(req),
      }),
    })
  } catch (error) {
    handleFeedError(res, error, "Erro ao destacar post do feed.")
  }
}
