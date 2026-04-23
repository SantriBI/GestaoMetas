"use client"

import { useEffect, useState } from "react"
import { fetchSellerLifeGoal, type LifeGoalResponse } from "@/lib/life-goal"
import { buildMotivationMessage, type MotivationContextInput } from "@/lib/motivation"
import type { AuthUser } from "@/lib/user-session"

interface UseSellerMotivationOptions {
  initialLifeGoal?: LifeGoalResponse | null
  disabled?: boolean
}

export function useSellerMotivation(
  user?: AuthUser | null,
  options?: UseSellerMotivationOptions
) {
  const [lifeGoal, setLifeGoal] = useState<LifeGoalResponse | null>(options?.initialLifeGoal ?? null)
  const [loading, setLoading] = useState(!options?.disabled && !options?.initialLifeGoal && !!user?.sk_vendedor)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLifeGoal(options?.initialLifeGoal ?? null)
  }, [options?.initialLifeGoal])

  useEffect(() => {
    if (options?.disabled) {
      setLoading(false)
      return
    }

    const sellerId = user?.sk_vendedor

    if (options?.initialLifeGoal || !sellerId) {
      setLoading(false)
      return
    }

    let active = true

    async function loadLifeGoal() {
      setLoading(true)
      try {
        const payload = await fetchSellerLifeGoal(sellerId as string | number)
        if (!active) return
        setLifeGoal(payload)
        setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar a motivacao do vendedor.")
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadLifeGoal()

    return () => {
      active = false
    }
  }, [options?.disabled, options?.initialLifeGoal, user?.sk_vendedor])

  function getMessage(context: MotivationContextInput) {
    return buildMotivationMessage(user, lifeGoal, context)
  }

  return {
    lifeGoal,
    loading,
    error,
    setLifeGoal,
    getMessage,
  }
}
