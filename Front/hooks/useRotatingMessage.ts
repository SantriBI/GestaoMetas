"use client"

import { useEffect, useState } from "react"

export function useRotatingMessage(messages: string[], intervalMs = 2600) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
    if (messages.length <= 1) return

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % messages.length)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [messages, intervalMs])

  return messages[index] ?? messages[0] ?? ""
}
