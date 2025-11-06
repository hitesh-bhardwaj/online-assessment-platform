"use client"

import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Copy, Mail, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useRecruiterInvitation, useResendRecruiterInvitation, useCancelRecruiterInvitation } from "@/hooks/use-recruiter-invitations"

const statusVariant: Record<string, "secondary" | "outline" | "destructive" | "default"> = {
  pending: "outline",
  started: "secondary",
  submitted: "default",
  expired: "destructive",
  cancelled: "destructive",
}

export function RecruiterInvitationDetailView() {
  const params = useParams()
  const router = useRouter()
  const invitationId = params.id as string

  const { data: invitation, isLoading, isError, error } = useRecruiterInvitation(invitationId)
  const resendMutation = useResendRecruiterInvitation()
  const cancelMutation = useCancelRecruiterInvitation()

  const handleCopyLink = () => {
    if (!invitation) return
    const baseUrl = window.location.origin
    const link = `${baseUrl}/assessment/${invitation.token}`
    navigator.clipboard.writeText(link).then(() => {
      toast.success("Link copied to clipboard", {
        description: "Assessment invitation link has been copied",
      })
    }).catch(() => {
      toast.error("Failed to copy link", {
        description: "Please try again",
      })
    })
  }

  const handleResend = async () => {
    try {
      await resendMutation.mutateAsync(invitationId)
    } catch (error) {
      // Error is already handled by the mutation hook
    }
  }

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return

    try {
      await cancelMutation.mutateAsync(invitationId)
      toast.success("Invitation cancelled successfully")
      router.push("/recruiter/invitations")
    } catch (error: any) {
      toast.error("Failed to cancel invitation", {
        description: error?.message || "Please try again later",
      })
    }
  }

  const handleViewAssessment = () => {
    if (invitation?.assessment.id) {
      router.push(`/recruiter/assessments/${invitation.assessment.id}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-sm text-muted-foreground">Loading invitation details...</div>
        </div>
      </div>
    )
  }

  if (isError || !invitation) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Failed to load invitation</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message ?? "The invitation could not be loaded. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const candidateName = `${invitation.candidate.firstName} ${invitation.candidate.lastName}`.trim()
  const isExpiredOrCancelled = invitation.status === "expired" || invitation.status === "cancelled"
  const canResend = !isExpiredOrCancelled

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Invitation Details</h1>
            <p className="text-sm text-muted-foreground">Manage candidate invitation and track progress</p>
          </div>
        </div>
        <Badge variant={statusVariant[invitation.status] ?? "outline"} className="uppercase">
          {invitation.status}
        </Badge>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage this invitation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopyLink} variant="outline">
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
            <Button
              onClick={handleResend}
              variant="outline"
              disabled={!canResend || resendMutation.isPending}
            >
              <Mail className="mr-2 h-4 w-4" />
              {resendMutation.isPending ? "Resending..." : "Resend Email"}
            </Button>
            <Button
              onClick={handleCancel}
              variant="destructive"
              disabled={isExpiredOrCancelled || cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Invitation"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Candidate Information */}
      <Card>
        <CardHeader>
          <CardTitle>Candidate Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-base">{candidateName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-base">{invitation.candidate.email}</p>
            </div>
            {invitation.candidate.phone && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="text-base">{invitation.candidate.phone}</p>
              </div>
            )}
            {invitation.candidate.position && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Position</p>
                <p className="text-base">{invitation.candidate.position}</p>
              </div>
            )}
            {invitation.candidate.resumeUrl && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resume</p>
                <a
                  href={invitation.candidate.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-base text-primary hover:underline"
                >
                  View Resume
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assessment Information */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Title</p>
              <div className="flex items-center gap-2">
                <p className="text-base">{invitation.assessment.title}</p>
                <Button variant="ghost" size="sm" onClick={handleViewAssessment}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="text-base uppercase">{invitation.assessment.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="text-base">{invitation.assessment.durationMinutes} minutes</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Questions</p>
              <p className="text-base">{invitation.assessment.questions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invitation Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-base">{new Date(invitation.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valid From</p>
              <p className="text-base">{new Date(invitation.validFrom).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
              <p className="text-base">{new Date(invitation.validUntil).toLocaleString()}</p>
            </div>
            {invitation.startedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Started At</p>
                <p className="text-base">{new Date(invitation.startedAt).toLocaleString()}</p>
              </div>
            )}
            {invitation.submittedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted At</p>
                <p className="text-base">{new Date(invitation.submittedAt).toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
              <p className="text-base">{new Date(invitation.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Message */}
      {invitation.customMessage && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{invitation.customMessage}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
