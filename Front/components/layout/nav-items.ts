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
import { AuthUser, getDashboardRoute } from "@/lib/user-session"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Excluded from the mobile tab bar (e.g. a desktop-only duplicate link). */
  mobileHidden?: boolean
}

export function getNavItems(user: AuthUser | null): NavItem[] {
  const dashboardHref = getDashboardRoute(user?.role)
  const lifeGoalHref = "/vendedor/minha-meta-de-vida"

  const isAdmin = user?.role === "ADMIN"
  const isSystemManager = user?.role === "GERENTE_SISTEMAS"
  const systemManagerDashboardHref =
    user?.gerente_sistemas_view === "VENDEDOR"
      ? "/vendedor"
      : user?.gerente_sistemas_view === "GERENTE"
        ? "/dashboard"
        : "/gerente-sistemas"

  if (isAdmin) {
    return [
      { href: "/admin/organizacoes", label: "Organizações", icon: Building2 },
      { href: "/perfil", label: "Perfil", icon: UserRound },
    ]
  }

  if (isSystemManager) {
    return [
      { href: "/gerente-sistemas", label: "Selecionar", icon: Building2 },
      { href: systemManagerDashboardHref, label: "Dashboard", icon: LayoutDashboard },
      ...(user?.gerente_sistemas_view === "GERENTE"
        ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }]
        : []),
      { href: "/perfil", label: "Perfil", icon: UserRound },
    ]
  }

  return [
    { href: dashboardHref, label: "Home", icon: Home, mobileHidden: true },
    { href: dashboardHref, label: "Dashboard", icon: LayoutDashboard },
    ...(user?.role === "VENDEDOR" ? [{ href: "/vendedor/kanban", label: "Kanban", icon: Kanban }] : []),
    ...(user?.role === "VENDEDOR" ? [{ href: lifeGoalHref, label: "Meta de Vida", icon: PiggyBank }] : []),
    { href: "/feed", label: "Feed", icon: MessageSquareMore },
    ...(user?.role === "GERENTE" ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }] : []),
    { href: "/perfil", label: "Perfil", icon: UserRound },
  ]
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
        !pathname.startsWith("/usuarios")
      )
    default:
      return false
  }
}
