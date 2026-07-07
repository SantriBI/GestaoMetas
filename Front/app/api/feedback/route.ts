import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const cookie = req.headers.get("cookie") ?? ""
    const res = await fetch(`${BACKEND_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json().catch(() => null)
    return NextResponse.json(data ?? { error: "Erro interno" }, { status: res.status })
  } catch {
    return NextResponse.json({ error: "Erro ao enviar feedback." }, { status: 500 })
  }
}
