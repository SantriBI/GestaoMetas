import type { UserRole } from "@/lib/user-session"

export type FeedVisibility = "PUBLICO" | "PRIVADO"
export type FeedRecipientRole = Extract<UserRole, "VENDEDOR" | "GERENTE">

export interface FeedComment {
  id: number
  postId: number
  usuarioId: number
  nomeUsuario: string
  comentario: string
  dataComentario: string | Date | null
}

export interface FeedRecipient {
  id: number
  nome: string
  login: string
  tipoUsuario: FeedRecipientRole
  skVendedor: number | null
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
  visibilidade: FeedVisibility
  isPrivado: boolean
  destinatarioUsuarioId: number | null
  destinatarioNome: string | null
  destinatarioTipo: FeedRecipientRole | null
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
