"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useRecruiterAssessments } from "@/hooks/use-recruiter-assessments"
import { useRecruiterInvitations } from "@/hooks/use-recruiter-invitations"
import { useRecruiterResults } from "@/hooks/use-recruiter-results"

export default function RecruiterDashboardPage() {
  const {
    data: assessmentsData,
    isLoading: assessmentsLoading,
    isFetching: assessmentsFetching,
    isError: assessmentsError,
    error: assessmentsErrorObject,
  } = useRecruiterAssessments({ page: 1, limit: 10 })

  const {
    data: invitationsData,
    isLoading: invitationsLoading,
    isFetching: invitationsFetching,
    isError: invitationsError,
    error: invitationsErrorObject,
  } = useRecruiterInvitations({ page: 1, limit: 10 })

  const {
    data: resultsData,
    isLoading: resultsLoading,
    isFetching: resultsFetching,
    isError: resultsError,
    error: resultsErrorObject,
  } = useRecruiterResults({ page: 1, limit: 10 })

  const assessments = assessmentsData?.items ?? []
  const invitations = invitationsData?.items ?? []
  const results = resultsData?.items ?? []
  const awaitingReview = resultsData?.pagination.total ?? results.length

  const showSkeleton =
    assessmentsLoading &&
    invitationsLoading &&
    resultsLoading &&
    assessments.length === 0 &&
    invitations.length === 0 &&
    results.length === 0
  const showError = assessmentsError || invitationsError || resultsError

  const activeAssessments = assessmentsData?.pagination.total ?? assessments.length
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending").length
  const isRefreshing = assessmentsFetching || invitationsFetching || resultsFetching

  return (
    <div className="grid gap-6">
      {showError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load the latest recruiter metrics</AlertTitle>
          <AlertDescription>
            {(assessmentsErrorObject as Error | undefined)?.message ||
              (invitationsErrorObject as Error | undefined)?.message ||
              (resultsErrorObject as Error | undefined)?.message ||
              "Please confirm the recruiter APIs are reachable."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Today&apos;s pipeline</CardTitle>
            <CardDescription>
              These metrics reflect the assessments, invitations, and result endpoints surfaced through the new recruiter proxy.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Sprint goal: 24 hires</Badge>
            <Badge variant="outline">SLA 48h review</Badge>
            {isRefreshing ? <Badge variant="outline">Refreshing…</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {showSkeleton ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <PipelineMetric
                label="Active assessments"
                value={`${activeAssessments}`}
                caption="Drafts and published"
              />
              <PipelineMetric
                label="Pending invitations"
                value={`${pendingInvitations}`}
                caption="Awaiting candidate action"
              />
              <PipelineMetric
                label="Awaiting review"
                value={`${awaitingReview}`}
                caption="Submissions in triage"
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>
            These CTAs will route to their respective flows once the API layer is wired in. They help validate navigation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button size="sm">Create assessment</Button>
          <Button size="sm" variant="outline">
            Invite candidates
          </Button>
          <Button size="sm" variant="ghost">
            View results
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function PipelineMetric({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground/80">{caption}</p>
    </div>
  )
}
