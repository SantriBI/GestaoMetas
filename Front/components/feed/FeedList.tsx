"use client"

import { Loader2, MessagesSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeedPostCard } from "@/components/feed/FeedPostCard"
import type { FeedComment, FeedPost } from "@/lib/feed-types"
import type { AuthUser } from "@/lib/user-session"

interface FeedListProps {
  posts: FeedPost[]
  currentUser: AuthUser
  commentsByPost: Record<number, { data: FeedComment[]; isLoading: boolean; isLoaded: boolean }>
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => Promise<void> | void
  onLoadComments: (postId: number) => Promise<void> | void
  onLike: (postId: number) => Promise<void> | void
  onComment: (postId: number, comment: string) => Promise<void> | void
  onEdit: (postId: number, message: string) => Promise<void> | void
  onDelete: (postId: number) => Promise<void> | void
  onToggleHighlight: (postId: number) => Promise<void> | void
}

export function FeedList({
  posts,
  currentUser,
  commentsByPost,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onLoadComments,
  onLike,
  onComment,
  onEdit,
  onDelete,
  onToggleHighlight,
}: FeedListProps) {
  if (posts.length === 0) {
    return (
      <section className="rounded-[28px] border border-dashed border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.10),transparent_30%),linear-gradient(180deg,rgba(10,18,30,0.9),rgba(8,13,21,0.96))] px-6 py-14 text-center">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-200">
            <MessagesSquare className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">O feed esta pronto para o primeiro post</h3>
            <p className="mt-2 text-sm leading-6 text-[#89a1c4]">
              Compartilhe uma venda fechada, uma meta batida ou uma mensagem de incentivo para puxar a energia do time.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const commentState = commentsByPost[post.id] ?? {
          data: [],
          isLoading: false,
          isLoaded: false,
        }

        return (
          <FeedPostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
            comments={commentState.data}
            commentsLoaded={commentState.isLoaded}
            commentsLoading={commentState.isLoading}
            onLoadComments={() => onLoadComments(post.id)}
            onLike={() => onLike(post.id)}
            onComment={(comment) => onComment(post.id, comment)}
            onEdit={(message) => onEdit(post.id, message)}
            onDelete={() => onDelete(post.id)}
            onToggleHighlight={() => onToggleHighlight(post.id)}
          />
        )
      })}

      {hasMore ? (
        <div className="flex justify-center pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-xl border-[#243652] bg-[#0c1422] px-5 text-white hover:bg-[#13203a]"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              "Carregar mais publicacoes"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

