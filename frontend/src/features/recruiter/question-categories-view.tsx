"use client"

import Link from "next/link"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useQuestionCategories, useDeleteCategory, useRenameCategory } from "@/hooks/use-recruiter-question-categories"

export function RecruiterQuestionCategoriesView({ basePath = "/recruiter" }: { basePath?: string }) {
  const { data, isLoading, isError, error } = useQuestionCategories()
  const rename = useRenameCategory()
  const del = useDeleteCategory()

  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState("")

  const startEdit = (name: string) => {
    setEditing(name)
    setNewName(name)
  }

  const confirmRename = async () => {
    if (!editing || !newName.trim() || newName.trim() === editing) {
      setEditing(null)
      return
    }
    await rename.mutateAsync({ from: editing, to: newName.trim() })
    setEditing(null)
  }

  const confirmDelete = async (name: string) => {
    if (!window.confirm(`Remove category "${name}" from all questions?`)) return
    await del.mutateAsync({ category: name })
  }

  return (
    <div className="grid gap-6">
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load categories</AlertTitle>
          <AlertDescription>{(error as Error)?.message ?? "Try again later."}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Manage categories</CardTitle>
            <CardDescription>Rename or remove categories across all questions.</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href={`${basePath}/questions`}>Back to questions</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
          {(data?.categories ?? []).length === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground">No categories yet.</div>
          ) : null}
          {(data?.categories ?? []).map((category) => (
            <div
              key={category}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 md:flex-row md:items-center md:justify-between"
            >
              {editing === category ? (
                <div className="flex w-full items-center gap-2 md:w-auto">
                  <Input value={newName} onChange={(event) => setNewName(event.target.value)} className="w-64" />
                </div>
              ) : (
                <div className="text-sm font-medium text-foreground">{category}</div>
              )}
              <div className="flex items-center gap-2">
                {editing === category ? (
                  <>
                    <Button size="sm" onClick={confirmRename} disabled={rename.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startEdit(category)}>
                      Rename
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => confirmDelete(category)} disabled={del.isPending}>
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
