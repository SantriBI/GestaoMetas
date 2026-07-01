const EVOLUTION_URL = "http://172.22.0.39:8080"
const EVOLUTION_KEY = "evolution_api_2026_santri_tecnoogia"
const INSTANCE = "vendedor_8164"

const clientes = [
  { numero: "5561986613147", nome: "Guilherme" },
  { numero: "556185660018", nome: "Juan" },
  { numero: "556199765565", nome: "Kenny" },
  { numero: "351913442255", nome: "Bruno" },
  { numero: "556196887965", nome: "Ingred" },
]

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function enviar() {
  for (const cliente of clientes) {
    try {
      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_KEY
        },
        body: JSON.stringify({
          number: cliente.numero,
          text: `Olá ${cliente.nome}, tudo bem? Essa é uma mensagem de teste da automação do BI! 🚀`
        })
      })

      const data = await response.json()
      console.log(`✅ Enviado para ${cliente.nome} (${cliente.numero})`)
    } catch (err) {
      console.log(`❌ Erro ao enviar para ${cliente.nome}: ${err.message}`)
    }

    // Aguarda entre 8 e 15 segundos antes do próximo (igual ao sistema real)
    const delay = Math.floor(Math.random() * (15000 - 8000 + 1)) + 8000
    console.log(`⏳ Aguardando ${(delay / 1000).toFixed(1)}s antes do próximo...`)
    await sleep(delay)
  }

  console.log("✅ Disparo completo!")
}

enviar()