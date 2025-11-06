"use client"

import { useState } from "react"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useCreateRecruiterQuestion } from "@/hooks/use-recruiter-questions"

const questionSchema = z.object({
  title: z.string().min(4, "Title is required"),
  description: z.string().max(1000).optional(),
  type: z.union([z.literal("mcq"), z.literal("msq"), z.literal("coding")]),
  difficulty: z.union([z.literal("easy"), z.literal("medium"), z.literal("hard")]),
  category: z.string().max(60).optional(),
  tags: z.string().optional(),
  points: z.coerce.number().min(1).max(100).default(1),
  estimatedTimeMinutes: z.coerce.number().min(1).max(240).default(5),
  options: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().min(1, "Option text required"),
        isCorrect: z.boolean(),
      })
    )
    .default([]),
  codingDetails: z.record(z.any()).optional(),
  explanation: z.string().optional(),
})

type FormValues = z.infer<typeof questionSchema>

export function RecruiterNewQuestionView({ basePath = "/recruiter" }: { basePath?: string }) {
  const router = useRouter()
  const createMutation = useCreateRecruiterQuestion()

  const form = useForm<FormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "mcq",
      difficulty: "medium",
      category: "",
      tags: "",
      points: 1,
      estimatedTimeMinutes: 5,
      options: [
        { id: crypto.randomUUID(), text: "", isCorrect: true },
        { id: crypto.randomUUID(), text: "", isCorrect: false },
      ],
      explanation: "",
    },
  })

  const [type, setType] = useState<"mcq" | "msq" | "coding">("mcq")

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      title: values.title,
      description: values.description || undefined,
      type: values.type,
      difficulty: values.difficulty,
      category: values.category || undefined,
      tags: values.tags
        ? values.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      points: values.points,
      estimatedTimeMinutes: values.estimatedTimeMinutes,
      options: values.type === "coding" ? [] : values.options,
      codingDetails: values.type === "coding" ? {} : undefined,
      explanation: values.explanation || undefined,
    }

    await createMutation.mutateAsync(payload)
    router.push(`${basePath}/questions`)
  })

  const options = form.watch("options")

  const addOption = () => {
    const current = form.getValues("options")
    if (current.length >= 10) return
    form.setValue("options", [...current, { id: crypto.randomUUID(), text: "", isCorrect: false }])
  }

  const removeOption = (id: string) => {
    const current = form.getValues("options")
    if (current.length <= 2) return
    form.setValue(
      "options",
      current.filter((option) => option.id !== id)
    )
  }

  const toggleCorrect = (id: string) => {
    if (form.getValues("type") === "mcq") {
      form.setValue(
        "options",
        options.map((option) => ({ ...option, isCorrect: option.id === id }))
      )
    } else {
      form.setValue(
        "options",
        options.map((option) => (option.id === id ? { ...option, isCorrect: !option.isCorrect } : option))
      )
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>New question</CardTitle>
          <CardDescription>Create a reusable question for your library.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" disabled={createMutation.isPending} {...form.register("title")} />
            {form.formState.errors.title?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={createMutation.isPending}
              {...form.register("type")}
              onChange={(event) => {
                const nextType = event.target.value as "mcq" | "msq" | "coding"
                setType(nextType)
                form.setValue("type", nextType)
              }}
            >
              <option value="mcq">MCQ</option>
              <option value="msq">MSQ</option>
              <option value="coding">Coding</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <select
              id="difficulty"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={createMutation.isPending}
              {...form.register("difficulty")}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., React, UI/UX, Aptitude"
              disabled={createMutation.isPending}
              {...form.register("category")}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} disabled={createMutation.isPending} {...form.register("description")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" placeholder="comma,separated,tags" disabled={createMutation.isPending} {...form.register("tags")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              min={1}
              max={100}
              disabled={createMutation.isPending}
              {...form.register("points", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedTimeMinutes">Estimated time (min)</Label>
            <Input
              id="estimatedTimeMinutes"
              type="number"
              min={1}
              max={240}
              disabled={createMutation.isPending}
              {...form.register("estimatedTimeMinutes", { valueAsNumber: true })}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="explanation">Explanation</Label>
            <Textarea id="explanation" rows={3} disabled={createMutation.isPending} {...form.register("explanation")} />
          </div>
        </CardContent>
      </Card>

      {type !== "coding" ? (
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>Mark the correct {type === "mcq" ? "option" : "options"}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {options.map((option, index) => (
              <div
                key={option.id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={option.isCorrect ? "secondary" : "outline"}>{index + 1}</Badge>
                  <Input
                    value={option.text}
                    onChange={(event) =>
                      form.setValue(
                        "options",
                        options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item))
                      )
                    }
                    placeholder={`Option ${index + 1}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant={option.isCorrect ? "default" : "outline"} onClick={() => toggleCorrect(option.id)}>
                    {option.isCorrect ? "Correct" : "Mark correct"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => removeOption(option.id)} disabled={options.length <= 2}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button type="button" variant="outline" onClick={addOption} disabled={options.length >= 10}>
                Add option
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            const values = form.getValues()
            if (values.type !== "coding") {
              const correctCount = values.options.filter((option) => option.isCorrect).length
              const nonEmpty = values.options.filter((option) => option.text.trim().length > 0).length
              if (values.options.length < 2 || nonEmpty < values.options.length) {
                form.setError("options", { type: "manual", message: "Provide at least two non-empty options" })
                return
              }
              if (values.type === "mcq" && correctCount !== 1) {
                form.setError("options", { type: "manual", message: "MCQ requires exactly one correct option" })
                return
              }
              if (values.type === "msq" && correctCount < 1) {
                form.setError("options", { type: "manual", message: "Select at least one correct option" })
                return
              }
            }
            onSubmit()
          }}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "Saving…" : "Create question"}
        </Button>
      </div>
    </div>
  )
}
