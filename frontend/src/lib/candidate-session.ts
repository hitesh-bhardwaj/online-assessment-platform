"use client"

const STORAGE_KEY = "candidate_session"

export type CandidateSession = {
  token: string
  expiresAt: number
  candidate?: {
    firstName?: string
    lastName?: string
    email: string
    position?: string
  }
  session: {
    invitationId: string
    assessmentId: string
    status: string
    validFrom?: string
    validUntil?: string
    attemptsUsed: number
    remindersSent: number
    lastReminderAt?: string
  }
  assessment: unknown
  organization: unknown
}

const parseExpiresIn = (expiresIn: string | number): number => {
  if (typeof expiresIn === "number") {
    return Date.now() + expiresIn * 1000
  }

  const match = /^([0-9]+)([smhd])$/.exec(expiresIn.trim())
  if (!match) {
    return Date.now() + 4 * 60 * 60 * 1000
  }

  const value = Number(match[1])
  const unit = match[2]

  const seconds =
    unit === "s"
      ? value
      : unit === "m"
        ? value * 60
        : unit === "h"
          ? value * 60 * 60
          : value * 60 * 60 * 24

  return Date.now() + seconds * 1000
}

export function saveCandidateSession(session: {
  token: string
  expiresIn: string | number
  candidate?: CandidateSession["candidate"]
  session: CandidateSession["session"]
  assessment: CandidateSession["assessment"]
  organization: CandidateSession["organization"]
}) {
  if (typeof window === "undefined") return

  const candidateSession: CandidateSession = {
    token: session.token,
    expiresAt: parseExpiresIn(session.expiresIn),
    candidate: session.candidate,
    session: session.session,
    assessment: session.assessment,
    organization: session.organization,
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(candidateSession))
}

export function getCandidateSession(): CandidateSession | null {
  if (typeof window === "undefined") return null

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CandidateSession
    if (!parsed.token || !parsed.session) return null
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      clearCandidateSession()
      return null
    }
    return parsed
  } catch {
    clearCandidateSession()
    return null
  }
}

export function clearCandidateSession() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(STORAGE_KEY)
}
