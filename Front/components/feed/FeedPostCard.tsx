"use client"

import { useState } from "react"
import { Edit3, MoreHorizontal, Pin, ShieldAlert, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { FeedCommentsList } from "@/components/feed/FeedCommentsList"
import { FeedPostActions } from "@/components/feed/FeedPostActions"
import type { FeedComment, FeedPost } from "@/lib/feed-types"
import { getUserAvatarSrc, getUserInitials, type AuthUser } from "@/lib/user-session"

function formatPostDate(value: string | Date | null) {
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

interface FeedPostCardProps {
  post: FeedPost
  currentUser: AuthUser
  comments: FeedComment[]
  commentsLoaded: boolean
  commentsLoading: boolean
  onLoadComments: () => Promise<void> | void
  onLike: () => Promise<void> | void
  onComment: (comment: string) => Promise<void> | void
  onEdit: (message: string) => Promise<void> | void
  onDelete: () => Promise<void> | void
  onToggleHighlight: () => Promise<void> | void
}

export function FeedPostCard({
  post,
  currentUser,
  comments,
  commentsLoaded,
  commentsLoading,
  onLoadComments,
  onLike,
  onComment,
  onEdit,
  onDelete,
  onToggleHighlight,
}: FeedPostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [draft, setDraft] = useState(post.mensagem)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const [isHighlighting, setIsHighlighting] = useState(false)

  async function handleLike() {
    try {
      setIsLiking(true)
      await onLike()
    } finally {
      setIsLiking(false)
    }
  }

  async function handleEdit() {
    try {
      setIsSubmittingEdit(true)
      await onEdit(draft)
      setEditOpen(false)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  async function handleDelete() {
    try {
      setIsDeleting(true)
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleHighlight() {
    try {
      setIsHighlighting(true)
      await onToggleHighlight()
    } finally {
      setIsHighlighting(false)
    }
  }

  const avatarUser =
    post.usuarioId === Number(currentUser.id_usuario)
      ? currentUser
      : { nome: post.nomeUsuario, foto_url: null }

  return (
    <article
      className={`rounded-[28px] border p-5 shadow-[0_16px_48px_rgba(0,0,0,0.16)] transition-all hover:border-emerald-500/18 hover:shadow-[0_20px_54px_rgba(0,0,0,0.18)] sm:p-6 ${
        post.postDestaque
          ? "border-emerald-400/35 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_28%),linear-gradient(180deg,rgba(12,28,24,0.96),rgba(9,16,14,0.98))]"
          : "border-white/8 bg-[linear-gradient(180deg,rgba(10,18,30,0.94),rgba(8,13,21,0.98))]"
      }`}
    >
      <div className="flex items-start gap-4">
        <Avatar className="size-12 border border-white/10">
          <AvatarImage src={getUserAvatarSrc(avatarUser)} alt={post.nomeUsuario} />
          <AvatarFallback>{getUserInitials(post.nomeUsuario)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-white">{post.nomeUsuario}</h3>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9bb0cd]">
                  {post.tipoUsuario === "GERENTE" ? "Gerente" : "Vendedor"}
                </span>
                {post.postDestaque ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-200">
                    <Pin className="h-3 w-3" />
                    Post destaque
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs tracking-[0.08em] text-[#7f95b7]">{formatPostDate(post.dataPostagem)}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5 text-[#9cb0cd] transition-colors hover:bg-white/10 hover:text-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-[#1d2a40] bg-[#0b1320] text-white">
                {post.canToggleDestaque ? (
                  <>
                    <DropdownMenuItem onClick={handleHighlight} disabled={isHighlighting}>
                      <Pin className="h-4 w-4" />
                      {post.postDestaque ? "Remover destaque" : "Fixar no topo"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/8" />
                  </>
                ) : null}
                {post.canEdit ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setDraft(post.mensagem)
                      setEditOpen(true)
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                ) : null}
                {post.canDelete ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>
                    <ShieldAlert className="h-4 w-4" />
                    Sem permissoes extras
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[#d8e1f1]">{post.mensagem}</p>

          <div className="mt-5 border-t border-white/8 pt-4">
            <FeedPostActions
              liked={post.curtidoPeloUsuario}
              totalLikes={post.totalCurtidas}
              totalComments={post.totalComentarios}
              commentsOpen={commentsOpen}
              disableLike={isLiking}
              onLike={handleLike}
              onToggleComments={() => setCommentsOpen((current) => !current)}
            />

            <FeedCommentsList
              post={post}
              isOpen={commentsOpen}
              comments={comments}
              isLoading={commentsLoading}
              isLoaded={commentsLoaded}
              onLoad={onLoadComments}
              onComment={onComment}
            />
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-[#1d2a40] bg-[#0b1320] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar publicacao</DialogTitle>
            <DialogDescription className="text-[#88a0c4]">
              Ajuste a mensagem e mantenha o time atualizado.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
            className="min-h-[180px] resize-none rounded-2xl border-[#20304c] bg-[#0d1626] text-sm text-white placeholder:text-[#6f84a6] focus-visible:ring-emerald-400/50"
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleEdit}
              disabled={!draft.trim() || isSubmittingEdit}
              className="bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] text-white hover:brightness-110"
            >
              {isSubmittingEdit ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir publicacao?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa acao remove o post e seus comentarios do feed da equipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

