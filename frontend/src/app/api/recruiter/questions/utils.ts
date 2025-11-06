interface QuestionPayload {
  _id: string
  title: string
  description?: string
  type: "mcq" | "msq" | "coding"
  difficulty: "easy" | "medium" | "hard"
  category?: string
  tags?: string[]
  points?: number
  estimatedTimeMinutes?: number
  options?: Array<{
    id: string
    text: string
    isCorrect: boolean
  }>
  codingDetails?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export function mapQuestionPayload(question: QuestionPayload) {
  return {
    id: question._id,
    title: question.title,
    description: question.description,
    type: question.type,
    difficulty: question.difficulty,
    category: question.category ?? "",
    tags: question.tags ?? [],
    points: question.points ?? 1,
    estimatedTimeMinutes: question.estimatedTimeMinutes ?? 5,
    options: question.options ?? [],
    codingDetails: question.codingDetails,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  }
}

export type { QuestionPayload }
