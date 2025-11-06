"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRecruiterInvitations, useResendRecruiterInvitation } from "@/hooks/use-recruiter-invitations"
import { toast } from "sonner"

const statusVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  started: "secondary",
  submitted: "secondary",
  expired: "destructive",
  cancelled: "destructive",
}

const PAGE_SIZE = 10

export function RecruiterInvitationsView() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")

  const { data, isLoading, isFetching, isError, error } = useRecruiterInvitations({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : (status as "pending" | "started" | "submitted" | "expired" | "cancelled"),
    search: search.trim() || undefined,
  })

  const resendMutation = useResendRecruiterInvitation()

  const handleRowClick = (invitationId: string) => {
    router.push(`/recruiter/invitations/${invitationId}`)
  }

  const handleResend = async (invitationId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await resendMutation.mutateAsync(invitationId)
    } catch (error) {
      // Error is already handled by the mutation hook
    }
  }

  const handleCopyLink = (invitationId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const baseUrl = window.location.origin
    const link = `${baseUrl}/assessment/${invitationId}`
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

  const invitations = data?.items ?? []
  const pagination = data?.pagination ?? {
    page: 1,
    limit: PAGE_SIZE,
    total: invitations.length,
    pages: 1,
  }

  const isPageEmpty = !isLoading && invitations.length === 0

  const rangeLabel = useMemo(() => {
    if (pagination.total === 0) return "0–0"
    const start = (pagination.page - 1) * pagination.limit + 1
    const end = start + invitations.length - 1
    return `${Math.min(start, pagination.total)}–${Math.max(start, Math.min(end, pagination.total))}`
  }, [invitations.length, pagination.limit, pagination.page, pagination.total])

  const handlePrev = () => setPage((current) => Math.max(1, current - 1))
  const handleNext = () => setPage((current) => (current < pagination.pages ? current + 1 : current))

  return (
    <div className="grid gap-6">
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Recent invitations are unavailable</AlertTitle>
          <AlertDescription>
            {(error as Error | undefined)?.message ?? "Ensure the recruiter invitations API is responding."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle>Recent invitations</CardTitle>
            <CardDescription>Track which candidates have been invited and their current status.</CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
            />
            <Select
              value={status}
              onValueChange={(value) => {
                setPage(1)
                setStatus(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="started">Started</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-[35%]">Candidate</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent at</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        Loading invitations…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isPageEmpty ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                        <p>No invitations match the current filters.</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStatus("all")
                            setSearch("")
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((invitation) => (
                    <TableRow
                      key={invitation.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(invitation.id)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground">{invitation.candidate.name}</span>
                          <span className="text-xs text-muted-foreground">{invitation.candidate.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{invitation.assessmentTitle}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[invitation.status] ?? "outline"} className="uppercase">
                          {invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(invitation.sentAt).toLocaleString()}</TableCell>
                      <TableCell>{new Date(invitation.validUntil).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleResend(invitation.id, e)}
                            disabled={resendMutation.isPending || invitation.status === "cancelled" || invitation.status === "expired"}
                          >
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleCopyLink(invitation.id, e)}
                          >
                            Copy link
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              Showing {rangeLabel} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrev} disabled={pagination.page <= 1 || isFetching}>
                Previous
              </Button>
              <span className="text-xs">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={pagination.page >= pagination.pages || isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
