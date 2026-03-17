"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, Flame, Sparkles, Trophy } from "lucide-react"
import { FeedComposer } from "@/components/feed/FeedComposer"
import { FeedList } from "@/components/feed/FeedList"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { useFeed } from "@/hooks/useFeed"
import { toast } from "@/hooks/use-toast"
import { markFeedAsSeen } from "@/lib/feed-activity"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"

export default function FeedPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const {
    posts,
    commentsByPost,
    isLoading,
    isCreating,
    isLoadingMore,
    hasMore,
    error,
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    loadComments,
    addComment,
    toggleHighlight,
    loadMore,
  } = useFeed({ user })

  useEffect(() => {
    const storedUser = getStoredUser()

    if (!storedUser) {
      router.push("/login")
      return
    }

    if (storedUser.role !== "VENDEDOR" && storedUser.role !== "GERENTE") {
      router.push("/login")
      return
    }

    const normalizedUser = {
      ...storedUser,
      nome: String(storedUser.nome ?? storedUser.NOME ?? "").trim(),
    }

    setStoredUser(normalizedUser)
    setUser(normalizedUser)
    markFeedAsSeen()
  }, [router])

  useEffect(() => {
    markFeedAsSeen()
    const intervalId = window.setInterval(() => {
      markFeedAsSeen()
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  async function handleCreatePost(message: string) {
    try {
      await createPost(message)
      toast({
        title: "Post publicado",
        description: "Sua mensagem ja apareceu no feed da equipe.",
      })
    } catch (err) {
      toast({
        title: "Nao foi possivel publicar",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      })
    }
  }

  async function handleAction(
    action: () => Promise<unknown>,
    successTitle: string,
    successDescription: string,
    showSuccess = true
  ) {
    try {
      await action()
      if (showSuccess) {
        toast({
          title: successTitle,
          description: successDescription,
        })
      }
    } catch (err) {
      toast({
        title: "Algo nao saiu como esperado",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      })
    }
  }

  const heroHighlights = [
    {
      title: "Conquistas",
      description: "Comemore vendas, metas e retomadas de clientes com mais contexto e orgulho.",
      icon: Trophy,
    },
    {
      title: "Engajamento",
      description: "Curtidas e comentarios mantem o time aquecido e puxam conversas boas ao longo do dia.",
      icon: Flame,
    },
    {
      title: "Movimento",
      description: "O feed vira uma vitrine viva do ritmo comercial, da energia e das vitorias da equipe.",
      icon: Activity,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <AppShellNav user={user} />

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="relative mb-6 overflow-hidden rounded-[30px] border border-emerald-500/16 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_26%),linear-gradient(135deg,rgba(9,18,31,0.98),rgba(10,14,22,0.98))] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.22)] sm:p-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(134,239,172,0.08),transparent_58%)]" />
          <div className="relative flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,420px)] xl:items-start">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Espaco da equipe
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#b8c9bf]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Feed da Equipe
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Compartilhe vitorias. Puxe o time. Fortaleca a cultura.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#a8bbb0] sm:text-base">
                Um lugar para transformar resultado em conversa, incentivo e presenca comercial dentro do sistema.
              </p>
            </div>

            <div className="grid gap-3">
              {heroHighlights.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                        <p className="mt-1 text-xs leading-5 text-[#9eb3a8]">{item.description}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {user ? <FeedComposer user={user} isSubmitting={isCreating} onSubmit={handleCreatePost} /> : null}

        <section className="mt-6">
          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {isLoading && posts.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 animate-pulse rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,30,0.8),rgba(8,13,21,0.92))]"
                />
              ))}
            </div>
          ) : null}

          {!isLoading && user ? (
            <FeedList
              posts={posts}
              currentUser={user}
              commentsByPost={commentsByPost}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
              onLoadComments={async (postId) => {
                await loadComments(postId)
              }}
              onLike={(postId) =>
                handleAction(() => toggleLike(postId), "Interacao registrada", "A curtida foi atualizada no feed.", false)
              }
              onComment={(postId, comment) =>
                handleAction(() => addComment(postId, comment), "Comentario publicado", "Sua resposta ja apareceu abaixo do post.", false)
              }
              onEdit={(postId, message) =>
                handleAction(() => updatePost(postId, message), "Post atualizado", "A publicacao foi editada com sucesso.")
              }
              onDelete={(postId) =>
                handleAction(() => deletePost(postId), "Post removido", "A publicacao foi removida do feed.")
              }
              onToggleHighlight={(postId) =>
                handleAction(() => toggleHighlight(postId), "Destaque atualizado", "O destaque do feed foi atualizado.")
              }
            />
          ) : null}
        </section>
      </main>
    </div>
  )
}

