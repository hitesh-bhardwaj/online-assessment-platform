"use client"

import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from "react"

import type { CandidateAssessmentBundle, CandidateAssessmentQuestion, CandidateAssessmentProgress } from "@/hooks/use-candidate-assessment"

export type QuestionStatus = "not_started" | "in_progress" | "answered"

export type CandidateProctoringEvent = {
  type: string
  severity: "low" | "medium" | "high"
  timestamp: string
  details?: unknown
}

export type CaptureChannel = "webcam" | "screen";

export type CaptureStatusValue = "idle" | "pending" | "active" | "error";

export interface CandidateAssessmentState {
  assessment: CandidateAssessmentBundle["assessment"]
  session: CandidateAssessmentBundle["session"]
  questions: CandidateAssessmentQuestion[]
  progress: CandidateAssessmentProgress | null
  currentIndex: number
  setCurrentIndex: (index: number) => void
  getQuestionStatus: (questionId: string) => QuestionStatus
  consent: {
    open: boolean
    status: Partial<Record<string, "pending" | "granted" | "denied">>
    setOpen: (open: boolean) => void
    setStatus: (status: Partial<Record<string, "pending" | "granted" | "denied">>) => void
  }
  proctoring: {
    events: CandidateProctoringEvent[]
    recordEvent: (event: CandidateProctoringEvent) => void
  }
  capture: {
    status: Record<CaptureChannel, CaptureStatusValue>
    lastUploadAt: Partial<Record<CaptureChannel, string>>
    pendingUploads: number
    setStatus: (updates: Partial<Record<CaptureChannel, CaptureStatusValue>>) => void
    setLastUpload: (channel: CaptureChannel, timestamp: string) => void
    setPendingUploads: (count: number | ((prev: number) => number)) => void
    restartToken: number
    requestRestart: () => void
  }
}

const CandidateAssessmentContext = createContext<CandidateAssessmentState | null>(null)

function buildStatusMap(progress: CandidateAssessmentProgress | null) {
  if (!progress) return new Map<string, QuestionStatus>()
  const map = new Map<string, QuestionStatus>()

  for (const response of progress.responses ?? []) {
    if (response.answer === undefined || response.answer === null || response.answer === "") {
      map.set(response.questionId, "in_progress")
      continue
    }

    if (Array.isArray(response.answer) && response.answer.length === 0) {
      map.set(response.questionId, "in_progress")
      continue
    }

    map.set(response.questionId, "answered")
  }

  return map
}

export function CandidateAssessmentProvider({
  value,
  children,
}: {
  value: {
    assessment: CandidateAssessmentBundle["assessment"]
    session: CandidateAssessmentBundle["session"]
    questions: CandidateAssessmentBundle["questions"]
    progress: CandidateAssessmentProgress | null
  }
  children: ReactNode
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [consentOpen, setConsentOpen] = useState(true)
  const [consentStatus, setConsentStatus] = useState<Partial<Record<string, "pending" | "granted" | "denied">>>({})
  const [proctoringEvents, setProctoringEvents] = useState<CandidateProctoringEvent[]>([])
  const [captureStatus, setCaptureStatus] = useState<Record<CaptureChannel, CaptureStatusValue>>({
    webcam: "idle",
    screen: "idle",
  })
  const [lastUploadAt, setLastUploadAt] = useState<Partial<Record<CaptureChannel, string>>>({})
  const [pendingUploads, setPendingUploads] = useState(0)
  const [captureRestartToken, setCaptureRestartToken] = useState(0)

  const statusMap = useMemo(() => buildStatusMap(value.progress), [value.progress])

  const setConsentStatusCallback = useCallback((next: Partial<Record<string, "pending" | "granted" | "denied">>) => {
    setConsentStatus((prev) => {
      if (!next) return prev
      const merged: Partial<Record<string, "pending" | "granted" | "denied">> = { ...prev }
      let changed = false
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined) continue
        if (merged[key] !== value) {
          merged[key] = value
          changed = true
        }
      }
      return changed ? merged : prev
    })
  }, [])

  const recordProctoringEvent = useCallback((event: CandidateProctoringEvent) => {
    setProctoringEvents((previous) => {
      if (!event) return previous
      const next = [event, ...previous]
      if (next.length > 25) {
        next.length = 25
      }
      return next
    })
  }, [])

  const setCaptureStatusCallback = useCallback((updates: Partial<Record<CaptureChannel, CaptureStatusValue>>) => {
    setCaptureStatus((prev) => {
      if (!updates) return prev
      let changed = false
      const next = { ...prev } as Record<CaptureChannel, CaptureStatusValue>
      const entries = Object.entries(updates) as Array<[CaptureChannel, CaptureStatusValue | undefined]>
      entries.forEach(([channel, value]) => {
        if (!value) return
        if (next[channel] !== value) {
          next[channel] = value
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [])

  const setLastUploadCallback = useCallback((channel: CaptureChannel, timestamp: string) => {
    setLastUploadAt((prev) => {
      if (prev[channel] === timestamp) return prev
      return { ...prev, [channel]: timestamp }
    })
  }, [])

  const requestCaptureRestart = useCallback(() => {
    setCaptureRestartToken((prev) => prev + 1)
  }, [])

  const contextValue = useMemo<CandidateAssessmentState>(
    () => ({
      assessment: value.assessment,
      session: value.session,
      questions: value.questions,
      progress: value.progress,
      currentIndex,
      setCurrentIndex,
      getQuestionStatus: (questionId: string) => statusMap.get(questionId) ?? "not_started",
      consent: {
        open: consentOpen,
        setOpen: setConsentOpen,
        status: consentStatus,
        setStatus: setConsentStatusCallback,
      },
      proctoring: {
        events: proctoringEvents,
        recordEvent: recordProctoringEvent,
      },
      capture: {
        status: captureStatus,
        lastUploadAt,
        pendingUploads,
        setStatus: setCaptureStatusCallback,
        setLastUpload: setLastUploadCallback,
        setPendingUploads,
        restartToken: captureRestartToken,
        requestRestart: requestCaptureRestart,
      },
    }),
    [
      value.assessment,
      value.session,
      value.questions,
      value.progress,
      currentIndex,
      statusMap,
      consentOpen,
      consentStatus,
      setConsentStatusCallback,
      proctoringEvents,
      recordProctoringEvent,
      captureStatus,
      lastUploadAt,
      pendingUploads,
      setCaptureStatusCallback,
      setLastUploadCallback,
      captureRestartToken,
      requestCaptureRestart,
    ]
  )

  return <CandidateAssessmentContext.Provider value={contextValue}>{children}</CandidateAssessmentContext.Provider>
}

export function useCandidateAssessmentContext() {
  const context = useContext(CandidateAssessmentContext)
  if (!context) {
    throw new Error("useCandidateAssessmentContext must be used within a CandidateAssessmentProvider")
  }
  return context
}
