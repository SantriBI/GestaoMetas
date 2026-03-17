"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { Camera, KeyRound, LoaderCircle, Save, ShieldCheck, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AuthUser,
  getStoredUser,
  getUserAvatarSrc,
  getUserInitials,
  updateStoredUser,
} from "@/lib/user-session"

interface PerfilResponse extends AuthUser {}

export default function PerfilPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [perfil, setPerfil] = useState<PerfilResponse | null>(null)
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [previewFoto, setPreviewFoto] = useState<string | null>(null)
  const [loadingPerfil, setLoadingPerfil] = useState(true)
  const [savingSenha, setSavingSenha] = useState(false)
  const [savingFoto, setSavingFoto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  useEffect(() => {
    const currentUser = getStoredUser()

    if (!currentUser) {
      router.push("/login")
      return
    }

    const authenticatedUser = currentUser
    setUser(authenticatedUser)

    async function carregarPerfil() {
      try {
        setLoadingPerfil(true)
        setErro(null)

        const response = await fetch(`/api/usuarios/perfil/${authenticatedUser.id_usuario}`, {
          cache: "no-store",
        })
        const json = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(json.error ?? "Nao foi possivel carregar seu perfil")
        }

        setPerfil(json)
        setUser((state) => (state ? { ...state, ...json } : state))
        updateStoredUser({
          nome: json.nome,
          login: json.login,
          foto_url: json.foto_url ?? null,
          role: json.role,
          empresa_id: json.empresa_id ?? null,
          sk_vendedor: json.sk_vendedor ?? null,
        })
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Nao foi possivel carregar seu perfil")
      } finally {
        setLoadingPerfil(false)
      }
    }

    carregarPerfil()
  }, [router])

  const avatarSrc = useMemo(() => previewFoto ?? getUserAvatarSrc(perfil ?? user), [perfil, previewFoto, user])

  function limparFeedback() {
    setErro(null)
    setSucesso(null)
  }

  function handleArquivo(event: ChangeEvent<HTMLInputElement>) {
    limparFeedback()
    const file = event.target.files?.[0] ?? null
    setFotoArquivo(file)

    if (!file) {
      setPreviewFoto(null)
      return
    }

    const reader = new FileReader()
    reader.onload = () => setPreviewFoto(typeof reader.result === "string" ? reader.result : null)
    reader.readAsDataURL(file)
  }

  async function salvarFoto() {
    if (!user || !fotoArquivo || !previewFoto) return

    try {
      limparFeedback()
      setSavingFoto(true)

      const response = await fetch("/api/usuarios/upload-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: user.id_usuario,
          arquivo_base64: previewFoto,
          mime_type: fotoArquivo.type,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json.error ?? "Nao foi possivel enviar a foto")
      }

      setPerfil((current) => (current ? { ...current, foto_url: json.foto_url } : current))
      setUser((current) => (current ? { ...current, foto_url: json.foto_url } : current))
      updateStoredUser({ foto_url: json.foto_url })
      setPreviewFoto(null)
      setFotoArquivo(null)
      setSucesso("Foto atualizada com sucesso")
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel enviar a foto")
    } finally {
      setSavingFoto(false)
    }
  }

  async function salvarSenha() {
    if (!user) return

    try {
      limparFeedback()
      setSavingSenha(true)

      const response = await fetch("/api/usuarios/alterar-senha", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: user.id_usuario,
          senha_atual: senhaAtual,
          nova_senha: novaSenha,
          confirmar_senha: confirmarSenha,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(json.error ?? "Nao foi possivel alterar a senha")
      }

      setSenhaAtual("")
      setNovaSenha("")
      setConfirmarSenha("")
      setSucesso("Senha alterada com sucesso")
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Nao foi possivel alterar a senha")
    } finally {
      setSavingSenha(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.12),transparent_26%),linear-gradient(180deg,#050814_0%,#0b1220_100%)] text-slate-50">
      <AppShellNav user={user} variant="dark" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.94),rgba(8,15,30,0.90))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.34)] sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Perfil do usuario
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Gerencie sua identidade no sistema</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Atualize foto e senha mantendo a mesma experiencia visual do dashboard.
          </p>
        </section>

        {erro ? (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{erro}</div>
        ) : null}
        {sucesso ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{sucesso}</div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(10,15,28,0.88))] p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="size-28 border-2 border-slate-800 object-cover shadow-[0_16px_40px_rgba(2,6,23,0.35)]">
                <AvatarImage src={avatarSrc} alt={perfil?.nome ?? user?.nome ?? "Usuario"} />
                <AvatarFallback>{getUserInitials(perfil?.nome ?? user?.nome)}</AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-lg font-semibold uppercase tracking-[0.08em]">{perfil?.nome ?? user?.nome ?? "Carregando..."}</h2>
              <p className="mt-1 text-sm text-slate-400">{perfil?.role === "VENDEDOR" ? "Vendedor" : "Gerente"}</p>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-4 text-sm text-slate-300 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/5">
                <span className="mb-2 flex items-center gap-2 font-medium text-slate-100">
                  <Camera className="h-4 w-4" />
                  Enviar nova foto
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="mt-2 block w-full text-xs text-slate-400"
                  onChange={handleArquivo}
                />
              </label>

              <button
                type="button"
                onClick={salvarFoto}
                disabled={!fotoArquivo || savingFoto}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingFoto ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar foto
              </button>
            </div>
          </section>

          <div className="grid gap-6">
            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(10,15,28,0.88))] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-200">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Dados do perfil</h2>
                  <p className="text-sm text-slate-400">Nome e perfil usados no sistema.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Nome</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{loadingPerfil ? "Carregando..." : perfil?.nome ?? "-"}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Perfil</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{loadingPerfil ? "Carregando..." : perfil?.role ?? "-"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(10,15,28,0.88))] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-emerald-200">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Alterar senha</h2>
                  <p className="text-sm text-slate-400">Confirme a senha atual antes de definir uma nova credencial.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(event) => setSenhaAtual(event.target.value)}
                  placeholder="Senha atual"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400/40"
                />
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(event) => setNovaSenha(event.target.value)}
                  placeholder="Nova senha"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400/40"
                />
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                  placeholder="Confirmar senha"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400/40"
                />
              </div>

              <button
                type="button"
                onClick={salvarSenha}
                disabled={savingSenha}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/12 px-5 py-3 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSenha ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Alterar senha
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

