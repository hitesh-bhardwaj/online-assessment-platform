"use client"

import Link from "next/link"
import { ArrowUpRight, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/shared"
import type { AssessmentDetail } from "@/hooks/use-recruiter-assessment"

import type { QuestionOutlineRow } from "../types"
import { formatDateTime } from "../utils"

export interface AssessmentOverviewTabProps {
  assessment: AssessmentDetail
  statusLabel: string
  statusVariant: "secondary" | "outline" | "destructive"
  questionRows: QuestionOutlineRow[]
  questionColumns: DataTableColumn<QuestionOutlineRow>[]
  basePath: string
}

export function AssessmentOverviewTab({
  assessment,
  statusLabel,
  statusVariant,
  onInviteCandidate,
  setActiveTab,
  questionbank,
  questionRows,
  questionColumns,
  basePath,
}: AssessmentOverviewTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Assessment snapshot</CardTitle>
          <CardDescription>High-level status and configuration details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Status</h3>
            <div className=" text-sm">
              {/* <span>Currently</span> */}
              <Badge className="!pl-0" variant={statusVariant}>{statusLabel}</Badge>
              <p className="text-xs text-muted-foreground">
              {assessment.isPublished
                ? "Candidates with an invitation can access the live assessment."
                : "Assessment remains hidden until you publish it."}
            </p>
            </div>
            
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Instructions</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {assessment.instructions?.trim().length ? assessment.instructions : "No candidate instructions yet."}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Settings summary</h3>
            <ul className="text-sm text-muted-foreground">
              <li>Time limit: {assessment.settings?.timeLimit ? `${assessment.settings.timeLimit} minutes` : "Not set"}</li>
              <li>
                Attempts allowed: {assessment.settings?.attemptsAllowed ? assessment.settings.attemptsAllowed : "Default (1)"}
              </li>
              <li>Proctoring: {assessment.settings?.proctoringSettings?.enabled ? "Enabled" : "Disabled"}</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Quick actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`#`} onClick={()=>{setActiveTab("questions")}}>
                  <ArrowUpRight className="mr-2 h-4 w-4" /> Manage bank
                </Link>
              </Button>
              
              <Button variant="outline" size="sm" asChild>
                <Link href={`#`} onClick={onInviteCandidate}>
                  <Users className="mr-2 h-4 w-4" /> Invite candidates
                </Link>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            Last updated {formatDateTime(assessment.updatedAt)} by the assessment owner.
          </p>
        </CardContent>
      </Card>

      {/* <Card>
        <CardHeader>
          <CardTitle>Question outline</CardTitle>
          <CardDescription>Ordered list of questions and scoring.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<QuestionOutlineRow>
            columns={questionColumns}
            data={questionRows}
            loading={false}
            emptyMessage="No questions linked yet. Add questions from the bank to begin."
          />
        </CardContent>
      </Card> */}
    </div>
  )
}
