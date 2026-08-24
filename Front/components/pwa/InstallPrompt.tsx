"use client"

import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { cn } from "@/lib/utils"

const DISMISS_STORAGE_KEY = "sip-install-prompt-dismissed-until"
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isMobileUserAgent(userAgent: string) {
  return /android|iphone|ipad|ipod/i.test(userAgent)
}

function isIosUserAgent(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent)
}

function isStandaloneDisplay() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
}

function readDismissedUntil() {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY)
    return raw ? Number(raw) : 0
  } catch {
    return 0
  }
}

function persistDismissed() {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(until))
  } catch {
    // localStorage indisponivel (modo privado etc.) - apenas oculta ate recarregar
  }
}

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandaloneDisplay()) return
    if (Date.now() < readDismissedUntil()) return

    const userAgent = window.navigator.userAgent
    if (!isMobileUserAgent(userAgent)) return

    if (isIosUserAgent(userAgent)) {
      setPlatform("ios")
      setVisible(true)
      return
    }

    setPlatform("android")

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    function handleAppInstalled() {
      setVisible(false)
      setDeferredEvent(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    persistDismissed()
  }

  async function handleInstallClick() {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    const choice = await deferredEvent.userChoice
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      setVisible(false)
      setDeferredEvent(null)
    }
  }

  if (!visible || !platform) return null

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-2xl border p-3 shadow-2xl md:hidden",
        "border-emerald-300/20 bg-[linear-gradient(135deg,rgba(5,20,15,0.98),rgba(8,16,29,0.97))]"
      )}
      role="dialog"
      aria-label="Instalar aplicativo SIP"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/12">
        {platform === "ios" ? (
          <Share className="h-5 w-5 text-emerald-200" />
        ) : (
          <Download className="h-5 w-5 text-emerald-200" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Instale o SIP no seu celular</p>
        {platform === "ios" ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toque em <span className="font-medium text-foreground/90">Compartilhar</span> e depois em{" "}
            <span className="font-medium text-foreground/90">Adicionar à Tela de Início</span>.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Acesso mais rápido, direto da tela inicial.</p>
        )}
      </div>

      {platform === "android" && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 transition-colors"
        >
          Instalar
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
