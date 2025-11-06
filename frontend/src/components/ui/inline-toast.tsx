"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type InlineToastVariant = "default" | "destructive" | "success"

const variantStyles: Record<InlineToastVariant, string> = {
  default: "border border-border",
  destructive: "border border-destructive/40 bg-destructive/10 text-destructive",
  success: "border border-emerald-400/60 bg-emerald-100/60 text-emerald-900",
}

export interface InlineToastProps {
  title?: string
  description?: string
  variant?: InlineToastVariant
  onDismiss?: () => void
}

export function InlineToast({ title, description, variant = "default", onDismiss }: InlineToastProps) {
  return (
    <Alert className={cn("flex items-start gap-3", variantStyles[variant])}>
      <div className="flex-1 space-y-1">
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        {description ? <AlertDescription>{description}</AlertDescription> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      ) : null}
    </Alert>
  )
}
