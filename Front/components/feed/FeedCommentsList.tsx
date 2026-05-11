"use client"

import { useEffect, useState } from "react"
import { Loader2, MessageCirclePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FeedComment } from "@/components/feed/FeedComment"
import type { FeedComment as FeedCommentType, FeedPost } from "@/lib/feed-types"

interface FeedCommentsListProps {
  post: FeedPost
  isOpen: boolean
  comments: FeedCommentType[]
  isLoading: boolean
  isLoaded: boolean
  onLoad: () => Promise<void> | void
  onComment: (comment: string) => Promise<void> | void
}

export function FeedCommentsList({
  post,
  isOpen,
  comments,
  isLoading,
  isLoaded,
  onLoad,
  onComment,
}: FeedCommentsListProps) {
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && !isLoaded && !isLoading) {
      void onLoad()
    }
  }, [isLoaded, isLoading, isOpen, onLoad])

  if (!isOpen) return null

  async function handleSubmit() {
    if (!comment.trim()) return

    try {
      setIsSubmitting(true)
      await onComment(comment.trim())
      setComment("")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4 rounded-[22px] border border-white/6 bg-[#09111d] p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[#9db1cf]">
        <MessageCirclePlus className="h-4 w-4" />
        Comentarios do post
      </div>

      <div className="space-y-3">
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 500))}
          placeholder={
            post.isPrivado
              ? `Comente na mensagem privada de ${post.nomeUsuario}...`
              : `Comente na publicacao de ${post.nomeUsuario}...`
          }
          className="min-h-[96px] resize-none rounded-2xl border-[#20304c] bg-[#0d1626] text-sm text-white placeholder:text-[#6f84a6] focus-visible:ring-emerald-400/50"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#7f95b7]">{comment.trim().length}/500 caracteres</span>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!comment.trim() || isSubmitting}
            className="rounded-xl bg-[#12315f] text-white hover:bg-[#17427f]"
          >
            {isSubmitting ? "Enviando..." : "Comentar"}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/6 bg-[#0b1320] px-4 py-3 text-sm text-[#9db1cf]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando comentarios...
          </div>
        ) : null}

        {!isLoading && comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-[#7f95b7]">
            {post.isPrivado
              ? "Ainda nao ha comentarios nessa mensagem privada."
              : "Ainda nao ha comentarios. Seja o primeiro a incentivar o time."}
          </div>
        ) : null}

        {!isLoading && comments.map((item) => <FeedComment key={item.id} comment={item} />)}
      </div>
    </div>
  )
}

