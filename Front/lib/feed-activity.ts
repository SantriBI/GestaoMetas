"use client"

const FEED_LAST_SEEN_KEY = "feed-last-seen-at"
const FEED_ACTIVITY_EVENT = "feed-activity-seen"

export function getFeedLastSeenAt() {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem(FEED_LAST_SEEN_KEY)
}

export function markFeedAsSeen(value = new Date().toISOString()) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(FEED_LAST_SEEN_KEY, value)
  window.dispatchEvent(new CustomEvent(FEED_ACTIVITY_EVENT))
}

export function ensureFeedLastSeenAt() {
  if (typeof window === "undefined") return null
  const existing = getFeedLastSeenAt()
  if (existing) return existing

  const now = new Date().toISOString()
  sessionStorage.setItem(FEED_LAST_SEEN_KEY, now)
  return now
}

export function onFeedSeenChange(callback: () => void) {
  if (typeof window === "undefined") return () => {}

  const handler = () => callback()
  window.addEventListener(FEED_ACTIVITY_EVENT, handler)
  return () => window.removeEventListener(FEED_ACTIVITY_EVENT, handler)
}
