"use client"

import { useEffect, useRef, useState } from "react"

/** Anima um numero inteiro subindo do valor atual ate `value` sempre que ele mudar. */
export function useCountUp(value: number, durationMs = 600) {
  const [displayValue, setDisplayValue] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return

    let frameId: number
    const startTime = performance.now()

    function tick(now: number) {
      const progress = Math.min((now - startTime) / durationMs, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      const current = Math.round(from + (to - from) * eased)
      setDisplayValue(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [value, durationMs])

  return displayValue
}
