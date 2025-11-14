// "use client"

// import { useEffect, useMemo, useState } from "react"
// import Link from "next/link"
// import { Loader2, Pencil } from "lucide-react"
// import { useForm } from "react-hook-form"
// import { zodResolver } from "@hookform/resolvers/zod"

// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { CardDescription, CardTitle } from "@/components/ui/card"
// import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
// import { Input } from "@/components/ui/input"
// import { Textarea } from "@/components/ui/textarea"
// import type { AssessmentDetail } from "@/hooks/use-recruiter-assessment"

// import { metadataFormSchema, type MetadataFormValues, type StatusVariant } from "../types"
// import { formatDateTime, toReadableAssessmentType } from "../utils"

// export interface AssessmentHeaderProps {
//   assessment: AssessmentDetail
//   status: StatusVariant
//   basePath: string
//   isBusy: boolean
//   onPublishToggle: (next: "published" | "draft") => Promise<void> | void
//   onArchive: () => Promise<void> | void
//   onSaveMetadata: (values: MetadataFormValues) => Promise<void>
//   onDuplicate?: () => Promise<void> | void
// }

// export function AssessmentHeader({
//   assessment,
//   status,
//   basePath,
//   isBusy,
//   onPublishToggle,
//   onArchive,
//   onSaveMetadata,
//   onDuplicate,
// }: AssessmentHeaderProps) {
//   const [isEditing, setIsEditing] = useState(false)

//   const defaultValues = useMemo<MetadataFormValues>(
//     () => ({
//       title: assessment.title,
//       type: assessment.type,
//       description: assessment.description ?? "",
//       instructions: assessment.instructions ?? "",
//     }),
//     [assessment.description, assessment.instructions, assessment.title, assessment.type]
//   )

//   const form = useForm<MetadataFormValues>({
//     resolver: zodResolver(metadataFormSchema),
//     defaultValues,
//   })

//   useEffect(() => {
//     form.reset(defaultValues)
//   }, [defaultValues, form])

//   const handleSubmit = form.handleSubmit(async (values) => {
//     const payload: MetadataFormValues = {
//       title: values.title.trim(),
//       type: values.type,
//       description: values.description?.trim() ?? "",
//       instructions: values.instructions?.trim() ?? "",
//     }

//     await onSaveMetadata(payload)
//     setIsEditing(false)
//   })

//   const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
//   const statusVariant: "secondary" | "outline" | "destructive" =
//     status === "published" ? "secondary" : status === "archived" ? "destructive" : "outline"

//   return (
//     <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
//       <Form {...form}>
//         <form className="flex-1 space-y-4" onSubmit={handleSubmit}>
//           {isEditing ? (
//             <div className="grid gap-4 md:grid-cols-2">
//               <FormField 
//               control={form.control}
//                 name="title"
//                 render={({ field }) => (
//                   <FormItem className="space-y-2">
//                     <FormLabel>Title</FormLabel>
//                     <FormControl>
//                       <Input {...field} placeholder="Senior Backend Engineer" disabled={isBusy} />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />
//               <FormField
//                 control={form.control}
//                 name="type"
//                 render={({ field }) => (
//                   <FormItem className="space-y-2">
//                     <FormLabel>Assessment type</FormLabel>
//                     <FormControl>
//                       <select
//                         className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
//                         value={field.value}
//                         onChange={field.onChange}
//                         disabled={isBusy}
//                       >
//                         <option value="mixed">Mixed</option>
//                         <option value="mcq">MCQ only</option>
//                         <option value="coding">Coding</option>
//                       </select>
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />
//               <FormField
//                 control={form.control}
//                 name="description"
//                 render={({ field }) => (
//                   <FormItem className="md:col-span-2 space-y-2">
//                     <FormLabel>Description</FormLabel>
//                     <FormControl>
//                       <Textarea rows={3} {...field} placeholder="Share expectations and role context." disabled={isBusy} />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />
//               <FormField
//                 control={form.control}
//                 name="instructions"
//                 render={({ field }) => (
//                   <FormItem className="md:col-span-2 space-y-2">
//                     <FormLabel>Candidate instructions</FormLabel>
//                     <FormControl>
//                       <Textarea
//                         rows={5}
//                         {...field}
//                         placeholder="Explain time limits, materials allowed, and any tips."
//                         disabled={isBusy}
//                       />
//                     </FormControl>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />
//             </div>
//           ) : (
//             <header className="space-y-3">
//               <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
//                 <CardTitle className="text-2xl">{assessment.title}</CardTitle>
//                 <Badge variant={statusVariant}>{statusLabel}</Badge>
//               </div>
//               {assessment.description ? (
//                 <CardDescription className="max-w-2xl text-base">{assessment.description}</CardDescription>
//               ) : null}
//               <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
//                 <span>Type: {toReadableAssessmentType(assessment.type)}</span>
//                 <span className="hidden sm:inline">•</span>
//                 <span>Last updated {formatDateTime(assessment.updatedAt)}</span>
//               </div>
//             </header>
//           )}

//           {isEditing ? (
//             <div className="flex flex-wrap items-center gap-3">
//               <Button type="submit" size="sm" disabled={isBusy}>
//                 {isBusy ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
//                   </>
//                 ) : (
//                   "Save details"
//                 )}
//               </Button>
//               <Button
//                 type="button"
//                 variant="outline"
//                 size="sm"
//                 disabled={isBusy}
//                 onClick={() => form.reset(defaultValues)}
//               >
//                 Reset
//               </Button>
//               <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setIsEditing(false)}>
//                 Cancel
//               </Button>
//             </div>
//           ) : null}
//         </form>
//       </Form>

//       <div className="flex flex-wrap items-center gap-2 sm:justify-end">
//         <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing((prev) => !prev)}>
//           <Pencil className="mr-2 h-4 w-4" /> {isEditing ? "Close" : "Edit details"}
//         </Button>
//         <Button
//           type="button"
//           size="sm"
//           variant={status === "published" ? "outline" : "secondary"}
//           onClick={() => onPublishToggle(status === "published" ? "draft" : "published")}
//           disabled={isBusy}
//         >
//           {status === "published" ? "Unpublish" : "Publish"}
//         </Button>
//         <Button type="button" size="sm" variant="outline" asChild>
//           <Link href={`${basePath}/assessments/new?clone=${assessment._id}`}>Duplicate</Link>
//         </Button>
//         <Button type="button" size="sm" variant="destructive" onClick={() => onArchive()} disabled={isBusy}>
//           Archive
//         </Button>
//       </div>
//     </section>
//   )
// }

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Pencil } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { AssessmentDetail } from "@/hooks/use-recruiter-assessment"

import { metadataFormSchema, type MetadataFormValues, type StatusVariant } from "../types"
import { formatDateTime, toReadableAssessmentType } from "../utils"

export interface AssessmentHeaderProps {
  assessment: AssessmentDetail
  status: StatusVariant
  basePath: string
  isBusy: boolean
  onPublishToggle: (next: "published" | "draft") => Promise<void> | void
  onArchive: () => Promise<void> | void
  onSaveMetadata: (values: MetadataFormValues) => Promise<void>
  onDuplicate?: () => Promise<void> | void
}

export function AssessmentHeader({
  assessment,
  status,
  basePath,
  isBusy,
  onPublishToggle,
  onArchive,
  onSaveMetadata,
  onDuplicate,
}: AssessmentHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  const defaultValues = useMemo<MetadataFormValues>(
    () => ({
      title: assessment.title,
      type: assessment.type,
      description: assessment.description ?? "",
      instructions: assessment.instructions ?? "",
    }),
    [assessment.description, assessment.instructions, assessment.title, assessment.type]
  )

  const form = useForm<MetadataFormValues>({
    resolver: zodResolver(metadataFormSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: MetadataFormValues = {
      title: values.title.trim(),
      type: values.type,
      description: values.description?.trim() ?? "",
      instructions: values.instructions?.trim() ?? "",
    }

    await onSaveMetadata(payload)
    setIsEditing(false)
  })

  const handleDuplicate = async () => {
    if (!onDuplicate) {
      console.error('onDuplicate handler not provided')
      return
    }
    setIsDuplicating(true)
    try {
      await onDuplicate()
    } catch (error) {
      console.error('Duplication failed:', error)
    } finally {
      setIsDuplicating(false)
    }
  }

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
  const statusVariant: "secondary" | "outline" | "destructive" =
    status === "published" ? "secondary" : status === "archived" ? "destructive" : "outline"

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <Form {...form}>
        <form className="flex-1 space-y-4" onSubmit={handleSubmit}>
          {isEditing ? (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField 
              control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Senior Backend Engineer" disabled={isBusy} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Assessment type</FormLabel>
                    <FormControl>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isBusy}
                      >
                        <option value="mixed">Mixed</option>
                        <option value="mcq">MCQ only</option>
                        <option value="coding">Coding</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 space-y-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} placeholder="Share expectations and role context." disabled={isBusy} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 space-y-2">
                    <FormLabel>Candidate instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        {...field}
                        placeholder="Explain time limits, materials allowed, and any tips."
                        disabled={isBusy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : (
            <header className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <CardTitle className="text-2xl">{assessment.title}</CardTitle>
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </div>
              {assessment.description ? (
                <CardDescription className="max-w-2xl text-base">{assessment.description}</CardDescription>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Type: {toReadableAssessmentType(assessment.type)}</span>
                <span className="hidden sm:inline">•</span>
                <span>Last updated {formatDateTime(assessment.updatedAt)}</span>
              </div>
            </header>
          )}

          {isEditing ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="sm" disabled={isBusy}>
                {isBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save details"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => form.reset(defaultValues)}
              >
                Reset
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : null}
        </form>
      </Form>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing((prev) => !prev)}>
          <Pencil className="mr-2 h-4 w-4" /> {isEditing ? "Close" : "Edit details"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={status === "published" ? "outline" : "secondary"}
          onClick={() => onPublishToggle(status === "published" ? "draft" : "published")}
          disabled={isBusy}
        >
          {status === "published" ? "Unpublish" : "Publish"}
        </Button>
        <Button 
          type="button" 
          size="sm" 
          variant="outline" 
          onClick={handleDuplicate}
          disabled={isBusy || isDuplicating}
        >
          {isDuplicating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Duplicating…
            </>
          ) : (
            "Duplicate"
          )}
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={() => onArchive()} disabled={isBusy}>
          Archive
        </Button>
      </div>
    </section>
  )
}
