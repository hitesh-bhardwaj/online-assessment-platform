import * as z from "zod"

export const metadataFormSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters").max(200),
  type: z.union([z.literal("mixed"), z.literal("mcq"), z.literal("coding")]),
  description: z.string().max(1000).optional().or(z.literal("")),
  instructions: z.string().max(2000).optional().or(z.literal("")),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().max(100).optional().or(z.literal("")),
  department: z.string().max(100).optional().or(z.literal("")),
  jobRole: z.string().max(100).optional().or(z.literal("")),
})

export type MetadataFormValues = z.infer<typeof metadataFormSchema>

const settingsFormSchemaDefinition = z.object({
  timeLimit: z.coerce.number().min(5).max(480),
  passingScore: z.union([z.coerce.number().min(0).max(100), z.literal("")]),
  attemptsAllowed: z.coerce.number().min(1).max(10),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  allowReviewAnswers: z.boolean(),
  showResultsToCandidate: z.boolean(),
  autoSubmitOnTimeUp: z.boolean(),
  proctoring: z.object({
    enabled: z.boolean(),
    recordScreen: z.boolean(),
    recordWebcam: z.boolean(),
    detectTabSwitch: z.boolean(),
    detectCopyPaste: z.boolean(),
    detectMultipleMonitors: z.boolean(),
    allowedApps: z.array(z.string()).optional().default([]),
    blockedWebsites: z.array(z.string()).optional().default([]),
  }),
})

export type SettingsFormValues = z.infer<typeof settingsFormSchemaDefinition>
export const settingsFormSchema: z.ZodType<SettingsFormValues> = settingsFormSchemaDefinition

export type StatusVariant = "draft" | "published" | "archived"

export type QuestionOutlineRow = {
  id: string
  order: number
  title: string
  points: number
  type?: string
  difficulty?: string
}
