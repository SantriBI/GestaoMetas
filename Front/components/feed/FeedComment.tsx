"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { FeedComment as FeedCommentType } from "@/lib/feed-types"
import { getUserInitials } from "@/lib/user-session"

function formatCommentDate(value: string | Date | null) {
  if (!value) return "Agora"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "Agora"
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface FeedCommentProps {
  comment: FeedCommentType
}

export function FeedComment({ comment }: FeedCommentProps) {
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-white/6 bg-[#0b1320] px-4 py-3">
      <Avatar className="size-9 border border-white/10">
        <AvatarFallback>{getUserInitials(comment.nomeUsuario)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">{comment.nomeUsuario}</span>
          <span className="text-xs text-[#7690b6]">{formatCommentDate(comment.dataComentario)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#d4def0]">{comment.comentario}</p>
      </div>
    </article>
  )
}
