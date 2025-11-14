"use client"

import { Trash2, Edit, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useBatchUpdateQuestions, useBatchDeleteQuestions } from "@/hooks/use-recruiter-questions"
import { toast } from "sonner"

interface BatchOperationsToolbarProps {
  selectedIds: string[]
  onClearSelection: () => void
}

export function BatchOperationsToolbar({ selectedIds, onClearSelection }: BatchOperationsToolbarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [batchUpdateField, setBatchUpdateField] = useState<string>("")
  const [batchUpdateValue, setBatchUpdateValue] = useState<string>("")

  const batchUpdate = useBatchUpdateQuestions()
  const batchDelete = useBatchDeleteQuestions()

  const handleBatchUpdate = async () => {
    if (!batchUpdateField || !batchUpdateValue) {
      toast({
        title: "Select field and value",
        description: "Please select both a field to update and a new value.",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await batchUpdate.mutateAsync({
        questionIds: selectedIds,
        updates: { [batchUpdateField]: batchUpdateValue },
      })

      toast({
        title: "Questions updated",
        description: `${result.data.modifiedCount} questions updated successfully.`,
      })

      onClearSelection()
      setBatchUpdateField("")
      setBatchUpdateValue("")
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBatchDelete = async () => {
    try {
      await batchDelete.mutateAsync(selectedIds)
      toast({
        title: "Questions deleted",
        description: `${selectedIds.length} questions have been deleted.`,
      })
      onClearSelection()
      setShowDeleteConfirm(false)
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Some questions may be in use.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/10 p-3">
        <span className="text-sm font-medium">{selectedIds.length} selected</span>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Select value={batchUpdateField} onValueChange={setBatchUpdateField}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="difficulty">Difficulty</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>

          {batchUpdateField === "status" && (
            <Select value={batchUpdateValue} onValueChange={setBatchUpdateValue}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          )}

          {batchUpdateField === "difficulty" && (
            <Select value={batchUpdateValue} onValueChange={setBatchUpdateValue}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          )}

          {batchUpdateField === "category" && (
            <input
              type="text"
              placeholder="Enter category"
              value={batchUpdateValue}
              onChange={(e) => setBatchUpdateValue(e.target.value)}
              className="h-8 w-40 rounded-md border border-input bg-background px-3 text-sm"
            />
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={handleBatchUpdate}
            disabled={!batchUpdateField || !batchUpdateValue || batchUpdate.isPending}
          >
            <Edit className="mr-1 h-3 w-3" />
            {batchUpdate.isPending ? "Updating..." : "Update"}
          </Button>
        </div>

        <div className="h-4 w-px bg-border" />

        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={batchDelete.isPending}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Delete
        </Button>

        <Button size="sm" variant="ghost" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} questions?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will soft-delete the selected questions. Questions used in active assessments
              cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
