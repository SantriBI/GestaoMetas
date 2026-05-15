const WHATSAPP_WINDOW_NAME = "SIP_WHATSAPP_WINDOW"
const DEFAULT_BATCH_DELAY_MS = 180
const MIN_BATCH_DELAY_MS = 80

let whatsappWindowRef: Window | null = null
let scheduledNavigationIds: number[] = []
let navigationRunId = 0

function normalizeUrl(url: string) {
  const nextUrl = String(url ?? "").trim()
  if (!nextUrl) {
    throw new Error("URL do WhatsApp invalida.")
  }

  try {
    return new URL(nextUrl).toString()
  } catch {
    return nextUrl
  }
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function extractWhatsAppPayload(url: string) {
  const parsedUrl = new URL(normalizeUrl(url))
  const hostname = parsedUrl.hostname.toLowerCase()

  if (hostname === "wa.me") {
    const pathPhone = parsedUrl.pathname.replace(/\//g, "").replace(/\D/g, "")
    return {
      phone: pathPhone || parsedUrl.searchParams.get("phone")?.replace(/\D/g, "") || "",
      text: parsedUrl.searchParams.get("text") ?? "",
    }
  }

  return {
    phone: parsedUrl.searchParams.get("phone")?.replace(/\D/g, "") || "",
    text: parsedUrl.searchParams.get("text") ?? "",
  }
}

function toWhatsAppWebUrl(url: string) {
  const { phone, text } = extractWhatsAppPayload(url)
  const search = new URLSearchParams()

  if (phone) {
    search.set("phone", phone)
  }

  if (text) {
    search.set("text", text)
  }

  search.set("type", "phone_number")
  search.set("app_absent", "0")

  return `https://web.whatsapp.com/send?${search.toString()}`
}

export function isSupportedWhatsAppUrl(url: string) {
  const hostname = getHostname(normalizeUrl(url))

  return (
    hostname === "wa.me"
    || hostname === "api.whatsapp.com"
    || hostname === "web.whatsapp.com"
    || hostname === "www.whatsapp.com"
  )
}

function openNamedWindow(url: string) {
  if (typeof window === "undefined") {
    return null
  }

  const targetUrl = toWhatsAppWebUrl(url)
  const targetWindow = window.open(targetUrl, WHATSAPP_WINDOW_NAME)
  if (!targetWindow || targetWindow.closed) {
    return null
  }

  whatsappWindowRef = targetWindow
  try {
    targetWindow.focus()
  } catch {}

  return targetWindow
}

function navigateWindow(targetWindow: Window | null, url: string) {
  if (!targetWindow) {
    return null
  }

  const targetUrl = toWhatsAppWebUrl(url)

  try {
    targetWindow.location.href = targetUrl
  } catch {
    return null
  }

  try {
    targetWindow.focus()
  } catch {}

  return targetWindow
}

function reuseExistingWindow(url: string) {
  const reusedWindow = navigateWindow(whatsappWindowRef, url)
  if (reusedWindow) {
    whatsappWindowRef = reusedWindow
    return reusedWindow
  }

  try {
    if (whatsappWindowRef?.closed) {
      whatsappWindowRef = null
    }
  } catch {
    whatsappWindowRef = null
  }

  return null
}

function clearScheduledNavigations() {
  if (typeof window === "undefined") {
    scheduledNavigationIds = []
    navigationRunId += 1
    return
  }

  scheduledNavigationIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
  scheduledNavigationIds = []
  navigationRunId += 1
}

function openWhatsAppWindow(url: string) {
  if (!isSupportedWhatsAppUrl(url)) {
    return null
  }

  const reusedWindow = reuseExistingWindow(url)
  if (reusedWindow) {
    return reusedWindow
  }

  return openNamedWindow(url)
}

export function openWhatsApp(url: string) {
  clearScheduledNavigations()
  return openWhatsAppWindow(url)
}

export function openWhatsAppBatch(urls: Array<string | null | undefined>, delayMs = DEFAULT_BATCH_DELAY_MS) {
  const normalizedUrls = urls
    .map((url) => String(url ?? "").trim())
    .filter((url) => url.length > 0)
    .filter((url) => isSupportedWhatsAppUrl(url))

  clearScheduledNavigations()

  if (!normalizedUrls.length) {
    return null
  }

  const currentRunId = navigationRunId
  const safeDelayMs = Math.max(delayMs, MIN_BATCH_DELAY_MS)
  let windowRef = openWhatsAppWindow(normalizedUrls[0])

  normalizedUrls.slice(1).forEach((url, index) => {
    const timeoutId = window.setTimeout(() => {
      if (currentRunId !== navigationRunId || !normalizedUrls.length) return
      windowRef = openWhatsAppWindow(url)
    }, (index + 1) * safeDelayMs)

    scheduledNavigationIds.push(timeoutId)
  })

  return windowRef
}
