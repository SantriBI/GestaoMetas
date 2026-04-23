"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type NotificationType = "info" | "success" | "warning" | "error"

export interface AppNotification {
  id: string
  title: string
  message: string
  type: NotificationType
  createdAt: string
  read: boolean
  actionHref?: string
  groupKey?: string
  count?: number
}

type AddNotificationInput = {
  id?: string
  title: string
  message: string
  type?: NotificationType
  actionHref?: string
  groupKey?: string
  createdAt?: string
  showToast?: boolean
}

type NotificationContextValue = {
  notifications: AppNotification[]
  toastNotifications: AppNotification[]
  unreadCount: number
  addNotification: (notification: AddNotificationInput) => string
  dismissToast: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const STORAGE_KEY = "sip-notifications-v1"
const MAX_NOTIFICATIONS = 60
const MAX_VISIBLE_TOASTS = 8

const NotificationContext = createContext<NotificationContextValue | null>(null)

function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeNotification(input: AddNotificationInput): AppNotification {
  return {
    id: input.id ?? createNotificationId(),
    title: input.title,
    message: input.message,
    type: input.type ?? "info",
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: false,
    actionHref: input.actionHref,
    groupKey: input.groupKey,
    count: 1,
  }
}

function readStoredNotifications() {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is AppNotification => {
        return (
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.message === "string" &&
          typeof item.createdAt === "string"
        )
      })
      .slice(0, MAX_NOTIFICATIONS)
  } catch {
    return []
  }
}

function mergeNotifications(primary: AppNotification[], secondary: AppNotification[]) {
  const seen = new Set<string>()
  return [...primary, ...secondary]
    .filter((notification) => {
      if (seen.has(notification.id)) return false
      seen.add(notification.id)
      return true
    })
    .slice(0, MAX_NOTIFICATIONS)
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [toastIds, setToastIds] = useState<string[]>([])
  const hasHydratedRef = useRef(false)
  const notificationsRef = useRef<AppNotification[]>([])

  useEffect(() => {
    const stored = readStoredNotifications()
    setNotifications((current) => {
      const next = current.length ? mergeNotifications(current, stored) : stored
      notificationsRef.current = next
      return next
    })
    hasHydratedRef.current = true
  }, [])

  useEffect(() => {
    notificationsRef.current = notifications

    if (!hasHydratedRef.current || typeof window === "undefined") return

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)))
    } catch {
      // Storage is a convenience; the in-memory queue still works without it.
    }
  }, [notifications])

  const enqueueToast = useCallback((id: string) => {
    setToastIds((current) => {
      const next = [...current.filter((toastId) => toastId !== id), id]
      return next.slice(Math.max(next.length - MAX_VISIBLE_TOASTS, 0))
    })
  }, [])

  const addNotification = useCallback(
    (input: AddNotificationInput) => {
      const nextNotification = normalizeNotification(input)
      const current = notificationsRef.current
      const existingById = current.find((notification) => notification.id === nextNotification.id)

      if (existingById) {
        const existingIndex = current.findIndex((notification) => notification.id === existingById.id)
        const shouldShowToast = input.showToast !== false
        const updated: AppNotification = {
          ...existingById,
          title: nextNotification.title,
          message: nextNotification.message,
          type: nextNotification.type,
          createdAt: nextNotification.createdAt,
          actionHref: nextNotification.actionHref ?? existingById.actionHref,
          groupKey: nextNotification.groupKey ?? existingById.groupKey,
          read: shouldShowToast ? false : existingById.read,
        }
        const next = [updated, ...current.filter((_, index) => index !== existingIndex)].slice(0, MAX_NOTIFICATIONS)
        notificationsRef.current = next
        setNotifications(next)

        if (shouldShowToast) {
          enqueueToast(updated.id)
        }

        return updated.id
      }

      const groupedIndex = nextNotification.groupKey
        ? current.findIndex(
            (notification) => notification.groupKey === nextNotification.groupKey && !notification.read
          )
        : -1

      if (groupedIndex >= 0) {
        const grouped = current[groupedIndex]
        const count = (grouped.count ?? 1) + 1
        const updated: AppNotification = {
          ...grouped,
          title: count > 1 ? `${count} novas atualizacoes` : nextNotification.title,
          message: nextNotification.message,
          type: nextNotification.type,
          createdAt: nextNotification.createdAt,
          actionHref: nextNotification.actionHref ?? grouped.actionHref,
          count,
          read: false,
        }
        const next = [updated, ...current.filter((_, index) => index !== groupedIndex)].slice(0, MAX_NOTIFICATIONS)
        notificationsRef.current = next
        setNotifications(next)

        if (input.showToast !== false) {
          enqueueToast(updated.id)
        }

        return updated.id
      }

      const next = [nextNotification, ...current].slice(0, MAX_NOTIFICATIONS)
      notificationsRef.current = next
      setNotifications(next)

      if (input.showToast !== false) {
        enqueueToast(nextNotification.id)
      }

      return nextNotification.id
    },
    [enqueueToast]
  )

  const dismissToast = useCallback((id: string) => {
    setToastIds((current) => current.filter((toastId) => toastId !== id))
  }, [])

  const markAsRead = useCallback((id: string) => {
    const next = notificationsRef.current.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification
    )
    notificationsRef.current = next
    setNotifications(next)
  }, [])

  const markAllAsRead = useCallback(() => {
    const next = notificationsRef.current.map((notification) => ({ ...notification, read: true }))
    notificationsRef.current = next
    setNotifications(next)
  }, [])

  const toastNotifications = useMemo(() => {
    return toastIds
      .map((id) => notifications.find((notification) => notification.id === id))
      .filter((notification): notification is AppNotification => Boolean(notification))
  }, [notifications, toastIds])

  const unreadCount = useMemo(() => {
    return notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0)
  }, [notifications])

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      toastNotifications,
      unreadCount,
      addNotification,
      dismissToast,
      markAsRead,
      markAllAsRead,
    }),
    [addNotification, dismissToast, markAllAsRead, markAsRead, notifications, toastNotifications, unreadCount]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider")
  }

  return context
}
