import type { UserRole } from "@/lib/user-session"

export interface FeedComment {
  id: number
  postId: number
  usuarioId: number
  nomeUsuario: string
  comentario: string
  dataComentario: string | Date | null
}

export interface FeedPost {
  id: number
  usuarioId: number
  nomeUsuario: string
  tipoUsuario: UserRole
  mensagem: string
  dataPostagem: string | Date | null
  totalCurtidas: number
  totalComentarios: number
  postDestaque: boolean
  curtidoPeloUsuario: boolean
  canEdit: boolean
  canDelete: boolean
  canToggleDestaque: boolean
}

export interface FeedPagination {
  limit: number
  offset: number
  hasMore: boolean
  nextOffset: number
}

export interface FeedPostsResponse {
  data: FeedPost[]
  pagination: FeedPagination
}
