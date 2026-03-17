"use client"

import { Heart } from "lucide-react"

interface FeedLikeButtonProps {
  liked: boolean
  totalLikes: number
  disabled?: boolean
  onClick: () => void
}

export function FeedLikeButton({ liked, totalLikes, disabled = false, onClick }: FeedLikeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        liked
          ? "bg-red-500/15 text-red-300 hover:bg-red-500/20"
          : "bg-white/5 text-[#9cb0cd] hover:bg-white/10 hover:text-white"
      }`}
    >
      <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
      <span>{totalLikes}</span>
      <span>{totalLikes === 1 ? "curtida" : "curtidas"}</span>
    </button>
  )
}
