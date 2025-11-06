import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, Archive, AlertCircle } from "lucide-react"

interface QuestionStatusBadgeProps {
  status?: "draft" | "active" | "archived" | "under_review" | string
  className?: string
}

const statusConfig: Record<string, {
  label: string
  variant: "default" | "secondary" | "outline" | "destructive"
  icon: any
}> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    icon: Circle,
  },
  active: {
    label: "Active",
    variant: "default",
    icon: CheckCircle2,
  },
  archived: {
    label: "Archived",
    variant: "outline",
    icon: Archive,
  },
  under_review: {
    label: "Under Review",
    variant: "destructive",
    icon: AlertCircle,
  },
}

export function QuestionStatusBadge({ status, className }: QuestionStatusBadgeProps) {
  // Default to 'active' if status is undefined or not recognized
  const config = statusConfig[status || "active"] || statusConfig.active
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
