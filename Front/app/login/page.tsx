"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { setStoredUser } from "@/lib/user-session"

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login,
          senha: password,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.error || `Erro ao realizar login (${response.status})`)
        setIsLoading(false)
        return
      }

      // ðŸ”€ Regra de navegaÃ§Ã£o
      if (data.senha_temporaria === "S") {
        router.push(`/alterar-senha?login=${data.login}`)
        return
      }

      setStoredUser(data)

      if (data.role === "SUPERADMIN") {
        router.push("/admin")
        return
      }

      if (data.role === "ADMIN") {
        router.push("/admin/organizacoes")
        return
      }

      if (data.role === "GERENTE_SISTEMAS") {
        router.push("/gerente-sistemas")
        return
      }

      if (data.role === "VENDEDOR") {
        router.push("/vendedor")
        return
      }

      if (data.role === "GERENTE") {
        router.push("/dashboard")
        return
      }

    } catch (err) {
      setError("Erro de conexÃ£o com o servidor")
      setIsLoading(false)
    }
    
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 h-80 w-80 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(74,222,128,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(74,222,128,0.18)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao inicio
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <Image 
            src="/Logo%20Santri%20White.png" 
            alt="Logo da Empresa" 
            width={120} 
            height={40}
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#1c2940] bg-[linear-gradient(180deg,rgba(15,20,31,0.96),rgba(10,14,22,0.98))] p-8 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Bem-vindo de volta</h1>
            <p className="text-muted-foreground">Entre com suas credenciais para acessar o sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="login" className="text-sm font-medium text-foreground">
                Login
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="CPF"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full pl-10 pr-12 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-border bg-secondary accent-primary focus:ring-primary" 
                />
                <span className="text-sm text-muted-foreground">Lembrar de mim</span>
              </label>
              <button
                type="button"
                onClick={() => alert("Entre em contato com o administrador do sistema")}
                className="text-sm text-primary hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0b3b2e,#22c55e)] px-4 py-3.5 font-semibold text-white shadow-[0_16px_36px_rgba(34,197,94,0.24)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nao tem uma conta?{" "}
          <button type="button" className="text-primary hover:underline font-medium">
            Entre em contato
          </button>
        </p>
      </div>
    </div>
  )
}

