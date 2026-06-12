import { NextResponse } from "next/server"

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/feed/activity-count?${searchParams.toString()}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json().catch(() => null)
    return NextResponse.json(data ?? { data: { total: 0 } }, { status: res.ok ? res.status : res.status })
  } catch {
    return NextResponse.json({ data: { total: 0 } })
  }
}
