"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { UserManagementPanel } from "@/components/users/UserManagementPanel"
import { AuthUser, getStoredUser } from "@/lib/user-session"

export default function UsuariosPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const currentUser = getStoredUser()
    if (!currentUser) {
      router.push("/login")
      return
    }

    if (currentUser.role !== "GERENTE") {
      router.push("/login")
      return
    }

    setUser(currentUser)
  }, [router])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,#050814_0%,#0b1220_100%)] text-slate-50">
      <AppShellNav user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <UserManagementPanel
          empresaId={user?.empresa_id ?? user?.sk_empresa ?? null}
          allowGlobalLogoff={false}
          title="Usuarios da organizacao"
          description="Gerencie acesso dos vendedores da sua organizacao: logoff individual e troca de senha."
        />
      </main>
    </div>
  )
}
