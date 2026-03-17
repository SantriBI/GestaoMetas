"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"


export default function AlterarSenhaPage() {
  const router = useRouter()
  const [login, setLogin] = useState("")
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
  const loginParam = searchParams.get("login")
  if (loginParam) {
    setLogin(loginParam)
  }
}, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/alterar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login,
          senhaAtual,
          novaSenha,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao alterar senha")
        setLoading(false)
        return
      }

      // Após trocar a senha, volta para o login
      router.push("/login")

    } catch (err) {
      setError("Erro de conexão com o servidor")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 rounded-xl border space-y-4"
      >
        <h1 className="text-xl font-bold">Alterar senha</h1>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <input
            type="text"
            value={login}
            disabled
            className="w-full p-2 border rounded bg-gray-100 text-gray-600 cursor-not-allowed"
        />

        <input
          type="password"
          placeholder="Senha atual"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          className="w-full p-2 border rounded"
        />

        <input
          type="password"
          placeholder="Nova senha"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className="w-full p-2 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full p-2 bg-black text-white rounded disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Alterar senha"}
        </button>
      </form>
    </div>
  )
}
