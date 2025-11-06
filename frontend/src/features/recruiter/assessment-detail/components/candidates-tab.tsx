"use client"

import { Loader2, PlusCircle } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { InlineToast } from "@/components/ui/inline-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TablePagination } from "@/components/shared/table-pagination"
import type { InvitationSummary } from "@/lib/recruiter-data"

export type InvitationStatusFilter = "all" | InvitationSummary["status"]

type PaginationSnapshot = {
  page: number
  limit: number
  total: number
}

export interface AssessmentCandidatesTabProps {
  invitations: InvitationSummary[]
  isLoading: boolean
  search: string
  status: InvitationStatusFilter
  statusOptions: Array<{ value: InvitationStatusFilter; label: string }>
  invitationStatusVariants: Record<InvitationSummary["status"], "outline" | "secondary" | "destructive">
  pagination?: PaginationSnapshot
  onSearchChange: (value: string) => void
  onStatusChange: (value: InvitationStatusFilter) => void
  onClearFilters: () => void
  onPageChange: (page: number) => void
  onResendInvitation: (invitationId: string) => void
  resendPendingId: string | null
  isResendPending: boolean
  onCancelInvitation: (invitationId: string) => void
  cancelPendingId: string | null
  isCancelPending: boolean
  formatDateTime: (value?: string) => string
  formatStatusLabel: (value: string) => string
  onInviteCandidate: () => void
  inviteDisabled?: boolean
}

export function AssessmentCandidatesTab({
  invitations,
  isLoading,
  search,
  status,
  statusOptions,
  invitationStatusVariants,
  pagination,
  onSearchChange,
  onStatusChange,
  onClearFilters,
  onPageChange,
  onResendInvitation,
  resendPendingId,
  isResendPending,
  onCancelInvitation,
  cancelPendingId,
  isCancelPending,
  formatDateTime,
  formatStatusLabel,
  onInviteCandidate,
  inviteDisabled = false,
}: AssessmentCandidatesTabProps) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Track candidate access and resend invites when needed.</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={onInviteCandidate} disabled={inviteDisabled}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Invite candidate
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search candidates…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full sm:w-56"
            />
            <Select
              value={status}
              onValueChange={(value) => onStatusChange(value as InvitationStatusFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              disabled={!search && status === "all"}
            >
              Clear filters
            </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading invitations…
          </div>
        ) : invitations.length === 0 ? (
          <InlineToast
            variant="default"
            title="No invitations yet"
            description="Send an invitation to the first candidate to see activity here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => {
                  const resendPending = isResendPending && resendPendingId === invitation.id
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell>{invitation.candidate.name}</TableCell>
                      <TableCell className="font-mono text-xs sm:text-sm">{invitation.candidate.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={invitationStatusVariants[invitation.status] ?? "outline"}
                          className="capitalize"
                        >
                          {formatStatusLabel(invitation.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(invitation.sentAt)}</TableCell>
                      <TableCell>{formatDateTime(invitation.validUntil)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={invitation.status !== "pending" || resendPending}
                            onClick={() => onResendInvitation(invitation.id)}
                          >
                            {resendPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Resend
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={invitation.status !== "pending" || (isCancelPending && cancelPendingId === invitation.id)}
                            onClick={() => onCancelInvitation(invitation.id)}
                          >
                            {isCancelPending && cancelPendingId === invitation.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {pagination ? (
          <TablePagination
            page={pagination.page}
            pageSize={pagination.limit}
            totalItems={pagination.total}
            onPageChange={onPageChange}
            disabled={isLoading}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
