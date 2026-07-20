import { ViewMode } from "@/lib/types"

export type VendedorStatus = "achieved" | "progress" | "risk"

interface StatusConfig {
  badgeLabel: string
  badgeClassName: string
  barColor: string
  textColor: string
  bgSoft: string
  criterio: (viewMode: ViewMode) => string
}

const metaLabel = (viewMode: ViewMode) => (viewMode === "diario" ? "meta do dia" : "meta mensal")

export const STATUS_CONFIG: Record<VendedorStatus, StatusConfig> = {
  achieved: {
    badgeLabel: "Alta Performance",
    badgeClassName: "bg-success/20 text-success",
    barColor: "bg-success",
    textColor: "text-success",
    bgSoft: "bg-success/10",
    criterio: (viewMode) => `90% da ${metaLabel(viewMode)} ou mais`,
  },
  progress: {
    badgeLabel: "Em Progresso",
    badgeClassName: "bg-warning/20 text-warning",
    barColor: "bg-warning",
    textColor: "text-warning",
    bgSoft: "bg-warning/10",
    criterio: (viewMode) => `Entre 50% e 89% da ${metaLabel(viewMode)}`,
  },
  risk: {
    badgeLabel: "Atenção",
    badgeClassName: "bg-destructive/20 text-destructive",
    barColor: "bg-destructive",
    textColor: "text-destructive",
    bgSoft: "bg-destructive/10",
    criterio: (viewMode) => `Menos de 50% da ${metaLabel(viewMode)}`,
  },
}

const FALLBACK_CONFIG = {
  label: "N/A",
  className: "bg-muted text-muted-foreground",
}

export function getStatusBadge(status: string): { label: string; className: string } {
  const config = STATUS_CONFIG[status as VendedorStatus]
  if (!config) return FALLBACK_CONFIG
  return { label: config.badgeLabel, className: config.badgeClassName }
}
