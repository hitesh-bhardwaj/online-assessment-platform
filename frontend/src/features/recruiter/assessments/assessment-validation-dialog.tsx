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
import { useAssessmentValidation } from "@/hooks/use-recruiter-assessments-enhanced"
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface AssessmentValidationDialogProps {
  assessmentId: string
  assessmentTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssessmentValidationDialog({
  assessmentId,
  assessmentTitle,
  open,
  onOpenChange,
}: AssessmentValidationDialogProps) {
  const { data, isLoading } = useAssessmentValidation(open ? assessmentId : null)
  const validation = data?.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assessment Validation</DialogTitle>
          <DialogDescription>{assessmentTitle}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : validation ? (
          <div className="space-y-6">
            {/* Status */}
            <Alert variant={validation.canPublish ? "default" : "destructive"}>
              {validation.canPublish ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Ready to Publish</AlertTitle>
                  <AlertDescription>
                    This assessment passes all validation checks and can be published.
                  </AlertDescription>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Cannot Publish</AlertTitle>
                  <AlertDescription>
                    This assessment has validation errors that must be fixed before publishing.
                  </AlertDescription>
                </>
              )}
            </Alert>

            {/* Errors */}
            {validation.errors.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Errors ({validation.errors.length})
                </h3>
                <div className="space-y-2">
                  {validation.errors.map((error, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm"
                    >
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings ({validation.warnings.length})
                </h3>
                <div className="space-y-2">
                  {validation.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm"
                    >
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Assessment Information
              </h3>
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Questions</p>
                  <p className="text-2xl font-bold">{validation.info.questionCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Points</p>
                  <p className="text-2xl font-bold">{validation.info.totalPoints}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Duration</p>
                  <p className="text-2xl font-bold">{validation.info.estimatedDuration} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Scheduling</p>
                  <p className="text-2xl font-bold">
                    {validation.info.hasScheduling ? (
                      <Badge variant="default" className="text-xs">
                        Scheduled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Immediate
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {validation.canPublish && validation.errors.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Ready to Go!</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                    <li>All questions are active and validated</li>
                    <li>Assessment settings are properly configured</li>
                    <li>Time limits and attempts are set</li>
                    {validation.info.hasScheduling && (
                      <li>Scheduled dates are valid</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load validation</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
