"use client"

import { useEffect, useRef } from "react"

import { apiRequest } from "@/lib/api-client"

export interface ProctoringEvent {
  type: string
  severity?: "low" | "medium" | "high"
  details?: unknown
  occurredAt?: string
}

function queueEvent(
  queue: ProctoringEvent[],
  event: ProctoringEvent,
  limit = 10,
  onEvent?: (event: ProctoringEvent) => void
) {
  queue.push(event)
  onEvent?.({
    ...event,
    timestamp: event.occurredAt ?? new Date().toISOString(),
  })
  if (queue.length > limit) {
    queue.splice(0, queue.length - limit)
  }
}

export function useProctoringSignals({
  token,
  assessmentId,
  onEvent,
}: {
  token: string | undefined
  assessmentId: string | undefined
  onEvent?: (event: ProctoringEvent) => void
}) {
  const eventQueue = useRef<ProctoringEvent[]>([])
  const flushTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!token || !assessmentId) return

    const flush = () => {
      if (eventQueue.current.length === 0) return
      const payload = eventQueue.current.splice(0, eventQueue.current.length)
      apiRequest({
        method: "POST",
        url: `/candidate/proctoring/events`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          events: payload,
        },
      }).catch(() => {
        eventQueue.current.unshift(...payload)
      })
    }

    const scheduleFlush = () => {
      if (flushTimer.current) return
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null
        flush()
      }, 3000)
    }

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        queueEvent(
          eventQueue.current,
          { type: "tab_hidden", severity: "medium", occurredAt: new Date().toISOString() },
          10,
          onEvent
        )
        scheduleFlush()
      }
    }

    const handleBlur = () => {
      queueEvent(eventQueue.current, { type: "window_blur", severity: "medium", occurredAt: new Date().toISOString() }, 10, onEvent)
      scheduleFlush()
    }

    const handleCopy = (event: ClipboardEvent) => {
      queueEvent(
        eventQueue.current,
        {
          type: "copy_event",
          severity: "low",
          details: { length: event.clipboardData?.getData("text")?.length ?? 0 },
          occurredAt: new Date().toISOString(),
        },
        10,
        onEvent
      )
      scheduleFlush()
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      queueEvent(
        eventQueue.current,
        {
          type: "right_click",
          severity: "medium",
          occurredAt: new Date().toISOString(),
        },
        10,
        onEvent
      )
      scheduleFlush()
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isMac = navigator.platform.toUpperCase().includes("MAC")
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey

      let blocked = false
      let action: string | undefined
      let eventType: "keyboard_shortcut" | "devtools_attempt" = "keyboard_shortcut"

      if (key === "f12") {
        blocked = true
        action = "f12"
        eventType = "devtools_attempt"
      }

      if (ctrlOrCmd && event.shiftKey && ["i", "j", "c", "k"].includes(key)) {
        blocked = true
        action = `ctrl+shift+${key}`
        eventType = "devtools_attempt"
      }

      if (ctrlOrCmd && ["p", "s"].includes(key)) {
        blocked = true
        action = `ctrl+${key}`
      }

      if (blocked) {
        event.preventDefault()
        queueEvent(
          eventQueue.current,
          {
            type: eventType,
            severity: "high",
            details: { action },
            occurredAt: new Date().toISOString(),
          },
          10,
          onEvent
        )
        scheduleFlush()
      }
    }

    window.addEventListener("blur", handleBlur)
    document.addEventListener("visibilitychange", handleVisibility)
    document.addEventListener("copy", handleCopy)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("keydown", handleKeydown)

    return () => {
      window.removeEventListener("blur", handleBlur)
      document.removeEventListener("visibilitychange", handleVisibility)
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("keydown", handleKeydown)
      if (flushTimer.current) {
        window.clearTimeout(flushTimer.current)
        flushTimer.current = null
      }
    }
  }, [assessmentId, onEvent, token])
}
