"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { NotificationDropdown } from "./NotificationDropdown"
import { useNotifications, type AppNotification } from "./NotificationContext"

export function NotificationBell() {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [badgePulse, setBadgePulse] = useState(false)
  const previousUnreadRef = useRef(unreadCount)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (previousUnreadRef.current !== unreadCount) {
      setBadgePulse(true)
      const timeout = window.setTimeout(() => setBadgePulse(false), 280)
      previousUnreadRef.current = unreadCount
      return () => window.clearTimeout(timeout)
    }

    previousUnreadRef.current = unreadCount
  }, [unreadCount])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  function handleNotificationClick(notification: AppNotification) {
    markAsRead(notification.id)
    setIsOpen(false)

    if (notification.actionHref) {
      router.push(notification.actionHref)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#21402c] bg-[#0c1711] text-white/72 transition hover:bg-[#11251b] hover:text-white",
          isOpen ? "bg-[#11251b] text-white" : null
        )}
        aria-label="Abrir notificacoes"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span
            className={cn(
              "absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#08130f] bg-cyan-300 px-1.5 text-[10px] font-black leading-none text-[#04110a] shadow-[0_8px_18px_rgba(103,232,249,0.25)] transition-transform",
              badgePulse ? "scale-110" : "scale-100"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : (
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white/18" />
        )}
      </button>

      {isOpen ? (
        <NotificationDropdown
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
          onMarkAllAsRead={markAllAsRead}
        />
      ) : null}
    </div>
  )
}
