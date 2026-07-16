"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { getNavItems, isNavItemActive } from "@/components/layout/nav-items"
import { AuthUser, clearStoredUser } from "@/lib/user-session"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

interface MobileTabBarProps {
  user: AuthUser | null
}

const MAX_PRIMARY_TABS = 4

export function MobileTabBar({ user }: MobileTabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const items = getNavItems(user).filter((item) => !item.mobileHidden)
  const primaryItems = items.length <= MAX_PRIMARY_TABS ? items : items.slice(0, MAX_PRIMARY_TABS)
  const overflowItems = items.length <= MAX_PRIMARY_TABS ? [] : items.slice(MAX_PRIMARY_TABS)
  const isOverflowActive = overflowItems.some((item) => isNavItemActive(item, pathname))

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#183424] bg-[#08130f]/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 items-stretch justify-around px-1">
          {primaryItems.map((item) => {
            const Icon = item.icon
            const isActive = isNavItemActive(item, pathname)

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
                  isActive ? "text-emerald-400" : "text-white/60"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
              isOverflowActive ? "text-emerald-400" : "text-white/60"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="border-[#183424] bg-[#08130f] text-white lg:hidden">
          <DrawerHeader>
            <DrawerTitle className="text-white">Mais opções</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex flex-col gap-1 px-4 pb-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {overflowItems.map((item) => {
              const Icon = item.icon
              const isActive = isNavItemActive(item, pathname)

              return (
                <DrawerClose key={item.label} asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive ? "bg-[linear-gradient(135deg,rgba(11,59,46,0.9),rgba(34,197,94,0.9))] text-white" : "text-white/75 hover:bg-[#11251b] hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </DrawerClose>
              )
            })}

            <DrawerClose asChild>
              <button
                type="button"
                onClick={() => {
                  clearStoredUser()
                  router.push("/login")
                }}
                className="flex items-center gap-3 rounded-lg border border-[#21402c] bg-[#0c1711] px-3 py-3 text-left text-sm font-medium text-white/75 transition-colors hover:bg-[#11251b] hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
