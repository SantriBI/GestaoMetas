"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquareMore,
  PiggyBank,
  UserCog,
  UserRound,
  Moon,
  Sun
} from "lucide-react"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { ensureFeedLastSeenAt, getFeedLastSeenAt, onFeedSeenChange } from "@/lib/feed-activity"
import { cn } from "@/lib/utils"
import {
  AuthUser,
  clearStoredUser,
  getDashboardRoute,
  getUserAvatarSrc,
  getUserInitials,
} from "@/lib/user-session"
import { useTheme } from "next-themes"

interface AppShellNavProps {
  user: AuthUser | null
  variant?: "default" | "dark"
}

export function AppShellNav({ user }: AppShellNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const dashboardHref = getDashboardRoute(user?.role)
  const [feedActivityCount, setFeedActivityCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = !mounted || resolvedTheme === "dark"

  const darkPalette = {
    nav: "border-[#183424] bg-[#08130f]/84 backdrop-blur-xl text-white",
    logo: "",
    link: "text-white/68 hover:bg-[#11251b] hover:text-white",
    active: "bg-[linear-gradient(135deg,rgba(11,59,46,0.9),rgba(34,197,94,0.9))] text-white shadow-[0_10px_24px_rgba(34,197,94,0.16)]",
    profile: "border-[#21402c] bg-[#0c1711] text-white",
    role: "text-[#9cb8a5]",
    logout: "border-[#21402c] bg-[#0c1711] text-white/75 hover:bg-[#11251b] hover:text-white",
    avatarRing: "border-[#21402c]",
    toggle: "border-[#21402c] bg-[#0c1711] text-white/75 hover:bg-[#11251b] hover:text-white",
  }

  const lightPalette = {
    nav: "border-green-200/60 bg-white/90 backdrop-blur-xl text-slate-900",
    logo: "invert",
    link: "text-slate-600 hover:bg-green-50 hover:text-slate-900",
    active: "bg-[linear-gradient(135deg,rgba(11,59,46,0.85),rgba(34,197,94,0.85))] text-white shadow-[0_10px_24px_rgba(34,197,94,0.16)]",
    profile: "border-green-200/60 bg-green-50/80 text-slate-900",
    role: "text-green-600",
    logout: "border-green-200/60 bg-green-50/80 text-slate-600 hover:bg-green-100 hover:text-slate-900",
    avatarRing: "border-green-300/60",
    toggle: "border-green-200/60 bg-green-50/80 text-slate-600 hover:bg-green-100 hover:text-slate-900",
  }

  const palette = isDark ? darkPalette : lightPalette

  const lifeGoalHref = "/vendedor/minha-meta-de-vida"

  const isAdmin = user?.role === "ADMIN"

  const navItems = isAdmin
    ? [
        { href: "/admin/organizacoes", label: "Organizações", icon: Building2 },
        { href: "/perfil", label: "Perfil", icon: UserRound },
      ]
    : [
        { href: dashboardHref, label: "Home", icon: Home },
        { href: dashboardHref, label: "Dashboard", icon: LayoutDashboard },
        ...(user?.role === "VENDEDOR" ? [{ href: lifeGoalHref, label: "Meta de Vida", icon: PiggyBank }] : []),
        { href: "/feed", label: "Feed", icon: MessageSquareMore },
        ...(user?.role === "GERENTE" ? [{ href: "/usuarios", label: "Usuarios", icon: UserCog }] : []),
        { href: "/perfil", label: "Perfil", icon: UserRound },
      ]

  useEffect(() => {
    if (!user) return

    const actor = {
      usuario_id: Number(user.id_usuario),
      nome_usuario: String(user.nome ?? user.NOME ?? "").trim(),
      tipo_usuario: user.role,
      empresa_id: Number(user.empresa_id ?? user.sk_empresa ?? 0),
    }

    if (!Number.isFinite(actor.empresa_id) || actor.empresa_id <= 0) {
      setFeedActivityCount(0)
      return
    }

    let active = true

    async function refreshFeedActivityCount() {
      if (pathname.startsWith("/feed")) {
        setFeedActivityCount(0)
        return
      }

      const since = getFeedLastSeenAt() ?? ensureFeedLastSeenAt()
      if (!since) return

      try {
        const params = new URLSearchParams({
          usuario_id: String(actor.usuario_id),
          nome_usuario: actor.nome_usuario,
          tipo_usuario: actor.tipo_usuario,
          empresa_id: String(actor.empresa_id),
          since,
        })

        const response = await fetch(`/api/feed/activity-count?${params.toString()}`, {
          cache: "no-store",
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || "Erro ao buscar contador do feed.")
        }

        if (active) {
          setFeedActivityCount(Number(payload?.data?.total ?? 0))
        }
      } catch {
        if (active) {
          setFeedActivityCount(0)
        }
      }
    }

    void refreshFeedActivityCount()
    const intervalId = window.setInterval(() => {
      void refreshFeedActivityCount()
    }, 30000)
    const unsubscribe = onFeedSeenChange(() => {
      void refreshFeedActivityCount()
    })

    return () => {
      active = false
      window.clearInterval(intervalId)
      unsubscribe()
    }
  }, [pathname, user])

  return (
    <nav className={cn("sticky top-0 z-50 border-b", palette.nav)}>
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Link href={dashboardHref} className="flex items-center gap-3">
            <Image
              src="/Logo%20Santri%20White.png"
              alt="Logo da Santri"
              width={120}
              height={40}
              className={cn("h-10 w-auto object-contain", palette.logo)}
            />
          </Link>

          <div className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.label === "Perfil"
                  ? pathname === "/perfil"
                  : item.label === "Usuarios"
                    ? pathname.startsWith("/usuarios")
                  : item.label === "Organizações"
                    ? pathname.startsWith("/admin/organizacoes")
                  : item.label === "Meta de Vida"
                    ? pathname.startsWith("/vendedor/minha-meta-de-vida")
                  : item.label === "Feed"
                    ? pathname.startsWith("/feed")
                  : item.label === "Dashboard"
                    ? !pathname.startsWith("/perfil")
                      && !pathname.startsWith("/vendedor/minha-meta-de-vida")
                      && !pathname.startsWith("/feed")
                      && !pathname.startsWith("/usuarios")
                    : false

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    isActive ? palette.active : palette.link
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.label === "Feed" && feedActivityCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-white/15 bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_8px_18px_rgba(239,68,68,0.35)]">
                      {feedActivityCount > 99 ? "99+" : feedActivityCount}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          {user?.role === "VENDEDOR" ? <NotificationBell /> : null}

          {mounted && (
            <button
              type="button"
              aria-label="Alternar tema"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className={cn(
                "inline-flex items-center justify-center rounded-lg border p-2 transition-colors",
                palette.toggle
              )}
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push("/perfil")}
            className={cn(
              "inline-flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors",
              palette.profile
            )}
          >
            <Avatar className={cn("size-9 border-2", palette.avatarRing)}>
              <AvatarImage src={getUserAvatarSrc(user)} alt={user?.nome ?? "Usuario"} />
              <AvatarFallback>{getUserInitials(user?.nome)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block max-w-[180px] truncate text-xs font-semibold uppercase tracking-[0.08em]">
                {user?.nome ?? "Usuario"}
              </span>
              <span className={cn("block text-xs", palette.role)}>
                {user?.role === "VENDEDOR" ? "Vendedor" : user?.role === "ADMIN" ? "Administrador" : "Gerente"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              clearStoredUser()
              router.push("/login")
            }}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              palette.logout
            )}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}

