"use client"

import { Copy, Eye, CheckCircle, BarChart3, MoreVertical, Trash2, EyeOff } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  useDuplicateAssessment,
  usePublishAssessment,
  useUnpublishAssessment,
  useDeleteAssessment,
} from "@/hooks/use-recruiter-assessments-enhanced"
import { toast } from "@/hooks/use-toast"

import { AssessmentPreviewDialog } from "./assessment-preview-dialog"
import { AssessmentStatsDialog } from "./assessment-stats-dialog"
import { AssessmentValidationDialog } from "./assessment-validation-dialog"

interface AssessmentActionsProps {
  assessmentId: string
  assessmentTitle: string
  isPublished: boolean
  status: string
}

export function AssessmentActions({
  assessmentId,
  assessmentTitle,
  isPublished,
  status,
}: AssessmentActionsProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const duplicateAssessment = useDuplicateAssessment()
  const publishAssessment = usePublishAssessment()
  const unpublishAssessment = useUnpublishAssessment()
  const deleteAssessment = useDeleteAssessment()

  const handleDuplicate = async () => {
    try {
      await duplicateAssessment.mutateAsync(assessmentId)
      toast({
        title: "Assessment duplicated",
        description: "The assessment has been cloned as a draft.",
      })
    } catch (error) {
      toast({
        title: "Failed to duplicate",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePublish = async () => {
    try {
      await publishAssessment.mutateAsync(assessmentId)
      toast({
        title: "Assessment published",
        description: "The assessment is now available for candidates.",
      })
    } catch (error) {
      toast({
        title: "Failed to publish",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUnpublish = async () => {
    try {
      await unpublishAssessment.mutateAsync(assessmentId)
      toast({
        title: "Assessment unpublished",
        description: "The assessment is no longer available for candidates.",
      })
    } catch (error) {
      toast({
        title: "Failed to unpublish",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteAssessment.mutateAsync(assessmentId)
      toast({
        title: "Assessment deleted",
        description: "The assessment has been removed.",
      })
      setShowDeleteConfirm(false)
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: error instanceof Error ? error.message : "Assessment may have active invitations.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setShowPreview(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowValidation(true)}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Validate
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowStats(true)}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Statistics
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleDuplicate} disabled={duplicateAssessment.isPending}>
            <Copy className="mr-2 h-4 w-4" />
            {duplicateAssessment.isPending ? "Duplicating..." : "Duplicate"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {!isPublished ? (
            <DropdownMenuItem onClick={handlePublish} disabled={publishAssessment.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {publishAssessment.isPending ? "Publishing..." : "Publish"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleUnpublish} disabled={unpublishAssessment.isPending}>
              <EyeOff className="mr-2 h-4 w-4" />
              {unpublishAssessment.isPending ? "Unpublishing..." : "Unpublish"}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteAssessment.isPending}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AssessmentPreviewDialog
        assessmentId={assessmentId}
        open={showPreview}
        onOpenChange={setShowPreview}
      />

      <AssessmentValidationDialog
        assessmentId={assessmentId}
        assessmentTitle={assessmentTitle}
        open={showValidation}
        onOpenChange={setShowValidation}
      />

      <AssessmentStatsDialog
        assessmentId={assessmentId}
        assessmentTitle={assessmentTitle}
        open={showStats}
        onOpenChange={setShowStats}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the assessment
              "{assessmentTitle}". Assessments with active invitations cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
