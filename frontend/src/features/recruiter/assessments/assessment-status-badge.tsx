import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, Archive, Calendar, AlertCircle } from "lucide-react"

interface AssessmentStatusBadgeProps {
  status?: "draft" | "active" | "archived" | "scheduled" | "under_review" | string
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
  scheduled: {
    label: "Scheduled",
    variant: "default",
    icon: Calendar,
  },
  under_review: {
    label: "Under Review",
    variant: "destructive",
    icon: AlertCircle,
  },
}

export function AssessmentStatusBadge({ status, className }: AssessmentStatusBadgeProps) {
  const config = statusConfig[status || "draft"] || statusConfig.draft
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
