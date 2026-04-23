"use client"

import { AlertTriangle, CheckCircle2, Circle, Clock3, ExternalLink, Inbox, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { type AppNotification, type NotificationType } from "./NotificationContext"

const iconByType: Record<NotificationType, { icon: typeof Info; className: string; shell: string }> = {
  info: { icon: Info, className: "text-sky-200", shell: "bg-sky-400/10" },
  success: { icon: CheckCircle2, className: "text-emerald-200", shell: "bg-emerald-400/10" },
  warning: { icon: AlertTriangle, className: "text-amber-200", shell: "bg-amber-300/10" },
  error: { icon: XCircle, className: "text-rose-200", shell: "bg-rose-300/10" },
}

function getRelativeTimeLabel(createdAt: string) {
  const timestamp = new Date(createdAt).getTime()
  if (!Number.isFinite(timestamp)) return "agora"

  const diffSeconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0)
  if (diffSeconds < 45) return "agora"

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `ha ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `ha ${diffHours} h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `ha ${diffDays} d`

  return new Date(createdAt).toLocaleDateString("pt-BR")
}

export function NotificationDropdown({
  notifications,
  onNotificationClick,
  onMarkAllAsRead,
}: {
  notifications: AppNotification[]
  onNotificationClick: (notification: AppNotification) => void
  onMarkAllAsRead: () => void
}) {
  const recentNotifications = notifications.slice(0, 12)
  const hasUnread = notifications.some((notification) => !notification.read)

  return (
    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[95] w-[min(calc(100vw-2rem),390px)] overflow-hidden rounded-[24px] border border-white/12 bg-[#07110d]/96 text-white shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5">
        <div>
          <p className="text-sm font-semibold">Notificacoes</p>
          <p className="mt-0.5 text-xs text-white/46">Atualizacoes recentes do vendedor</p>
        </div>

        <button
          type="button"
          onClick={onMarkAllAsRead}
          disabled={!hasUnread}
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/64 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          Marcar lidas
        </button>
      </div>

      {recentNotifications.length ? (
        <div className="max-h-[420px] overflow-y-auto p-2">
          {recentNotifications.map((notification) => {
            const meta = iconByType[notification.type]
            const Icon = meta.icon

            return (
              <button
                type="button"
                key={notification.id}
                onClick={() => onNotificationClick(notification)}
                className={cn(
                  "group flex w-full gap-3 rounded-[18px] px-3 py-3 text-left transition",
                  notification.read ? "hover:bg-white/[0.045]" : "bg-white/[0.055] hover:bg-white/[0.075]"
                )}
              >
                <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", meta.shell)}>
                  <Icon className={cn("h-4 w-4", meta.className)} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="line-clamp-1 text-sm font-semibold text-white">{notification.title}</span>
                    {!notification.read ? (
                      <Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-cyan-300 text-cyan-300" />
                    ) : null}
                  </span>
                  <span className="mt-1 line-clamp-2 text-sm leading-5 text-white/56">{notification.message}</span>
                  <span className="mt-2 flex items-center gap-2 text-[11px] font-medium text-white/38">
                    <Clock3 className="h-3.5 w-3.5" />
                    {getRelativeTimeLabel(notification.createdAt)}
                    <span className="h-1 w-1 rounded-full bg-white/22" />
                    {notification.read ? "lida" : "nao lida"}
                    {notification.actionHref ? <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-70" /> : null}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-white/40">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-semibold text-white">Nada novo por aqui</p>
          <p className="mt-1 text-sm leading-6 text-white/45">Quando algo importante aparecer, fica salvo neste painel.</p>
        </div>
      )}
    </div>
  )
}
