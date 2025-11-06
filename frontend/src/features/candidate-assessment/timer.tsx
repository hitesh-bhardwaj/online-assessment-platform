"use client"

import { useEffect, useMemo, useState } from "react"

function formatDuration(seconds: number) {
  if (seconds <= 0) return "00:00"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const minutesPart = String(mins).padStart(2, "0")
  const secondsPart = String(secs).padStart(2, "0")
  return `${minutesPart}:${secondsPart}`
}

export function CandidateTimer({ timeLimitMinutes, startedAt }: { timeLimitMinutes?: number; startedAt?: string }) {
  const totalSeconds = useMemo(() => {
    if (!timeLimitMinutes || timeLimitMinutes <= 0) return null
    return timeLimitMinutes * 60
  }, [timeLimitMinutes])

  const [remaining, setRemaining] = useState(totalSeconds ?? 0)

  useEffect(() => {
    if (!totalSeconds || !startedAt) return
    const startTs = new Date(startedAt).getTime()
    if (Number.isNaN(startTs)) return

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTs) / 1000)
      const next = Math.max(totalSeconds - elapsed, 0)
      setRemaining(next)
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [startedAt, totalSeconds])

  if (!totalSeconds || !startedAt) {
    return null
  }

  const isLowTime = remaining <= 300 && remaining > 0 // Last 5 minutes
  const isVeryLowTime = remaining <= 60 && remaining > 0 // Last minute

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
        isVeryLowTime
          ? 'border-red-300 bg-red-50 text-red-700'
          : isLowTime
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-border bg-emerald-50 text-emerald-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide">Time Remaining</span>
        <span className={`text-xl font-bold tabular-nums ${isVeryLowTime ? 'animate-pulse' : ''}`}>
          {formatDuration(remaining)}
        </span>
      </div>
    </div>
  )
}
