"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm, type Resolver } from "react-hook-form"
import * as z from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useRecruiterProfile, useUpdateRecruiterProfile } from "@/hooks/use-recruiter-profile"
import { useAuth } from "@/lib/auth-context"

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
})

export default function RecruiterProfilePage() {
  const { data, isLoading, isError, error } = useRecruiterProfile()
  const updateMutation = useUpdateRecruiterProfile()
  const { refresh, user } = useAuth()

  const defaultValues = useMemo(() => {
    return {
      firstName: data?.firstName ?? user?.name.split(" ")[0] ?? "",
      lastName: data?.lastName ?? user?.name.split(" ").slice(1).join(" ") ?? "",
    }
  }, [data?.firstName, data?.lastName, user?.name])

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema) as Resolver<z.infer<typeof profileSchema>>, 
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    await updateMutation.mutateAsync({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
    })
    await refresh()
  })

  return (
    <div className="grid gap-6">
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load your profile</AlertTitle>
          <AlertDescription>{(error as Error)?.message ?? "Please try again later."}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Keep your contact details up to date. Changes apply to invitation emails and activity logs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input placeholder="Alex" disabled={isLoading || updateMutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input placeholder="Rivera" disabled={isLoading || updateMutation.isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-2">
                <FormLabel>Email</FormLabel>
                <Input value={data?.email ?? user?.email ?? ""} disabled readOnly className="bg-muted/50" />
                <p className="text-xs text-muted-foreground">
                  Email addresses are managed by your organization admin. Contact them if you need to update this value.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={updateMutation.isPending || isLoading}>
                  {updateMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Saving
                    </span>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
