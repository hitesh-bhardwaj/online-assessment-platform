/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { use, useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, LogOut, Play, Loader2, ChevronLeft, ChevronRight, Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CandidateSession, clearCandidateSession, getCandidateSession } from "@/lib/candidate-session"
import { apiRequest } from "@/lib/api-client"
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
// import { useProctoringMediaStreams } from "@/features/candidate-assessment/use-proctoring-media"
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

              {summary?.score ? (
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

  // Navigation helpers
  const currentQuestion = questions[currentIndex]
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < questions.length - 1

  const handleExit = () => {
    clearCandidateSession()
    router.push("/")
  }

  const handleVerificationConfirm = () => {
    setVerificationComplete(true)
    requestFullscreen()
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
      return
    }

    const totalSeconds = timeLimitMinutes * 60
    const startTs = new Date(data.session.startedAt).getTime()

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTs) / 1000)
      const remaining = Math.max(totalSeconds - elapsed, 0)
      setTimeRemaining(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [timeLimitMinutes, data.session.startedAt])

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "No limit"
    if (seconds <= 0) return "00:00"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const isLowTime = timeRemaining !== null && timeRemaining <= 300 && timeRemaining > 0
  const isVeryLowTime = timeRemaining !== null && timeRemaining <= 60 && timeRemaining > 0

  const shouldCapture = verificationComplete && !consent.open && hardwareGranted && !isCompleted && fullscreenActive

  useEffect(() => {
    if (shouldCapture) {
      setCaptureStatus({ webcam: "pending", screen: "pending" })
      setPendingUploads(0)
    }
  }, [shouldCapture, captureRestartToken, setCaptureStatus, setPendingUploads])

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

  useProctoringMediaStreams({
    enabled: shouldCapture,
    token: session.token,
    assessmentId: data.assessment.id,
    onError: handleMediaError,
    includeScreen: true,
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
        onContinue={() => consent.setOpen(false)}
        onCancel={handleExit}
        onStatusChange={consent.setStatus}
      />
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {showFullscreenOverlay ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/95 px-4 py-10 backdrop-blur-sm">
              <Card className="max-w-md border border-border bg-card shadow-xl">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl font-semibold text-foreground">Full-screen required</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Stay in full-screen mode for the duration of the assessment. Leaving full-screen triggers proctoring alerts and pauses the recording.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>Click the button below to resume full-screen monitoring. If you exited intentionally, please return as soon as possible.</p>
                  <Button className="gap-2" onClick={requestFullscreen}>
                    Enter full screen
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {captureAlert ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <strong className="block text-red-900">Proctoring Interrupted</strong>
                  <p className="mt-1 text-red-700">
                    {captureStatus.webcam === "error" || webcamStale
                      ? "Webcam recording has stopped. "
                      : ""}
                    {captureStatus.screen === "error" || screenStale
                      ? "Screen recording is inactive. "
                      : ""}
                    Click below to restart monitoring.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={handleCaptureRestart} className="gap-2">
                <Play className="h-4 w-4" />
                Restart Now
              </Button>
            </div>
          ) : pendingUploads > 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading proctoring data ({pendingUploads} segments pending)</span>
              </div>
            </div>
          ) : null}

          {latestEvent ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <strong className="mr-2">Heads up:</strong>
              We detected <span className="font-medium">{latestEvent.type.replace(/_/g, " ")}</span>. Stay focused to keep the session in good standing.
            </div>
          ) : null}
          <header className="rounded-xl border border-border bg-card p-6 shadow">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3 flex-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Candidate</p>
                <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
                {session.candidate.position ? (
                  <p className="text-sm text-muted-foreground">Role: {session.candidate.position}</p>
                ) : null}
              </div>
              <div className="space-y-3 rounded-lg border border-border bg-muted/60 p-4 text-sm min-w-[280px]">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Assessment</p>
                  <p className="text-lg font-medium text-foreground">{data.assessment.title ?? "Assessment"}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="capitalize">
                      Status: <span className="font-medium text-foreground">{isCompleted ? "Completed" : "In Progress"}</span>
                    </span>
                    <span>
                      Progress: <span className="font-medium text-foreground">
                        {data.progress?.responses?.filter(r => r.answer !== null && r.answer !== '' && !(Array.isArray(r.answer) && r.answer.length === 0)).length ?? 0}/{data.assessment.questionCount}
                      </span>
                    </span>
                  </div>
                </div>
                {timeLimitMinutes > 0 ? (
                  <CandidateTimer timeLimitMinutes={timeLimitMinutes} startedAt={data.session.startedAt} />
                ) : (
                  <div className="rounded-lg border border-border bg-blue-50 px-4 py-3 text-sm">
                    <span className="text-xs uppercase tracking-wide text-blue-700">No Time Limit</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 space-y-4 rounded-lg border border-border bg-muted/70 p-5 text-sm">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Assessment Instructions</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {instructions
                    ? instructions
                    : "Complete all questions within the time limit. Your session is being monitored for integrity. Good luck!"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proctoring Status</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      label: 'Webcam',
                      status: captureStatus.webcam,
                      granted: consent.status?.camera === 'granted',
                      icon: '📹',
                    },
                    {
                      label: 'Microphone',
                      status: captureStatus.webcam,
                      granted: consent.status?.microphone === 'granted',
                      icon: '🎤',
                    },
                    {
                      label: 'Screen Recording',
                      status: captureStatus.screen,
                      granted: consent.status?.screen === 'granted',
                      icon: '🖥️',
                    },
                  ].map(({ label, status, granted, icon }) => (
                    <div key={label} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-xs">
                      <span className="text-base">{icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{label}</p>
                        <span
                          className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : status === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : granted
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {status === 'active'
                            ? '● Recording'
                            : status === 'pending'
                              ? '⏳ Starting'
                              : status === 'error'
                                ? '✗ Error'
                                : granted
                                  ? '✓ Ready'
                                  : 'Awaiting'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {(lastUploadAt.webcam || lastUploadAt.screen) && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    {lastUploadAt.webcam && (
                      <span>Webcam: {new Date(lastUploadAt.webcam).toLocaleTimeString()}</span>
                    )}
                    {lastUploadAt.screen && (
                      <span>Screen: {new Date(lastUploadAt.screen).toLocaleTimeString()}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
            <aside className="space-y-4 rounded-xl border border-border bg-card p-4">
              <CandidateQuestionNavigator />
            </aside>
            <main className="space-y-4">
              <CandidateQuestionView token={session.token} />
              {data.resultSummary && isCompleted ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  <h2 className="text-lg font-semibold text-foreground">Assessment submitted</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Submitted on {data.resultSummary.submittedAt ? new Date(data.resultSummary.submittedAt).toLocaleString() : "just now"}
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-foreground">
                    <p>
                      Score: <span className="font-semibold">{data.resultSummary.score.earned}</span> / {data.resultSummary.score.total} points ({data.resultSummary.score.percentage}%)
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                <Button
                  className="gap-2"
                  onClick={() => submitMutation.mutate()}
                  disabled={isCompleted || submitMutation.isPending}
                >
                  <Play className="h-4 w-4" />
                  {submitMutation.isPending ? "Submitting…" : isCompleted ? "Submitted" : "Submit assessment"}
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    clearCandidateSession()
                    router.push("/")
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Exit session
                </Button>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  )
}
