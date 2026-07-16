"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { KanbanCarteira } from "@/components/kanban"
import { getStoredUser, type AuthUser } from "@/lib/user-session"

export default function VendedorKanbanPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const user = getStoredUser()

    if (!user || user.role !== "VENDEDOR") {
      router.push("/login")
      return
    }

    setAuthUser(user)
  }, [router])

  if (!authUser?.sk_vendedor) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.16),transparent_22%),linear-gradient(145deg,#071019,#08131f_45%,#0a1522)] pb-mobile-tabbar">
        <AppShellNav user={authUser} />
        <MobileTabBar user={authUser} />
        <main className="mx-auto flex min-h-[70vh] max-w-[1200px] items-center justify-center px-4 py-10">
          <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-10 text-center text-white">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/12 border-t-emerald-300" />
            <p className="text-sm text-white/70">Carregando kanban de carteira...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.16),transparent_22%),linear-gradient(145deg,#071019,#08131f_45%,#0a1522)] pb-mobile-tabbar">
      <AppShellNav user={authUser} />
      <MobileTabBar user={authUser} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <KanbanCarteira skVendedor={authUser.sk_vendedor} />
      </main>
    </div>
  )
}
