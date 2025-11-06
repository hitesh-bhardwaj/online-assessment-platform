"use client"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssessmentPreview } from "@/hooks/use-recruiter-assessments-enhanced"
import { Clock, Target, AlertTriangle } from "lucide-react"
import { AssessmentStatusBadge } from "./assessment-status-badge"

interface AssessmentPreviewDialogProps {
  assessmentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssessmentPreviewDialog({
  assessmentId,
  open,
  onOpenChange,
}: AssessmentPreviewDialogProps) {
  const { data, isLoading } = useAssessmentPreview(open ? assessmentId : null)
  const preview = data?.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assessment Preview</DialogTitle>
          <DialogDescription>
            This is how candidates will see this assessment (without correct answers shown)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : preview ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">
                  {preview.type}
                </Badge>
                <AssessmentStatusBadge status={preview.status} />
                {preview.category && (
                  <Badge variant="secondary">{preview.category}</Badge>
                )}
                {preview.department && (
                  <Badge variant="outline">{preview.department}</Badge>
                )}
              </div>

              <h2 className="text-2xl font-bold">{preview.title}</h2>

              {preview.description && (
                <p className="text-muted-foreground">{preview.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{preview.settings.timeLimit} minutes</span>
                </div>
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  <span>{preview.totalPoints} points</span>
                </div>
                <span>•</span>
                <span>{preview.questions.length} questions</span>
                <span>•</span>
                <span>~{preview.estimatedDuration} min estimated</span>
              </div>

              {preview.tags && preview.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {preview.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            {preview.instructions && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Instructions
                </h3>
                <p className="text-sm whitespace-pre-wrap">{preview.instructions}</p>
              </div>
            )}

            {/* Settings Overview */}
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Assessment Settings</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Attempts Allowed:</span>{" "}
                  <span className="font-medium">{preview.settings.attemptsAllowed}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Shuffle Questions:</span>{" "}
                  <span className="font-medium">
                    {preview.settings.shuffleQuestions ? "Yes" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Shuffle Options:</span>{" "}
                  <span className="font-medium">
                    {preview.settings.shuffleOptions ? "Yes" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Review Answers:</span>{" "}
                  <span className="font-medium">
                    {preview.settings.allowReviewAnswers ? "Allowed" : "Not Allowed"}
                  </span>
                </div>
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
              <h3 className="font-semibold">Questions ({preview.questions.length})</h3>
              <div className="space-y-4">
                {preview.questions.map((qRef, index) => {
                  const question = qRef.question
                  return (
                    <div key={index} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">Question {qRef.order}</span>
                            <Badge variant="outline" className="capitalize text-xs">
                              {question.type}
                            </Badge>
                            <Badge variant="secondary" className="capitalize text-xs">
                              {question.difficulty}
                            </Badge>
                          </div>
                          <h4 className="font-medium">{question.title}</h4>
                          {question.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {question.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold">{qRef.points} pts</div>
                          <div className="text-muted-foreground">
                            {question.estimatedTimeMinutes} min
                          </div>
                        </div>
                      </div>

                      {/* MCQ/MSQ Options (without correct answers) */}
                      {(question.type === "mcq" || question.type === "msq") &&
                        question.options && (
                          <div className="space-y-2 mt-3">
                            {question.options.map((option: any, optIndex: number) => (
                              <div
                                key={option.id}
                                className="flex items-start gap-3 rounded border p-2 text-sm"
                              >
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                  {String.fromCharCode(65 + optIndex)}
                                </div>
                                <span>{option.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                      {/* Coding Question Details */}
                      {question.type === "coding" && question.codingDetails && (
                        <div className="space-y-3 mt-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {question.codingDetails.language}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Time: {question.codingDetails.timeLimit}s | Memory:{" "}
                              {question.codingDetails.memoryLimit}MB
                            </span>
                          </div>

                          {question.codingDetails.starterCode && (
                            <div>
                              <p className="text-xs font-medium mb-1">Starter Code:</p>
                              <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">
                                <code>{question.codingDetails.starterCode}</code>
                              </pre>
                            </div>
                          )}

                          {question.codingDetails.visibleTestCases &&
                            question.codingDetails.visibleTestCases.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1">Sample Test Cases:</p>
                                <div className="space-y-2">
                                  {question.codingDetails.visibleTestCases.map(
                                    (tc: any, tcIndex: number) => (
                                      <div key={tcIndex} className="rounded border p-2 text-xs">
                                        <div>
                                          <span className="font-medium">Input:</span> {tc.input}
                                        </div>
                                        <div>
                                          <span className="font-medium">Output:</span>{" "}
                                          {tc.expectedOutput}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load preview</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
