"use client"

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-5 rounded-xl bg-card border border-border animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-secondary" />
            <div className="h-4 w-24 bg-secondary rounded" />
          </div>
          <div className="h-8 w-32 bg-secondary rounded mb-2" />
          <div className="h-3 w-20 bg-secondary rounded" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="p-6 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-5 h-5 rounded bg-secondary" />
        <div className="h-5 w-20 bg-secondary rounded" />
      </div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="w-9 h-9 rounded-full bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-secondary rounded" />
              <div className="h-3 w-20 bg-secondary rounded" />
            </div>
            <div className="h-4 w-24 bg-secondary rounded" />
            <div className="h-4 w-24 bg-secondary rounded" />
            <div className="w-24 h-2 bg-secondary rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatusSkeleton() {
  return (
    <div className="p-6 rounded-xl bg-card border border-border animate-pulse">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-5 h-5 rounded bg-secondary" />
        <div className="h-5 w-32 bg-secondary rounded" />
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-secondary" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-secondary rounded mb-2" />
              <div className="h-2 w-full bg-secondary rounded" />
            </div>
            <div className="h-6 w-8 bg-secondary rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PodiumSkeleton() {
  return (
    <div className="mb-8">
      <div className="flex justify-center mb-8">
        <div className="h-5 w-48 bg-secondary rounded animate-pulse" />
      </div>
      <div className="flex justify-center items-end gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col items-center animate-pulse">
            <div className="w-52 h-24 rounded-xl bg-card border border-border mb-3" />
            <div className={`w-20 ${i === 1 ? 'h-28' : i === 0 ? 'h-20' : 'h-16'} rounded-t-lg bg-secondary`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <KPISkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusSkeleton />
        <StatusSkeleton />
      </div>
      <TableSkeleton />
      <PodiumSkeleton />
    </div>
  )
}
