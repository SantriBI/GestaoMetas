"use client"

import { MessageCircle } from "lucide-react"
import { FeedLikeButton } from "@/components/feed/FeedLikeButton"

interface FeedPostActionsProps {
  liked: boolean
  totalLikes: number
  totalComments: number
  commentsOpen: boolean
  disableLike?: boolean
  onLike: () => void
  onToggleComments: () => void
}

export function FeedPostActions({
  liked,
  totalLikes,
  totalComments,
  commentsOpen,
  disableLike = false,
  onLike,
  onToggleComments,
}: FeedPostActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FeedLikeButton liked={liked} totalLikes={totalLikes} disabled={disableLike} onClick={onLike} />

      <button
        type="button"
        onClick={onToggleComments}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
          commentsOpen
            ? "bg-emerald-500/15 text-emerald-200"
            : "bg-white/5 text-[#9cb0cd] hover:bg-white/10 hover:text-white"
        }`}
      >
        <MessageCircle className="h-4 w-4" />
        <span>{totalComments}</span>
        <span>{totalComments === 1 ? "comentario" : "comentarios"}</span>
      </button>
    </div>
  )
}

