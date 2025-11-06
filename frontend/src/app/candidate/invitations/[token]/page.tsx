"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveCandidateSession, clearCandidateSession } from "@/lib/candidate-session"

type CandidateAuthSuccess = {
  success: true
  message: string
  data: {
    token: string
    expiresIn: string | number
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
}

type CandidateAuthFailure = {
  success: false
  message: string
  details?: unknown
}

type CandidateAuthResponse = CandidateAuthSuccess | CandidateAuthFailure

interface CandidateInvitationPageProps {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default function CandidateInvitationPage({ params, searchParams }: CandidateInvitationPageProps) {
  const router = useRouter()
  const [state, setState] = useState<{ status: "loading" | "error"; message?: string }>({ status: "loading" })

  const resolvedParams = use(params)
  const resolvedSearchParams = use(searchParams)
  const token = resolvedParams.token
  const retryKey = useMemo(() => (resolvedSearchParams?.retry as string | undefined) ?? undefined, [resolvedSearchParams])

  const authenticate = useCallback(async () => {
    setState({ status: "loading" })

    try {
      clearCandidateSession()

      const response = await fetch("/api/auth/candidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
        cache: "no-store",
      })

      const payload = (await response.json()) as CandidateAuthResponse

      if (!response.ok || !payload.success) {
        const message =
          !payload.success && payload.message
            ? payload.message
            : "We were unable to verify your invitation. Please check with your recruiter."
        setState({ status: "error", message })
        return
      }

      saveCandidateSession({
        token: payload.data.token,
        expiresIn: payload.data.expiresIn,
        candidate: payload.data.candidate,
        session: payload.data.session,
        assessment: payload.data.assessment,
        organization: payload.data.organization,
      })

      router.replace(`/candidate/sessions/${payload.data.session.assessmentId}`)
    } catch {
      setState({
        status: "error",
        message: "Something went wrong while validating your invitation. Please try again.",
      })
    }
  }, [router, token])

  useEffect(() => {
    authenticate()
  }, [authenticate, retryKey])

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md shadow bg-card">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Checking your invitation
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              We’re confirming your access with the assessment provider. This only takes a moment.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Please keep this tab open while we prepare your secure candidate workspace.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md bg-slate-950 border border-red-500/60 text-slate-100 shadow-xl">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertCircle className="h-5 w-5" />
            Unable to continue
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {state.message ??
              "We couldn’t verify this invitation. It may have expired or been revoked by the recruiting team."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>If you think this is a mistake, reach out to your recruiter and share the invitation link.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => authenticate()}
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button
              variant="ghost"
              className="gap-2 text-slate-200 hover:text-slate-100"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
