import type { InvitationSummary, ResultSummary } from "@/lib/recruiter-data"

export interface TrendPoint {
  label: string
  value: number
}

export interface StatusSlice {
  key: string
  label: string
  value: number
}

export interface ScoreStat {
  average: number
  highest: number
  lowest: number
}

export function buildCompletionTrend(results: ResultSummary[]): TrendPoint[] {
  if (!results.length) return []
  const counts = new Map<string, number>()
  results.forEach((result) => {
    const label = formatDateLabel(result.submittedAt)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime())
}

export function buildScoreTrend(results: ResultSummary[]): TrendPoint[] {
  if (!results.length) return []
  const dailyScores = new Map<string, { sum: number; count: number }>()
  results.forEach((result) => {
    const label = formatDateLabel(result.submittedAt)
    const scorePercentage = result.total > 0 ? (result.score / result.total) * 100 : 0
    const entry = dailyScores.get(label) ?? { sum: 0, count: 0 }
    entry.sum += scorePercentage
    entry.count += 1
    dailyScores.set(label, entry)
  })
  return Array.from(dailyScores.entries())
    .map(([label, { sum, count }]) => ({ label, value: Math.round(sum / count) }))
    .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime())
}

export function buildInvitationBreakdown(invitations: InvitationSummary[]): StatusSlice[] {
  if (!invitations.length) return []
  const counts: Record<InvitationSummary["status"], number> = {
    pending: 0,
    started: 0,
    submitted: 0,
    expired: 0,
  }

  invitations.forEach((invitation) => {
    counts[invitation.status] = (counts[invitation.status] ?? 0) + 1
  })

  const labels: Record<InvitationSummary["status"], string> = {
    pending: "Pending",
    started: "Started",
    submitted: "Submitted",
    expired: "Expired",
  }

  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({ key: status, label: labels[status as InvitationSummary["status"]], value }))
    .sort((a, b) => b.value - a.value)
}

export function buildProctoringBreakdown(results: ResultSummary[]): StatusSlice[] {
  const counts: Record<NonNullable<ResultSummary["proctoringFlag"]>, number> = {
    low: 0,
    medium: 0,
    high: 0,
  }

  results.forEach((result) => {
    if (result.proctoringFlag) {
      counts[result.proctoringFlag] = (counts[result.proctoringFlag] ?? 0) + 1
    }
  })

  const labels: Record<NonNullable<ResultSummary["proctoringFlag"]>, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  }

  return (Object.entries(counts) as Array<[NonNullable<ResultSummary["proctoringFlag"]>, number]>)
    .filter(([, value]) => value > 0)
    .map(([flag, value]) => ({ key: flag, label: labels[flag], value }))
}

export function computeScoreStats(results: ResultSummary[]): ScoreStat {
  if (!results.length) return { average: 0, highest: 0, lowest: 0 }
  const percentages = results.map((result) => (result.total > 0 ? (result.score / result.total) * 100 : 0))
  return {
    average: Math.round(percentages.reduce((total, next) => total + next, 0) / percentages.length),
    highest: Math.round(Math.max(...percentages)),
    lowest: Math.round(Math.min(...percentages)),
  }
}

export function formatDateLabel(dateInput: string) {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) {
    return dateInput
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
}
