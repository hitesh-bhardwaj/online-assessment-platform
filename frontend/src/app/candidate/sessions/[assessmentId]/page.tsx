/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { use, useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, LogOut, Play, Loader2, ChevronLeft, ChevronRight, Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CandidateSession, clearCandidateSession, getCandidateSession } from "@/lib/candidate-session"
import { apiRequest } from "@/lib/api-client"
import { candidateKeys } from "@/lib/query-keys"
import {
  CandidateAssessmentProvider,
  useCandidateAssessmentContext,
  type CaptureChannel,
  type CaptureStatusValue,
} from "@/features/candidate-assessment/context"
import { CandidateQuestionNavigator } from "@/features/candidate-assessment/question-navigator"
import { CandidateQuestionView } from "@/features/candidate-assessment/question-view"
import { CandidateTimer } from "@/features/candidate-assessment/timer"
import { ProctoringConsentDialog } from "@/features/candidate-assessment/consent-dialog"
import { useProctoringSignals } from "@/features/candidate-assessment/use-proctoring-signals"
import { useProctoringMediaStreams } from "@/features/candidate-assessment/use-proctoring-media"
import { useCandidateSubmit } from "@/hooks/use-candidate-submit"
import { useCandidateAssessment, type CandidateAssessmentBundle } from "@/hooks/use-candidate-assessment"

interface CandidateSessionPageProps {
  params: Promise<{ assessmentId: string }>
}

export default function CandidateSessionPage({ params }: CandidateSessionPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const [session, setSession] = useState<CandidateSession | null>(null)
  const [missing, setMissing] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  const assessmentId = resolvedParams.assessmentId
  const { data, isLoading, isError } = useCandidateAssessment(assessmentId, session)


  useEffect(() => {
    setSession(getCandidateSession())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    if (!session || session.session.assessmentId !== assessmentId) {
      setMissing(true)
    } else {
      setMissing(false)
    }
  }, [isHydrated, assessmentId, session])

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12 text-foreground">
        <Card className="w-full max-w-lg bg-card text-foreground shadow">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl font-semibold">Preparing your session</CardTitle>
            <CardDescription className="text-muted-foreground">
              Hold tight—loading your secure candidate workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>This should only take a second.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (missing) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg border-destructive/40 bg-card text-foreground shadow">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertCircle className="h-5 w-5" />
              Session not found
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              We couldn’t find an active session for this assessment. Your invitation may have expired or been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Return to your invitation email and use the link to start again. If the issue persists, contact your recruiter.</p>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => router.push("/")}
            >
              <LogOut className="h-4 w-4" />
              Back to home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg border-destructive/40 bg-card text-foreground shadow">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertCircle className="h-5 w-5" />
              Session unavailable
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              It looks like your session information is missing. Try reopening the invitation link from your email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => router.push("/")}
            >
              <LogOut className="h-4 w-4" />
              Back to home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }


  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12 text-foreground">
        <Card className="w-full max-w-lg bg-card text-foreground shadow">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl font-semibold">Loading assessment</CardTitle>
            <CardDescription className="text-muted-foreground">
              We’re pulling the latest instructions and question order for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Please hold on a moment.</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg border-destructive/40 bg-card text-foreground shadow">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertCircle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              We couldn’t load the assessment details. Refresh the page or re-open your invitation link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => router.refresh()}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const timeLimitMinutes = Number((data?.assessment?.settings as Record<string, unknown> | undefined)?.timeLimit ?? 0)

  const candidateName =
    session?.candidate?.firstName || session?.candidate?.lastName
      ? [session?.candidate?.firstName, session?.candidate?.lastName].filter(Boolean).join(" ")
      : session?.candidate?.email

  const instructions =
    typeof data.assessment.instructions === "string" ? data.assessment.instructions.trim() : ""
  const progressStatus = data.progress?.status ?? "in_progress"
  const isCompleted = progressStatus === "completed"

  if (isCompleted) {
    const summary = data.resultSummary
    const submittedAt = summary?.submittedAt ? new Date(summary.submittedAt).toLocaleString() : null

    return (
      <div className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-semibold text-foreground">Assessment submitted</CardTitle>
              <CardDescription className="text-muted-foreground">
                Thanks for completing the assessment. Your responses are locked and under review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-muted-foreground">
              <div className="rounded-md border border-border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Candidate</p>
                <p className="text-lg font-semibold text-foreground">{candidateName ?? session.candidate.email}</p>
                {session.candidate.email ? (
                  <p className="text-xs text-muted-foreground">{session.candidate.email}</p>
                ) : null}
              </div>

              <div className="rounded-md border border-border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Assessment</p>
                <p className="text-lg font-semibold text-foreground">{data.assessment.title ?? "Assessment"}</p>
                {submittedAt ? <p className="text-xs text-muted-foreground">Submitted on {submittedAt}</p> : null}
              </div>

              {summary?.score && data.assessment.settings?.showResultsToCandidate ? (
                <div className="rounded-md border border-border bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                  <p className="text-lg font-semibold text-foreground">
                    {summary.score.earned} / {summary.score.total} pts ({summary.score.percentage}%)
                  </p>
                </div>
              ) : null}

              <p className="text-sm text-muted-foreground">
                You can safely close this window. If you have any questions, reach out to your recruiter.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                className="gap-2"
                onClick={() => {
                  clearCandidateSession()
                  router.push("/")
                }}
              >
                Exit
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <CandidateAssessmentProvider
      value={{
        assessment: data.assessment,
        session: data.session,
        questions: data.questions,
        progress: data.progress,
      }}
    >
      <CandidateAssessmentShell
        session={session}
        data={data}
        timeLimitMinutes={timeLimitMinutes}
        candidateName={candidateName}
        instructions={instructions}
        isCompleted={isCompleted}
      />
    </CandidateAssessmentProvider>
  )
}

type CandidateAssessmentShellProps = {
  session: CandidateSession
  data: CandidateAssessmentBundle
  candidateName: string | undefined
  instructions: string
  timeLimitMinutes: number
  isCompleted: boolean
}

type CandidateVerificationProps = {
  candidateName: string | undefined
  candidateEmail: string | undefined
  candidateRole?: string
  instructions: string
  assessmentTitle: string | undefined
  onConfirm: () => void
  onExit: () => void
}

function CandidateVerificationStep({
  candidateName,
  candidateEmail,
  candidateRole,
  instructions,
  assessmentTitle,
  onConfirm,
  onExit,
}: CandidateVerificationProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="border border-border bg-card shadow">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl font-semibold text-foreground">Confirm your assessment details</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Please verify your identity and review the instructions before we start the secure proctoring checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground">
            <div className="grid gap-4 rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Candidate</p>
              <p className="text-lg font-semibold text-foreground">{candidateName ?? candidateEmail ?? "Candidate"}</p>
              {candidateEmail ? <p className="text-xs text-muted-foreground">{candidateEmail}</p> : null}
              {candidateRole ? <p className="text-xs text-muted-foreground">Role: {candidateRole}</p> : null}
            </div>

            <div className="grid gap-4 rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Assessment</p>
              <p className="text-lg font-semibold text-foreground">{assessmentTitle ?? "Assessment"}</p>
              <p className="text-xs text-muted-foreground">You’ll be monitored via webcam, microphone, and full-screen sharing once you agree to the proctoring consent.</p>
            </div>

            <div className="grid gap-3 rounded-md border border-border bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Instructions</p>
              <p className="whitespace-pre-line text-foreground">
                {instructions
                  ? instructions
                  : "The recruiting team hasn’t provided custom instructions. Please ensure you’re in a quiet, well-lit space before continuing."}
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <p className="font-medium text-foreground">Heads up</p>
              <p>Once you continue we’ll ask for webcam, microphone, and full-screen access. Make sure you’re ready before starting.</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                variant="ghost"
                className="gap-2"
                onClick={onExit}
              >
                <LogOut className="h-4 w-4" />
                Not you? Return home
              </Button>
              <Button className="gap-2" onClick={onConfirm}>
                <Play className="h-4 w-4" />
                Looks good — continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CandidateAssessmentShell({
  session,
  data,
  candidateName,
  instructions,
  timeLimitMinutes,
  isCompleted,
}: CandidateAssessmentShellProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { consent, proctoring, capture, questions, currentIndex, setCurrentIndex, getQuestionStatus, progress } = useCandidateAssessmentContext()
  const {
    status: captureStatus,
    lastUploadAt,
    pendingUploads,
    setStatus: setCaptureStatus,
    setLastUpload,
    setPendingUploads,
    restartToken: captureRestartToken,
    requestRestart: requestCaptureRestart,
  } = capture
  const submitMutation = useCandidateSubmit(data.assessment.id, session.token)

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [proctoringPanelOpen, setProctoringPanelOpen] = useState(false)

  const [verificationComplete, setVerificationComplete] = useState(false)
  const [fullscreenActive, setFullscreenActive] = useState<boolean>(() => {
    if (typeof document === "undefined") return false
    return Boolean(
      document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
    )
  })
  const hardwareGranted = consent.status?.camera === "granted" && consent.status?.microphone === "granted"
  const displayName = candidateName ?? session.candidate.email
  const latestEvent = proctoring.events[0]
  const lastWebcamUpload = lastUploadAt.webcam ? Date.parse(lastUploadAt.webcam) : null
  const lastScreenUpload = lastUploadAt.screen ? Date.parse(lastUploadAt.screen) : null
  const now = Date.now()
  const webcamStale = captureStatus.webcam === "active" && lastWebcamUpload !== null && now - lastWebcamUpload > 60_000
  const screenStale = captureStatus.screen === "active" && lastScreenUpload !== null && now - lastScreenUpload > 60_000
  const captureAlert = captureStatus.webcam === "error" || captureStatus.screen === "error" || webcamStale || screenStale
  const showFullscreenOverlay = verificationComplete && !isCompleted && !consent.open && !fullscreenActive

  // Progress calculations
  const answeredCount = progress?.responses?.filter(
    r => r.answer !== null && r.answer !== '' && !(Array.isArray(r.answer) && r.answer.length === 0)
  ).length ?? 0
  const progressPercentage = Math.round((answeredCount / questions.length) * 100)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const timerStartRef = useRef<number | null>(null)

  // Navigation helpers
  const currentQuestion = questions[currentIndex]
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < questions.length - 1

  const handleExit = () => {
    clearCandidateSession()

    // Try to close the window/tab
    if (window.opener || window.history.length === 1) {
      window.close()
    }

    // If window.close() didn't work (blocked by browser), show message
    setTimeout(() => {
      // Check if window is still open
      if (!window.closed) {
        alert("You can now close this tab/window safely.")
      }
    }, 100)
  }

  const handleVerificationConfirm = () => {
    console.log('[Assessment] Verification confirmed, will show consent dialog')
    setVerificationComplete(true)
    // Don't request fullscreen yet - wait for consent dialog to complete
    // Fullscreen will be requested after permissions are granted
  }

  const recordEventRef = useRef(proctoring.recordEvent)
  useEffect(() => {
    recordEventRef.current = proctoring.recordEvent
  }, [proctoring.recordEvent])

  const sendProctoringEvent = useCallback(
    (event: { type: string; severity?: "low" | "medium" | "high"; details?: unknown }) => {
      const occurredAt = new Date().toISOString()
      recordEventRef.current?.({
        type: event.type,
        severity: event.severity ?? "low",
        timestamp: occurredAt,
        details: event.details,
      })

      apiRequest({
        method: "POST",
        url: "/candidate/proctoring/events",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          events: [
            {
              type: event.type,
              severity: event.severity,
              details: event.details,
              occurredAt,
            },
          ],
        },
      }).catch(() => undefined)
    },
    [session.token]
  )

  const handleMediaError = useCallback(
    (channel: CaptureChannel, error: Error) => {
      sendProctoringEvent({
        type: "media_stream_error",
        severity: "high",
        details: { source: channel, message: error.message },
      })
      setCaptureStatus({ [channel]: "error" })
    },
    [sendProctoringEvent, setCaptureStatus],
  )

  const handleScreenReady = useCallback(() => {
    consent.setStatus({ screen: "granted" })
    setCaptureStatus({ screen: "active" })
  }, [consent, setCaptureStatus])

  const handleScreenDenied = useCallback(
    (error: Error) => {
      consent.setStatus({ screen: "denied" })
      setCaptureStatus({ screen: "error" })
      sendProctoringEvent({
        type: "media_stream_error",
        severity: "high",
        details: { source: "screen", message: error.message },
      })
    },
    [consent, setCaptureStatus, sendProctoringEvent],
  )

  const handleScreenEnded = useCallback(() => {
    consent.setStatus({ screen: "denied" })
    setCaptureStatus({ screen: "error" })
    sendProctoringEvent({
      type: "media_stream_error",
      severity: "medium",
      details: { source: "screen", message: "Candidate stopped sharing their screen" },
    })
  }, [consent, setCaptureStatus, sendProctoringEvent])

  const consentOpenedRef = useRef(false)
  const fullscreenPreviousRef = useRef(fullscreenActive)

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return
    const element = document.documentElement
    if (!element) return

    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        ;(element as any).webkitRequestFullscreen()
      } else if ((element as any).mozRequestFullScreen) {
        ;(element as any).mozRequestFullScreen()
      } else if ((element as any).msRequestFullscreen) {
        ;(element as any).msRequestFullscreen()
      }
    } catch (error) {
      sendProctoringEvent({
        type: "fullscreen_exit",
        severity: "high",
        details: { reason: "request_denied", message: (error as Error).message },
      })
    }
  }, [sendProctoringEvent])

  const handleCaptureRestart = useCallback(() => {
    setCaptureStatus({ webcam: "pending", screen: "pending" })
    setPendingUploads(0)
    consent.setStatus({ screen: "pending" })
    requestCaptureRestart()
    requestFullscreen()
  }, [setCaptureStatus, setPendingUploads, consent.setStatus, requestCaptureRestart, requestFullscreen])

  useEffect(() => {
    if (typeof document === "undefined") return

    const syncState = () => {
      const active = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      )
      const wasActive = fullscreenPreviousRef.current
      setFullscreenActive(active)
      if (wasActive && !active && verificationComplete && !isCompleted) {
        sendProctoringEvent({ type: "fullscreen_exit", severity: "high" })
      }
      fullscreenPreviousRef.current = active
    }

    syncState()
    document.addEventListener("fullscreenchange", syncState)
    document.addEventListener("webkitfullscreenchange", syncState as any)
    document.addEventListener("mozfullscreenchange", syncState as any)
    document.addEventListener("MSFullscreenChange", syncState as any)

    return () => {
      document.removeEventListener("fullscreenchange", syncState)
      document.removeEventListener("webkitfullscreenchange", syncState as any)
      document.removeEventListener("mozfullscreenchange", syncState as any)
      document.removeEventListener("MSFullscreenChange", syncState as any)
    }
  }, [sendProctoringEvent, verificationComplete, isCompleted])
  useEffect(() => {
    if (verificationComplete && !consentOpenedRef.current) {
      console.log('[Assessment] Opening proctoring consent dialog')
      consent.setStatus({ screen: "pending" })
      consent.setOpen(true)
      consentOpenedRef.current = true
    }
  }, [verificationComplete, consent])

  const handleWebcamStatusChange = useCallback(
    (status: CaptureStatusValue) => {
      setCaptureStatus({ webcam: status })
    },
    [setCaptureStatus],
  )

  const handleScreenStatusChange = useCallback(
    (status: CaptureStatusValue) => {
      setCaptureStatus({ screen: status })
    },
    [setCaptureStatus],
  )

  const handlePendingChange = useCallback(
    (pending: number) => {
      setPendingUploads(pending)
    },
    [setPendingUploads],
  )

  const handleUploadSuccess = useCallback(
    (channel: CaptureChannel, timestamp: string) => {
      setLastUpload(channel, timestamp)
      if (captureStatus[channel] !== "active") {
        setCaptureStatus({ [channel]: "active" })
      }
    },
    [setLastUpload, captureStatus, setCaptureStatus],
  )

  // Timer logic
  useEffect(() => {
    if (!timeLimitMinutes || timeLimitMinutes <= 0 || !data.session.startedAt) {
      setTimeRemaining(null)
      timerStartRef.current = null
      return
    }

    // Lock in the start timestamp on first render only to prevent timer resets
    if (timerStartRef.current === null) {
      timerStartRef.current = new Date(data.session.startedAt).getTime()
      console.log('[Timer] Locked start time:', new Date(timerStartRef.current).toISOString())
    }

    const totalSeconds = timeLimitMinutes * 60
    const startTs = timerStartRef.current

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTs) / 1000)
      const remaining = Math.max(totalSeconds - elapsed, 0)
      setTimeRemaining(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [timeLimitMinutes, data.session.startedAt])

  // Auto-submit when timer expires
  useEffect(() => {
    if (timeRemaining === 0 && !isCompleted && !submitMutation.isPending) {
      console.log('[Timer] ⏰ Time expired! Auto-submitting assessment...')
      submitMutation.mutate()
    }
  }, [timeRemaining, isCompleted, submitMutation])

  // Handle submit with pending uploads validation
  const handleSubmit = () => {
    // Check for pending uploads
    if (pendingUploads > 0) {
      const totalPending = pendingUploads
      const message =
        `You have ${totalPending} recording chunk${totalPending > 1 ? 's' : ''} still uploading.\n\n` +
        `Submitting now may result in incomplete proctoring recordings. ` +
        `Wait for uploads to finish?\n\n` +
        `Click "OK" to wait, or "Cancel" to submit anyway.`

      const shouldWait = window.confirm(message)
      if (shouldWait) {
        return // Don't submit, wait for uploads
      }
    }

    // Proceed with submission
    submitMutation.mutate()
  }

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "No limit"
    if (seconds <= 0) return "00:00"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const isLowTime = timeRemaining !== null && timeRemaining <= 300 && timeRemaining > 0
  const isVeryLowTime = timeRemaining !== null && timeRemaining <= 60 && timeRemaining > 0

  // Screen recording and fullscreen are mutually exclusive due to browser security
  // When screen recording is enabled, don't require fullscreen (browser forces exit when requesting screen share)
  const shouldCapture = verificationComplete && !consent.open && hardwareGranted && !isCompleted

  useEffect(() => {
    console.log('[Assessment] shouldCapture evaluation:', {
      shouldCapture,
      verificationComplete,
      consentOpen: consent.open,
      hardwareGranted,
      isCompleted,
      note: 'Fullscreen disabled due to screen recording browser security'
    })

    if (shouldCapture) {
      console.log('[Assessment] ✅ Recording enabled! Starting proctoring...')
      setCaptureStatus({ webcam: "pending", screen: "pending" })
      setPendingUploads(0)
    }
  }, [shouldCapture, captureRestartToken, setCaptureStatus, setPendingUploads, verificationComplete, consent.open, hardwareGranted, isCompleted, fullscreenActive])

  useEffect(() => {
    if (!fullscreenActive && verificationComplete && !isCompleted) {
      setCaptureStatus({ webcam: "pending", screen: "pending" })
    }
  }, [fullscreenActive, verificationComplete, isCompleted, setCaptureStatus])

  useProctoringSignals({
    token: shouldCapture ? session.token : undefined,
    assessmentId: data.assessment.id,
    onEvent: proctoring.recordEvent,
  })

  // Check proctoring settings to determine what to record
  const proctoringSettings = data.assessment.settings?.proctoringSettings
  const shouldRecordScreen = shouldCapture && proctoringSettings?.recordScreen === true
  const shouldRecordWebcam = shouldCapture && proctoringSettings?.recordWebcam === true

  useProctoringMediaStreams({
    enabled: shouldCapture && (shouldRecordScreen || shouldRecordWebcam),
    token: session.token,
    assessmentId: data.assessment.id,
    onError: handleMediaError,
    includeScreen: shouldRecordScreen,
    includeWebcam: shouldRecordWebcam,
    onScreenReady: handleScreenReady,
    onScreenDenied: handleScreenDenied,
    onScreenEnded: handleScreenEnded,
    onWebcamStatusChange: handleWebcamStatusChange,
    onScreenStatusChange: handleScreenStatusChange,
    onPendingChange: handlePendingChange,
    onUploadSuccess: handleUploadSuccess,
    restartToken: capture.restartToken,
  })

  if (!verificationComplete) {
    return (
      <CandidateVerificationStep
        candidateName={displayName}
        candidateEmail={session.candidate.email}
        candidateRole={session.candidate.position}
        instructions={instructions}
        assessmentTitle={data.assessment.title}
        onConfirm={handleVerificationConfirm}
        onExit={handleExit}
      />
    )
  }

  return (
    <>
      <ProctoringConsentDialog
        open={consent.open && verificationComplete}
        onContinue={async () => {
          console.log('[Assessment] User clicked Continue - permissions granted')

          // Call backend to start the assessment and create AssessmentResult with startedAt
          try {
            console.log('[Assessment] Calling start assessment endpoint...')
            await apiRequest({
              method: 'POST',
              url: `/candidate/assessments/${data.assessment.id}/start`,
              headers: {
                Authorization: `Bearer ${session.token}`,
              },
            })
            console.log('[Assessment] ✅ Assessment started, invalidating cache to refetch with startedAt')

            // Invalidate cache to refetch assessment data with the new startedAt timestamp
            queryClient.invalidateQueries({ queryKey: candidateKeys.assessment(data.assessment.id) })
          } catch (error) {
            console.error('[Assessment] ❌ Failed to start assessment:', error)
            // Continue anyway - the old flow will create AssessmentResult on first answer save as fallback
          }

          // Permissions verified - update status and close dialog
          consent.setStatus({
            camera: "granted",
            microphone: "granted",
            screen: "granted"
          })
          consent.setOpen(false)
          console.log('[Assessment] Consent dialog closed, starting recording (skipping fullscreen due to screen recording)')
          // Note: We skip fullscreen when screen recording is enabled because browsers
          // force fullscreen exit when requesting screen share permission, creating an infinite loop
        }}
        onCancel={handleExit}
      />

      {/* Fullscreen Overlay - Hidden when screen recording is active (browser security restriction) */}
      {false && showFullscreenOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <Card className="max-w-md border border-border bg-card shadow-xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-semibold text-foreground">Full-screen required</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Stay in full-screen mode for the duration of the assessment. Leaving full-screen triggers proctoring alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Click the button below to resume full-screen monitoring.</p>
              <Button className="gap-2 w-full" onClick={requestFullscreen}>
                Enter full screen
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky Top Navigation Bar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 gap-4">
          {/* Left: Assessment Info */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden rounded-md p-2 hover:bg-muted"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">{data.assessment.title}</h1>
              <p className="text-xs text-muted-foreground truncate">{displayName}</p>
            </div>
          </div>

          {/* Center: Progress */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-xs text-muted-foreground">
              Question <span className="font-semibold text-foreground">{currentIndex + 1}</span>/{questions.length}
            </div>
            <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="text-xs font-medium text-emerald-600">{progressPercentage}%</div>
          </div>

          {/* Right: Timer & Actions */}
          <div className="flex items-center gap-3">
            {timeRemaining !== null && (
              <div
                className={`hidden sm:flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isVeryLowTime
                    ? 'bg-red-100 text-red-700 animate-pulse'
                    : isLowTime
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(timeRemaining)}
              </div>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isCompleted || submitMutation.isPending}
              className="gap-2"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{submitMutation.isPending ? "Submitting…" : "Submit"}</span>
              <span className="sm:hidden">Submit</span>
            </Button>
          </div>
        </div>

        {/* Mobile Progress Bar */}
        <div className="md:hidden border-t border-border bg-muted/30 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span className="font-medium text-emerald-600">{progressPercentage}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(captureAlert || pendingUploads > 0 || latestEvent) && (
        <div className="border-b border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-3 space-y-2">
            {captureAlert && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <strong className="block text-red-900">Proctoring Interrupted</strong>
                    <p className="mt-1 text-red-700">
                      {captureStatus.webcam === "error" || webcamStale ? "Webcam recording has stopped. " : ""}
                      {captureStatus.screen === "error" || screenStale ? "Screen recording is inactive. " : ""}
                      Click to restart monitoring.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={handleCaptureRestart} className="gap-2">
                  <Play className="h-4 w-4" />
                  Restart
                </Button>
              </div>
            )}

            {!captureAlert && pendingUploads > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading proctoring data ({pendingUploads} segments pending)</span>
              </div>
            )}

            {!captureAlert && latestEvent && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                <strong className="mr-2">Heads up:</strong>
                We detected <span className="font-medium">{latestEvent.type.replace(/_/g, " ")}</span>. Stay focused.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6 lg:flex-row flex-col">
          {/* Sidebar - Question Navigator */}
          <aside
            className={`${
              sidebarOpen ? 'fixed inset-0 z-40 bg-background p-4 overflow-y-auto' : 'hidden'
            } lg:block lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:w-[280px] lg:flex-shrink-0 lg:overflow-y-auto`}
          >
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              {sidebarOpen && (
                <div className="flex items-center justify-between mb-4 lg:hidden">
                  <h2 className="text-sm font-semibold text-foreground">Navigation</h2>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="rounded-md p-2 hover:bg-muted"
                    aria-label="Close sidebar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}

              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1">Questions</h2>
                <p className="text-xs text-muted-foreground">
                  {answeredCount} of {questions.length} answered
                </p>
              </div>

              {/* Question Grid */}
              <div className="grid grid-cols-4 gap-2">
                {questions.map((question, index) => {
                  const status = getQuestionStatus(question.id)
                  const isActive = index === currentIndex

                  return (
                    <button
                      key={question.id}
                      onClick={() => {
                        setCurrentIndex(index)
                        setSidebarOpen(false)
                      }}
                      className={`relative aspect-square rounded-lg border-2 text-xs font-semibold transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : status === 'answered'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                            : status === 'in_progress'
                              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300'
                              : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center">
                        {question.order}
                      </span>
                      {status === 'answered' && (
                        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="space-y-2 pt-4 border-t border-border">
                <h3 className="text-xs font-medium text-muted-foreground">Legend</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border-2 border-blue-500 bg-blue-50" />
                    <span className="text-muted-foreground">Current</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border-2 border-emerald-200 bg-emerald-50" />
                    <span className="text-muted-foreground">Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border-2 border-amber-200 bg-amber-50" />
                    <span className="text-muted-foreground">In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border-2 border-gray-200 bg-gray-50" />
                    <span className="text-muted-foreground">Not Started</span>
                  </div>
                </div>
              </div>

              {/* Proctoring Status */}
              <button
                onClick={() => setProctoringPanelOpen(!proctoringPanelOpen)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span>Proctoring Status</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${proctoringPanelOpen ? 'rotate-90' : ''}`} />
              </button>

              {proctoringPanelOpen && (
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Webcam', status: captureStatus.webcam, icon: '📹' },
                    { label: 'Screen', status: captureStatus.screen, icon: '🖥️' },
                  ].map(({ label, status, icon }) => (
                    <div key={label} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <span className="text-foreground">{label}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {status === 'active' ? '● Live' : status === 'error' ? 'Error' : 'Idle'}
                      </span>
                    </div>
                  ))}
                  {(lastUploadAt.webcam || lastUploadAt.screen) && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                      {lastUploadAt.webcam && (
                        <span>📹 {new Date(lastUploadAt.webcam).toLocaleTimeString()}</span>
                      )}
                      {lastUploadAt.screen && (
                        <span>🖥️ {new Date(lastUploadAt.screen).toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Main Question Area */}
          <main className="flex-1 space-y-4 min-w-0">
            {/* Question Card */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        Question {currentIndex + 1}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 uppercase">
                        {currentQuestion?.type}
                      </span>
                      {currentQuestion?.points && (
                        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          {currentQuestion.points} pts
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg">{currentQuestion?.title}</CardTitle>
                    {currentQuestion?.difficulty && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Difficulty: <span className="capitalize">{currentQuestion.difficulty}</span>
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <CandidateQuestionView token={session.token} />
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(currentIndex - 1)}
                disabled={!canGoPrev || !assessment.settings?.allowReviewAnswers}
                className="gap-2"
                title={
                  !assessment.settings?.allowReviewAnswers
                    ? "Review is not allowed for this assessment"
                    : undefined
                }
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="text-xs text-muted-foreground lg:hidden">
                {currentIndex + 1} / {questions.length}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentIndex(currentIndex + 1)}
                disabled={!canGoNext}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Exit Button */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Ready to finish?</p>
                  <Button
                    variant="ghost"
                    className="gap-2"
                    onClick={handleExit}
                  >
                    <LogOut className="h-4 w-4" />
                    Exit Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </>
  )
}
