export async function getRankingVendedores(modo: "mensal" | "diario" = "mensal") {
  const res = await fetch(`/api/ranking-vendedores?modo=${modo}`);

  if (!res.ok) {
    let detalhe = `status ${res.status}`

    try {
      const payload = await res.json()
      if (payload?.error) {
        detalhe = String(payload.error)
      } else if (payload?.message) {
        detalhe = String(payload.message)
      }
    } catch {
      try {
        const texto = await res.text()
        if (texto.trim()) {
          detalhe = texto.trim()
        }
      } catch {
        // Mantem o fallback baseado no status quando o corpo nao puder ser lido.
      }
    }

    throw new Error(`Erro ao buscar ranking: ${detalhe}`);
  }

  return res.json();
}
