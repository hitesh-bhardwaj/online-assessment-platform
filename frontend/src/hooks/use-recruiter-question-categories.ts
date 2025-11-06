"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"

export interface QuestionCategoriesResponse {
  categories: string[]
  tags: string[]
}

export function useQuestionCategories() {
  return useQuery<QuestionCategoriesResponse>({
    queryKey: ["recruiter", "question-categories"],
    queryFn: () => apiRequest<QuestionCategoriesResponse>({ url: "/recruiter/questions/categories", method: "GET" }),
  })
}

export function useRenameCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { from: string; to: string }) =>
      apiRequest<{ success: boolean; updated: number }>({
        url: "/recruiter/questions/categories",
        method: "PATCH",
        data: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recruiter", "question-categories"] })
      qc.invalidateQueries({ queryKey: ["recruiter", "questions"] })
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { category: string }) =>
      apiRequest<{ success: boolean; updated: number }>({
        url: "/recruiter/questions/categories",
        method: "DELETE",
        data: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recruiter", "question-categories"] })
      qc.invalidateQueries({ queryKey: ["recruiter", "questions"] })
    },
  })
}

