import {
  Building2,
  Home,
  Kanban,
  LayoutDashboard,
  MessageSquareMore,
  PiggyBank,
  UserCog,
  UserRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { AuthUser, getDashboardRoute, getEffectiveRole } from "@/lib/user-session"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Excluded from the mobile tab bar (e.g. a desktop-only duplicate link). */
  mobileHidden?: boolean
}

export function getNavItems(user: AuthUser | null): NavItem[] {
  const isAdmin = user?.role === "ADMIN"
  const isSystemManager = user?.role === "GERENTE_SISTEMAS"
  const effectiveRole = getEffectiveRole(user)

  if (isAdmin) {
    return [
      { href: "/admin/organizacoes", label: "Organizações", icon: Building2 },
      { href: "/perfil", label: "Perfil", icon: UserRound },
    ]
  }

  // Gerente de sistemas ainda nao escolheu organizacao/visao: so o seletor faz sentido.
  if (isSystemManager && !effectiveRole) {
    return [
      { href: "/gerente-sistemas", label: "Selecionar", icon: Building2 },
      { href: "/perfil", label: "Perfil", icon: UserRound },
    ]
  }

  const dashboardHref = getDashboardRoute(effectiveRole)
  const lifeGoalHref = "/vendedor/minha-meta-de-vida"

  const items: NavItem[] = [
    { href: dashboardHref, label: "Home", icon: Home, mobileHidden: true },
    { href: dashboardHref, label: "Dashboard", icon: LayoutDashboard },
    ...(effectiveRole === "VENDEDOR" ? [{ href: "/vendedor/kanban", label: "Kanban", icon: Kanban }] : []),
    ...(effectiveRole === "VENDEDOR" ? [{ href: lifeGoalHref, label: "Meta de Vida", icon: PiggyBank }] : []),
    { href: "/feed", label: "Feed", icon: MessageSquareMore },
    ...(effectiveRole === "GERENTE" ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }] : []),
  ]

  if (isSystemManager) {
    items.push({ href: "/gerente-sistemas", label: "Selecionar", icon: Building2 })
  }

  items.push({ href: "/perfil", label: "Perfil", icon: UserRound })

  return items
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  switch (item.label) {
    case "Perfil":
      return pathname === "/perfil"
    case "Usuarios":
      return pathname.startsWith("/usuarios")
    case "Organizações":
      return pathname.startsWith("/admin/organizacoes")
    case "Selecionar":
      return pathname.startsWith("/gerente-sistemas")
    case "Kanban":
      return pathname.startsWith("/vendedor/kanban")
    case "Meta de Vida":
      return pathname.startsWith("/vendedor/minha-meta-de-vida")
    case "Feed":
      return pathname.startsWith("/feed")
    case "Dashboard":
      return (
        !pathname.startsWith("/perfil") &&
        !pathname.startsWith("/vendedor/kanban") &&
        !pathname.startsWith("/vendedor/minha-meta-de-vida") &&
        !pathname.startsWith("/feed") &&
        !pathname.startsWith("/usuarios") &&
        !pathname.startsWith("/gerente-sistemas")
      )
    default:
      return false
  }
}
