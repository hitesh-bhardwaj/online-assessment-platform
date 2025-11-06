"use client"

import { useCallback } from "react"
import { toast } from "sonner"

type ToastVariant = "default" | "success" | "destructive"

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  id?: string | number
}

export function useToast() {
  const showToast = useCallback(({ title, description, variant = "default", id }: ToastOptions) => {
    const payload = { description, id }

    if (variant === "success") {
      toast.success(title, payload)
      return
    }

    if (variant === "destructive") {
      toast.error(title, payload)
      return
    }

    toast(title, payload)
  }, [])

  return { showToast }
}
