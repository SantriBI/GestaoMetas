"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotifications, type AppNotification, type NotificationType } from "./NotificationContext"

const TOAST_DURATION_MS = 10000
const EXIT_DURATION_MS = 220

const toastStyleByType: Record<NotificationType, { icon: typeof Info; shell: string; iconShell: string; iconColor: string }> = {
  info: {
    icon: Info,
    shell: "border-sky-300/20 bg-[linear-gradient(135deg,rgba(7,20,34,0.96),rgba(8,16,29,0.94))]",
    iconShell: "bg-sky-400/12",
    iconColor: "text-sky-200",
  },
  success: {
    icon: CheckCircle2,
    shell: "border-emerald-300/20 bg-[linear-gradient(135deg,rgba(5,32,23,0.96),rgba(8,18,26,0.94))]",
    iconShell: "bg-emerald-400/12",
    iconColor: "text-emerald-200",
  },
  warning: {
    icon: AlertTriangle,
    shell: "border-amber-300/22 bg-[linear-gradient(135deg,rgba(43,28,7,0.96),rgba(10,17,28,0.94))]",
    iconShell: "bg-amber-300/12",
    iconColor: "text-amber-200",
  },
  error: {
    icon: XCircle,
    shell: "border-rose-300/22 bg-[linear-gradient(135deg,rgba(47,12,24,0.96),rgba(12,18,29,0.94))]",
    iconShell: "bg-rose-300/12",
    iconColor: "text-rose-200",
  },
}

function NotificationToastCard({ notification }: { notification: AppNotification }) {
  const router = useRouter()
  const { dismissToast, markAsRead } = useNotifications()
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const remainingMsRef = useRef(TOAST_DURATION_MS)
  const activeDurationMsRef = useRef(TOAST_DURATION_MS)
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const style = toastStyleByType[notification.type]
  const Icon = style.icon

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const close = () => {
    clearTimer()
    setIsLeaving(true)
    exitTimerRef.current = window.setTimeout(() => {
      dismissToast(notification.id)
    }, EXIT_DURATION_MS)
  }

  const startTimer = (duration: number) => {
    clearTimer()
    activeDurationMsRef.current = duration
    startedAtRef.current = Date.now()
    timerRef.current = window.setTimeout(close, duration)
  }

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setIsVisible(true))
    startTimer(remainingMsRef.current)

    return () => {
      window.cancelAnimationFrame(rafId)
      clearTimer()
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current)
      }
    }
    // The timer is intentionally created once per toast mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleMouseEnter() {
    if (isLeaving) return
    clearTimer()
    const elapsed = Date.now() - startedAtRef.current
    remainingMsRef.current = Math.max(activeDurationMsRef.current - elapsed, 800)
  }

  function handleMouseLeave() {
    if (isLeaving) return
    startTimer(remainingMsRef.current)
  }

  function handleActivate() {
    markAsRead(notification.id)
    close()

    if (notification.actionHref) {
      router.push(notification.actionHref)
    }
  }

  return (
    <article
      role="status"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleActivate}
      className={cn(
        "group pointer-events-auto relative flex cursor-pointer gap-3 overflow-hidden rounded-[18px] border p-4 text-left shadow-[0_20px_55px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 ease-out",
        style.shell,
        isVisible && !isLeaving ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0"
      )}
    >
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", style.iconShell)}>
        <Icon className={cn("h-4 w-4", style.iconColor)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-1 text-sm font-semibold text-white">{notification.title}</p>
          {!notification.read ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/62">{notification.message}</p>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          close()
        }}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white/38 opacity-0 transition hover:bg-white/8 hover:text-white group-hover:opacity-100"
        aria-label="Fechar notificacao"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </article>
  )
}

export function NotificationToast() {
  const { toastNotifications } = useNotifications()

  if (!toastNotifications.length) return null

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(calc(100vw-2rem),380px)] flex-col gap-3">
      {toastNotifications.map((notification) => (
        <NotificationToastCard key={notification.id} notification={notification} />
      ))}
    </div>
  )
}
