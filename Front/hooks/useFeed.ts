"use client"

import { useEffect, useState } from "react"
import type { FeedComment, FeedPost, FeedPostsResponse } from "@/lib/feed-types"
import type { AuthUser } from "@/lib/user-session"

type CommentState = {
  data: FeedComment[]
  isLoading: boolean
  isLoaded: boolean
}

interface UseFeedOptions {
  user: AuthUser | null
  pageSize?: number
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function getEmpresaId(user: AuthUser | null) {
  const value = user?.empresa_id ?? user?.sk_empresa ?? null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildActorPayload(user: AuthUser) {
  return {
    usuario_id: Number(user.id_usuario),
    nome_usuario: String(user.nome ?? user.NOME ?? "").trim(),
    tipo_usuario: user.role,
    empresa_id: Number(user.empresa_id ?? user.sk_empresa ?? 0),
  }
}

function formatDateValue(value: string | Date | null | undefined) {
  if (!value) return 0
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function sortPosts(posts: FeedPost[]) {
  return [...posts].sort((a, b) => {
    if (a.postDestaque !== b.postDestaque) {
      return a.postDestaque ? -1 : 1
    }

    return formatDateValue(b.dataPostagem) - formatDateValue(a.dataPostagem)
  })
}

async function readJsonOrThrow(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage)
  }

  return payload
}

export function useFeed({ user, pageSize = 10 }: UseFeedOptions) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [commentsByPost, setCommentsByPost] = useState<Record<number, CommentState>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)

  async function fetchPosts(offset = 0, append = false) {
    if (!user) return

    const empresaId = getEmpresaId(user)
    if (!empresaId) {
      setError("Nao foi possivel identificar a empresa do usuario.")
      return
    }

    const actor = buildActorPayload(user)
    const params = new URLSearchParams({
      usuario_id: String(actor.usuario_id),
      nome_usuario: actor.nome_usuario,
      tipo_usuario: actor.tipo_usuario,
      empresa_id: String(actor.empresa_id),
      limit: String(pageSize),
      offset: String(offset),
    })

    const response = await fetch(`/api/feed/posts?${params.toString()}`, {
      cache: "no-store",
    })
    const payload = (await readJsonOrThrow(response, "Erro ao carregar o feed.")) as FeedPostsResponse

    setPosts((current) => {
      const incoming = append ? [...current, ...payload.data] : payload.data
      const unique = Array.from(new Map(incoming.map((post) => [post.id, post])).values())
      return sortPosts(unique)
    })
    setHasMore(payload.pagination.hasMore)
    setNextOffset(payload.pagination.nextOffset)
  }

  useEffect(() => {
    let active = true

    async function loadInitialFeed() {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        await fetchPosts(0, false)
      } catch (err) {
        if (active) {
          setError(normalizeErrorMessage(err, "Erro ao carregar o feed."))
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadInitialFeed()

    return () => {
      active = false
    }
  }, [pageSize, user?.id_usuario, user?.empresa_id, user?.sk_empresa, user?.role])

  async function createPost(message: string) {
    if (!user) throw new Error("Usuario nao autenticado.")

    const actor = buildActorPayload(user)
    const tempId = Date.now() * -1
    const optimisticPost: FeedPost = {
      id: tempId,
      usuarioId: actor.usuario_id,
      nomeUsuario: actor.nome_usuario,
      tipoUsuario: actor.tipo_usuario,
      mensagem: message.trim(),
      dataPostagem: new Date().toISOString(),
      totalCurtidas: 0,
      totalComentarios: 0,
      postDestaque: false,
      curtidoPeloUsuario: false,
      canEdit: true,
      canDelete: true,
      canToggleDestaque: actor.tipo_usuario === "GERENTE",
    }

    setIsCreating(true)
    setPosts((current) => sortPosts([optimisticPost, ...current]))

    try {
      const response = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...actor, mensagem: message }),
      })
      const payload = await readJsonOrThrow(response, "Erro ao publicar post.")
      const createdPost = payload.data as FeedPost
      setPosts((current) => sortPosts(current.map((post) => (post.id === tempId ? createdPost : post))))
      return createdPost
    } catch (err) {
      setPosts((current) => current.filter((post) => post.id !== tempId))
      throw err
    } finally {
      setIsCreating(false)
    }
  }

  async function updatePost(postId: number, message: string) {
    if (!user) throw new Error("Usuario nao autenticado.")

    const actor = buildActorPayload(user)
    const previous = posts.find((post) => post.id === postId)
    if (!previous) return

    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, mensagem: message.trim() } : post)))

    try {
      const response = await fetch(`/api/feed/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...actor, mensagem: message }),
      })
      const payload = await readJsonOrThrow(response, "Erro ao editar post.")
      const updatedPost = payload.data as FeedPost
      setPosts((current) => sortPosts(current.map((post) => (post.id === postId ? updatedPost : post))))
      return updatedPost
    } catch (err) {
      setPosts((current) => current.map((post) => (post.id === postId ? previous : post)))
      throw err
    }
  }

  async function deletePost(postId: number) {
    if (!user) throw new Error("Usuario nao autenticado.")

    const actor = buildActorPayload(user)
    const previousPosts = posts
    setPosts((current) => current.filter((post) => post.id !== postId))

    try {
      const response = await fetch(`/api/feed/posts/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actor),
      })
      await readJsonOrThrow(response, "Erro ao excluir post.")
      setCommentsByPost((current) => {
        const next = { ...current }
        delete next[postId]
        return next
      })
    } catch (err) {
      setPosts(previousPosts)
      throw err
    }
  }

  async function toggleLike(postId: number) {
    if (!user) throw new Error("Usuario nao autenticado.")

    const actor = buildActorPayload(user)
    const previousPosts = posts

    setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post
        const liked = !post.curtidoPeloUsuario
        return {
          ...post,
          curtidoPeloUsuario: liked,
          totalCurtidas: Math.max(post.totalCurtidas + (liked ? 1 : -1), 0),
        }
      })
    )

    try {
      const response = await fetch(`/api/feed/posts/${postId}/curtir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actor),
      })
      const payload = await readJsonOrThrow(response, "Erro ao curtir post.")
      const updatedPost = payload.data.post as FeedPost
      setPosts((current) => sortPosts(current.map((post) => (post.id === postId ? updatedPost : post))))
      return updatedPost
    } catch (err) {
      setPosts(previousPosts)
      throw err
    }
  }

  async function loadComments(postId: number, force = false) {
    if (!user) throw new Error("Usuario nao autenticado.")

    const actor = buildActorPayload(user)
    const existing = commentsByPost[postId]
    if (existing?.isLoaded && !force) {
      return existing.data
    }

    setCommentsByPost((current) => ({
      ...current,
      [postId]: {
        data: current[postId]?.data ?? [],
        isLoading: true,
        isLoaded: current[postId]?.isLoaded ?? false,
      },
    }))

    try {
      const params = new URLSearchParams({
        usuario_id: String(actor.usuario_id),
        nome_usuario: actor.nome_usuario,
        tipo_usuario: actor.tipo_usuario,
        empresa_id: String(actor.empresa_id),
      })

      const response = await fetch(`/api/feed/posts/${postId}/comentarios?${params.toString()}`, {
        cache: "no-store",
      })
      const payload = await readJsonOrThrow(response, "Erro ao carregar comentarios.")
      const comments = payload.data as FeedComment[]

      setCommentsByPost((current) => ({
        ...current,
        [postId]: {
          data: comments,
          isLoading: false,
          isLoaded: true,
        },
      }))

      return comments
    } catch (err) {
      setCommentsByPost((current) => ({
        ...current,
        [postId]: {
          data: current[postId]?.data ?? [],
          isLoading: false,
          isLoaded: current[postId]?.isLoaded ?? false,
        },
      }))
      throw err
    }
  }

  async function addComment(postId: number, comment: string) {
    if (!user) throw new Error("Usuario nao autenticado.")

    const actor = buildActorPayload(user)
    const previousPosts = posts
    const previousComments = commentsByPost[postId]
    const tempId = Date.now() * -1
    const optimisticComment: FeedComment = {
      id: tempId,
      postId,
      usuarioId: actor.usuario_id,
      nomeUsuario: actor.nome_usuario,
      comentario: comment.trim(),
      dataComentario: new Date().toISOString(),
    }

    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, totalComentarios: post.totalComentarios + 1 } : post)))

    if (previousComments?.isLoaded) {
      setCommentsByPost((current) => ({
        ...current,
        [postId]: {
          data: [...(current[postId]?.data ?? []), optimisticComment],
          isLoading: false,
          isLoaded: true,
        },
      }))
    }

    try {
      const response = await fetch(`/api/feed/posts/${postId}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...actor, comentario: comment }),
      })
      const payload = await readJsonOrThrow(response, "Erro ao enviar comentario.")
      const createdComment = payload.data.comment as FeedComment
      const updatedPost = payload.data.post as FeedPost

      setPosts((current) => sortPosts(current.map((post) => (post.id === postId ? updatedPost : post))))

      setCommentsByPost((current) => {
        const currentState = current[postId]
        if (!currentState?.isLoaded) return current

        return {
          ...current,
          [postId]: {
            data: currentState.data.map((item) => (item.id === tempId ? createdComment : item)),
            isLoading: false,
            isLoaded: true,
          },
        }
      })

      return createdComment
    } catch (err) {
      setPosts(previousPosts)
      if (previousComments?.isLoaded) {
        setCommentsByPost((current) => ({ ...current, [postId]: previousComments }))
      }
      throw err
    }
  }

  async function toggleHighlight(postId: number) {
    if (!user) throw new Error("Usuario nao autenticado.")

    const actor = buildActorPayload(user)
    const previousPosts = posts
    const target = posts.find((post) => post.id === postId)
    if (!target) return

    const nextHighlightState = !target.postDestaque
    setPosts((current) =>
      sortPosts(
        current.map((post) => ({
          ...post,
          postDestaque: post.id === postId ? nextHighlightState : nextHighlightState ? false : post.postDestaque,
        }))
      )
    )

    try {
      const response = await fetch(`/api/feed/posts/${postId}/destaque`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actor),
      })
      const payload = await readJsonOrThrow(response, "Erro ao atualizar destaque.")
      const updatedPost = payload.data as FeedPost
      setPosts((current) =>
        sortPosts(
          current.map((post) => {
            if (post.id === updatedPost.id) return updatedPost
            if (updatedPost.postDestaque) return { ...post, postDestaque: false }
            return post
          })
        )
      )
      return updatedPost
    } catch (err) {
      setPosts(previousPosts)
      throw err
    }
  }

  async function loadMore() {
    if (!hasMore || isLoadingMore) return

    try {
      setIsLoadingMore(true)
      await fetchPosts(nextOffset, true)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return {
    posts,
    commentsByPost,
    isLoading,
    isCreating,
    isLoadingMore,
    hasMore,
    error,
    refresh: () => fetchPosts(0, false),
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    loadComments,
    addComment,
    toggleHighlight,
    loadMore,
  }
}
